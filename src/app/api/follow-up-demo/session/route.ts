import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit, hashRateLimitKey } from "@/lib/durable-rate-limit"
import { sendDemoExperienceEmail, sendLeadNotification, validateSmtpConfig } from "@/lib/mail"
import {
  createFollowUpSession,
  createSessionToken,
  event,
  getOrCreateFollowUpSession,
  publicBaseUrl,
  publicSession,
  saveFollowUpSession,
  validateNewSession,
} from "@/lib/follow-up-demo"
import { startDemoCall, validateTwilioCallConfig } from "@/lib/twilio-demo"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { getSideEffectsCollection, demoDb, getDemoTenantId } from "@/lib/firebase-admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const ip = getClientIp(request)
  if (!(await checkDurableRateLimit(`follow-up-session:${ip}`, 4, 60 * 60 * 1000, { failClosed: true }))) {
    return NextResponse.json({ ok: false, error: "You have reached the live demo limit. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const input = validateNewSession(body)
    if (!input) {
      return NextResponse.json({ ok: false, error: "Enter a valid name, email, and mobile number, then approve SMS and email for this demo." }, { status: 400 })
    }
    if (!(await checkDurableRateLimit(`follow-up-phone:${hashRateLimitKey(input.phone)}`, 2, 24 * 60 * 60 * 1000, { failClosed: true }))) {
      return NextResponse.json({ ok: false, error: "This phone number has reached today's demo limit." }, { status: 429 })
    }

    const rawKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : ""
    const idempotencyKey = rawKey || `key-${input.phone}:${input.email}:${input.businessType}`
    let currentSession
    try {
      const result = await getOrCreateFollowUpSession({ ...input, idempotencyKey })
      currentSession = result.session
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === "idempotency_key_payload_mismatch") {
        return NextResponse.json({ ok: false, error: "Idempotency key payload mismatch." }, { status: 409 })
      }
      if (msg === "idempotency_key_expired") {
        return NextResponse.json({ ok: false, error: "Idempotency key expired." }, { status: 410 })
      }
      throw err
    }
    const session = currentSession

    const token = createSessionToken(session)
    const baseUrl = publicBaseUrl(request)
    const statusCallback = `${baseUrl}/api/follow-up-demo/twilio/status?sessionId=${encodeURIComponent(session.id)}&channel=call&mode=missed-call`
    const callUrl = `${baseUrl}/api/follow-up-demo/missed-call-twiml?token=${encodeURIComponent(token)}`

    const db = demoDb()
    const tenantId = getDemoTenantId()
    const sideEffectsRef = db ? getSideEffectsCollection(db, tenantId) : null
    const store = createSideEffectStore(db, sideEffectsRef)

    const callEffectId = deriveSideEffectId(session.id, 'initial-call')
    const callOutcome = await executeSideEffect(
      store,
      callEffectId,
      'initial-call',
      async () => {
        const res = await startDemoCall({ to: session.phone, twimlUrl: callUrl, statusCallback, machineDetection: "Enable" })
        return { value: { providerSid: res.sid, from: res.from }, providerId: res.sid }
      },
      {
        sessionId: session.id,
        completedState: "started",
        preflight: () => {
          const config = validateTwilioCallConfig()
          if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
        },
      }
    )
    if (callOutcome.kind === "executed") {
      session.twilioCallSid = callOutcome.value.providerSid
      session.twilioNumber = callOutcome.value.from
      session.initialCallState = "started"
      session.events.push(event("call.started", "Demo call started", "Reject the call or let it ring out to trigger the text-back", "call", "running"))
      session.events.push(event("sms.waiting_for_missed_call", "Text-back waiting", "SMS sends after Twilio reports the call was missed", "sms", "waiting"))
    } else if (callOutcome.kind === "already_completed" || callOutcome.kind === "already_dispatching") {
      // Ignored
    } else if (callOutcome.kind === "persistence_unavailable" || callOutcome.kind === "preflight_failed" || callOutcome.kind === "provider_rejected") {
      session.initialCallState = "failed"
    } else {
      session.initialCallState = "uncertain_after_dispatch"
    }

    const emailEffectId = deriveSideEffectId(session.id, 'initial-email')
    const emailOutcome = await executeSideEffect(
      store,
      emailEffectId,
      'initial-email',
      async () => {
        const res = await sendDemoExperienceEmail({ fullName: session.fullName, email: session.email, businessType: session.businessType })
        if (res.sent === false) throw new ProviderRejectedError(res.reasonCode)
        return { value: { sent: true }, providerId: res.providerId }
      },
      {
        sessionId: session.id,
        preflight: () => {
          if (!validateSmtpConfig().configured) throw new SideEffectPreflightError("not_configured")
        },
      }
    )
    if (emailOutcome.kind === "executed") {
      session.initialEmailState = "sent"
      session.events.push(event("email.sent", "Demo email sent", session.email, "email", "completed"))
    } else if (emailOutcome.kind === "already_completed" || emailOutcome.kind === "already_dispatching") {
      // Ignored
    } else if (emailOutcome.kind === "persistence_unavailable" || emailOutcome.kind === "preflight_failed" || emailOutcome.kind === "provider_rejected") {
      session.initialEmailState = "failed"
    } else {
      session.initialEmailState = "uncertain_after_dispatch"
    }

    const leadEffectId = deriveSideEffectId(session.id, 'lead-notification')
    const leadOutcome = await executeSideEffect(
      store,
      leadEffectId,
      'lead-notification',
      async () => {
        const res = await sendLeadNotification({
          fullName: session.fullName,
          email: session.email,
          companyName: session.companyName,
          industry: session.businessType,
          projectScope: "Started the Mox Follow-Up live SMS demonstration.",
          estimatedVolume: "Not provided",
        })
        if (res.sent === false) throw new ProviderRejectedError(res.reasonCode)
        return { value: { sent: true }, providerId: res.providerId }
      },
      {
        sessionId: session.id,
        preflight: () => {
          if (!validateSmtpConfig().configured) throw new SideEffectPreflightError("not_configured")
        },
      }
    )
    if (leadOutcome.kind === "executed") {
      session.leadNotificationState = "sent"
    } else if (leadOutcome.kind === "already_completed" || leadOutcome.kind === "already_dispatching") {
      // Ignored
    } else if (leadOutcome.kind === "persistence_unavailable" || leadOutcome.kind === "preflight_failed" || leadOutcome.kind === "provider_rejected") {
      session.leadNotificationState = "failed"
    } else {
      session.leadNotificationState = "uncertain"
    }

    await saveFollowUpSession(session)

    return NextResponse.json({ ok: true, token, session: publicSession(session) })
  } catch (error) {
    console.error("[follow-up-demo/session]", error)
    return NextResponse.json({ ok: false, error: "The live demo could not start." }, { status: 500 })
  }
}
