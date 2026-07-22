import { NextResponse } from "next/server"
import { event, getFollowUpSession, projectSideEffectRecord, publicBaseUrl, publicSession, readSessionToken, saveFollowUpSession } from "@/lib/follow-up-demo"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { startDemoCall, validateTwilioCallConfig } from "@/lib/twilio-demo"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { getSideEffectsCollection, demoDb, getDemoTenantId } from "@/lib/firebase-admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!(await checkDurableRateLimit(`follow-up-call:${getClientIp(request)}`, 2, 24 * 60 * 60 * 1000, { failClosed: true }))) {
    return NextResponse.json({ ok: false, error: "The call demo limit has been reached." }, { status: 429 })
  }
  try {
    const body = await request.json() as { token?: string }
    const verified = readSessionToken(body.token)
    if (!verified) return NextResponse.json({ ok: false, error: "Invalid or expired demo session." }, { status: 401 })
    const session = await getFollowUpSession(verified.id)
    if (!session || !session.consentCall) return NextResponse.json({ ok: false, error: "Call consent is required for this demo." }, { status: 400 })
    if (!session.messages.some((item) => item.direction === "inbound")) {
      return NextResponse.json({ ok: false, error: "Reply to the demo SMS before starting a call." }, { status: 400 })
    }

    const baseUrl = publicBaseUrl(request)
    const twimlUrl = `${baseUrl}/api/follow-up-demo/twiml?token=${encodeURIComponent(body.token || "")}`
    const statusCallback = `${baseUrl}/api/follow-up-demo/twilio/status?sessionId=${encodeURIComponent(session.id)}&channel=call`

    const db = demoDb()
    const tenantId = getDemoTenantId()
    const sideEffectsRef = db ? getSideEffectsCollection(db, tenantId) : null
    const store = createSideEffectStore(db, sideEffectsRef)

    const effectId = deriveSideEffectId(session.id, 'callback-call')

    const outcome = await executeSideEffect(
      store,
      effectId,
      'callback-call',
      async () => {
        const res = await startDemoCall({ to: session.phone, twimlUrl, statusCallback })
        return { value: { status: res.status }, providerId: res.sid, providerMetadata: { from: res.from, status: res.status } }
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

    if (outcome.kind === "executed") {
      session.callbackCallSid = outcome.providerId
      session.callbackCallState = "started"
      session.events.push(event("call.started", "Demo call started", `Twilio call ${outcome.value.status}`, "call", "running"))
    } else if (outcome.kind === "already_completed" || outcome.kind === "already_dispatching") {
      projectSideEffectRecord(session, "callback-call", outcome.record)
    } else if (outcome.kind === "persistence_unavailable" || outcome.kind === "preflight_failed" || outcome.kind === "provider_rejected") {
      session.callbackCallState = "failed"
    } else {
      session.callbackCallState = "uncertain_after_dispatch"
    }

    await saveFollowUpSession(session)

    return NextResponse.json({ ok: true, session: publicSession(session) })
  } catch (error) {
    console.error("[follow-up-demo/call]", error)
    return NextResponse.json({ ok: false, error: "The demo call could not start." }, { status: 502 })
  }
}
