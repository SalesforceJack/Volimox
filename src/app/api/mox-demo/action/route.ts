import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { sendLeadNotification, validateSmtpConfig } from "@/lib/mail"
import { buildGlobalDemoQuote, createDemoToken, normalizeDemoPhone, sendDemoSms, validateDemoSmsConfig } from "@/lib/volimox-demo"
import { getMoxAgent } from "@/lib/mox-agents"
import { createSessionToken, event, getFollowUpSession, publicBaseUrl, readSessionToken, saveFollowUpSession } from "@/lib/follow-up-demo"
import { startDemoCall, validateTwilioCallConfig } from "@/lib/twilio-demo"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { demoDb, getSideEffectsCollection } from "@/lib/firebase-admin"

export const runtime = "nodejs"

const text = (value: unknown, max = 500) => typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max) : ""

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const allowed = await checkDurableRateLimit(`mox-action:${ip}`, 18, 60 * 60 * 1000, { failClosed: true })
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Demo action limit reached. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json() as { agentId?: string; tool?: string; args?: Record<string, unknown>; demoSessionToken?: string }
    const agent = getMoxAgent(body.agentId)
    const args = body.args || {}
    const verifiedSession = readSessionToken(body.demoSessionToken)
    const linkedSession = verifiedSession ? await getFollowUpSession(verifiedSession.id) : null

    const db = demoDb()
    const collection = db ? getSideEffectsCollection(db) : null
    const store = createSideEffectStore(db, collection)

    // --- Read-only: no session token required ---
    if (agent.id === "limo" && body.tool === "get_volimox_demo_quote") {
      const quote = await buildGlobalDemoQuote({
        pickup: text(args.pickup_address, 240),
        destination: text(args.destination_address, 240),
        passengers: Math.max(1, Math.min(80, Math.trunc(Number(args.passenger_count) || 1))),
      })
      return NextResponse.json({ ok: true, tool: body.tool, result: { ...quote, message: `Route resolved at ${quote.distanceMiles.toFixed(1)} miles and ${quote.durationMinutes} minutes. Illustrative quote: $${quote.estimatedValueUsd.toFixed(2)}.` } })
    }

    // --- Cost-bearing: requires session token ---
    if (agent.id === "limo" && body.tool === "create_volimox_demo_link") {
      if (!linkedSession || !body.demoSessionToken) {
        return NextResponse.json({ ok: false, error: "A valid demo session is required." }, { status: 400 })
      }
      if (!linkedSession.consentSms) {
        return NextResponse.json({ ok: false, error: "The visitor must approve SMS in the Mox Follow-Up form first." }, { status: 400 })
      }
      // Use phone from the linked session, not from untrusted args
      const phone = linkedSession.phone || normalizeDemoPhone(args.phone)
      const distanceMiles = Number(args.distance_miles)
      const durationMinutes = Number(args.duration_minutes)
      const estimatedValueUsd = Number(args.illustrative_quote_usd)
      if (!phone || !Number.isFinite(distanceMiles) || !Number.isFinite(durationMinutes) || !Number.isFinite(estimatedValueUsd)) {
        return NextResponse.json({ ok: false, error: "A valid phone and route result are required." }, { status: 400 })
      }
      const effectId = deriveSideEffectId(
        linkedSession.id,
        "demo-link-sms",
        String(Math.round(estimatedValueUsd * 100)),
        String(Math.round(distanceMiles * 10)),
        String(Math.round(durationMinutes)),
      )
      const reservationId = `MOX-DEMO-${effectId.slice(0, 8).toUpperCase()}`
      const token = createDemoToken({
        distanceMiles,
        durationMinutes,
        estimatedValueUsd,
        reservationId,
        tokenId: effectId,
        expiresAt: new Date(linkedSession.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000,
      })
      const url = new URL(`/demo/${token}`, request.url).toString()

      const smsOutcome = await executeSideEffect(
        store,
        effectId,
        "demo-link-sms",
        async () => {
          const result = await sendDemoSms(phone, url)
          if (result.sent === false) throw new ProviderRejectedError(result.reasonCode)
          return { value: result, providerId: result.messageSid }
        },
        {
          sessionId: linkedSession.id,
          preflight: () => {
            const config = validateDemoSmsConfig()
            if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
          },
        },
      )

      if (smsOutcome.kind === "already_completed") {
        return NextResponse.json({ ok: true, tool: body.tool, result: { reservationId, url, smsSent: true, message: "The continuation page was already sent by SMS." } })
      }
      if (smsOutcome.kind === "reconciliation_required" && smsOutcome.value) {
        return NextResponse.json({ ok: true, tool: body.tool, result: { reservationId, url, smsSent: true, message: "The continuation page was sent; delivery status is being reconciled." } })
      }
      if (smsOutcome.kind !== "executed") {
        return NextResponse.json({ ok: false, error: "The continuation SMS could not be sent safely." }, { status: 503 })
      }

      return NextResponse.json({ ok: true, tool: body.tool, result: { reservationId, url, smsSent: true, message: "The continuation page was sent by SMS." } })
    }

    // --- Capture contact: requires session token + consent ---
    if (body.tool === "capture_demo_contact") {
      if (!linkedSession || !body.demoSessionToken) {
        return NextResponse.json({ ok: false, error: "A valid demo session is required." }, { status: 400 })
      }

      const fullName = text(args.full_name, 120) || linkedSession?.fullName || ""
      const email = text(args.email, 254).toLowerCase() || linkedSession?.email || ""
      const phone = normalizeDemoPhone(args.phone) || linkedSession?.phone || ""
      const companyName = text(args.company_name, 160) || linkedSession?.companyName || ""
      const businessNeed = text(args.business_need, 1400)
      if (!fullName || !companyName || !businessNeed || !/^\S+@\S+\.\S+$/.test(email)) {
        return NextResponse.json({ ok: false, error: "A name, work email, company, and business need are required." }, { status: 400 })
      }

      // Email notification — only if consent is given
      let emailNotified = false
      if (linkedSession.consentEmail !== false) {
        const emailEffectId = deriveSideEffectId(linkedSession.id, "capture-lead-email")
        const emailOutcome = await executeSideEffect(
          store,
          emailEffectId,
          "capture-lead-email",
          async () => {
            const res = await sendLeadNotification({ fullName, email, companyName, industry: agent.name, projectScope: `Live ${agent.name} demo follow-up. ${businessNeed}`, estimatedVolume: "Not provided" })
            if (res.sent === false) throw new ProviderRejectedError(res.reasonCode)
            return { value: res, providerId: res.providerId }
          },
          {
            sessionId: linkedSession.id,
            preflight: () => {
              if (!validateSmtpConfig().configured) throw new SideEffectPreflightError("not_configured")
            },
          },
        )
        emailNotified = emailOutcome.kind === "executed" && emailOutcome.value.sent === true
      }

      // SMS — only if consent is given and phone available
      let smsSent = false
      if (phone && linkedSession.consentSms) {
        const smsEffectId = deriveSideEffectId(linkedSession.id, "capture-follow-up-sms")
        const smsOutcome = await executeSideEffect(
          store,
          smsEffectId,
          "capture-follow-up-sms",
          async () => {
            const result = await sendDemoSms(phone, process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || new URL("/", request.url).origin)
            if (result.sent === false) throw new ProviderRejectedError(result.reasonCode)
            return { value: result, providerId: result.messageSid }
          },
          {
            sessionId: linkedSession.id,
            preflight: () => {
              const config = validateDemoSmsConfig()
              if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
            },
          },
        )
        smsSent = smsOutcome.kind === "executed" && smsOutcome.value.sent === true
      }

      if (linkedSession) {
        linkedSession.events.push(event("agent.intake_completed", `${agent.name} intake completed`, businessNeed, "lead", "completed"))
        if (smsSent) {
          linkedSession.events.push(event("agent.sms_sent", `${agent.name} follow-up sent`, "Sent to the approved demo number", "sms", "completed"))
        } else if (phone && linkedSession.consentSms) {
          linkedSession.events.push(event("agent.sms_unavailable", "Agent follow-up SMS unavailable", "SMS unavailable or already sent", "sms", "failed"))
        }
        await saveFollowUpSession(linkedSession)
      }
      return NextResponse.json({ ok: true, tool: body.tool, result: { emailNotified, smsSent, message: "The follow-up was captured and routed to the Volimox team." } })
    }

    // --- Start callback: requires session + consent + inbound SMS ---
    if (body.tool === "start_requested_demo_call") {
      if (!linkedSession || !linkedSession.consentCall || !body.demoSessionToken) {
        return NextResponse.json({ ok: false, error: "The visitor must approve calls in the Mox Follow-Up form first." }, { status: 400 })
      }
      if (!linkedSession.messages.some((item) => item.direction === "inbound")) {
        return NextResponse.json({ ok: false, error: "The visitor must reply to the demo SMS before a callback can start." }, { status: 400 })
      }

      const callEffectId = deriveSideEffectId(linkedSession.id, "callback-call")
      const baseUrl = publicBaseUrl(request)
      const token = createSessionToken(linkedSession)

      const callOutcome = await executeSideEffect(
        store,
        callEffectId,
        "callback-call",
        async () => {
          const res = await startDemoCall({
            to: linkedSession.phone,
            twimlUrl: `${baseUrl}/api/follow-up-demo/twiml?token=${encodeURIComponent(token)}`,
            statusCallback: `${baseUrl}/api/follow-up-demo/twilio/status?sessionId=${encodeURIComponent(linkedSession.id)}&channel=call`,
          })
          return { value: res, providerId: res.sid }
        },
        {
          sessionId: linkedSession.id,
          completedState: "started",
          preflight: () => {
            const config = validateTwilioCallConfig()
            if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
          },
        },
      )

      if (callOutcome.kind !== "executed") {
        return NextResponse.json({ ok: true, tool: body.tool, result: { callStarted: false, message: "A callback is already in progress or completed." } })
      }

      linkedSession.events.push(event("agent.call_started", `${agent.name} callback started`, `Call ${callOutcome.value.status || "unknown"}`, "call", "running"))
      await saveFollowUpSession(linkedSession)
      return NextResponse.json({ ok: true, tool: body.tool, result: { callStarted: true, message: "The approved demonstration callback is starting now." } })
    }

    // Unknown tool — reject instead of faking success
    return NextResponse.json({ ok: false, error: "Unknown tool." }, { status: 400 })
  } catch (error) {
    console.error("[volimox/mox-demo/action]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "Demo action failed." }, { status: 502 })
  }
}
