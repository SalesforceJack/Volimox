import { deterministicEvent, getFollowUpSession, projectSideEffectRecord, saveFollowUpSession, upsertEvent } from "@/lib/follow-up-demo"
import { verifyTwilioSignature } from "@/lib/twilio-demo"
import { triggerMissedCallRecovery } from "@/lib/follow-up-demo-processor"
import { createSideEffectStore, deriveSideEffectId } from "@/lib/side-effect-machine"
import { demoDb, getDemoTenantId, getSideEffectsCollection } from "@/lib/firebase-admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const raw = await request.text()
  const params = new URLSearchParams(raw)
  if (!verifyTwilioSignature(request, params)) return new Response("Invalid signature", { status: 403 })
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("sessionId") || ""
  const channel = url.searchParams.get("channel") === "call" ? "call" : "sms"
  const mode = url.searchParams.get("mode") || ""
  const session = await getFollowUpSession(sessionId)
  if (!session) return new Response("OK")

  if (channel === "sms") {
    const sid = params.get("MessageSid") || ""
    if (!sid) return new Response("OK")
    const status = params.get("MessageStatus") || "unknown"
    const knownMessage = session.messages.some((item) => item.sid === sid) || session.scheduledMessageSid === sid
    const db = demoDb()
    const store = db ? createSideEffectStore(db, getSideEffectsCollection(db, getDemoTenantId())) : null
    const recoveryRecord = store ? await store.get(deriveSideEffectId(session.id, "recovery-sms")) : null
    const scheduledRecord = store ? await store.get(deriveSideEffectId(session.id, "scheduled-follow-up-sms")) : null
    if (!knownMessage && recoveryRecord?.providerId !== sid && scheduledRecord?.providerId !== sid) return new Response("OK")
    if (recoveryRecord?.providerId === sid) projectSideEffectRecord(session, "recovery-sms", recoveryRecord)
    if (scheduledRecord?.providerId === sid) projectSideEffectRecord(session, "scheduled-follow-up-sms", scheduledRecord)
    session.messages = session.messages.map((item) => item.sid === sid ? { ...item, status } : item)
    if (["delivered", "undelivered", "failed"].includes(status)) {
      upsertEvent(session, deterministicEvent(`sms-status-${sid}-${status}`, `sms.${status}`, status === "delivered" ? "SMS delivered" : "SMS delivery failed", status === "delivered" ? "Confirmed by Twilio." : "Twilio reported a delivery failure.", "sms", status === "delivered" ? "completed" : "failed"))
    }
  } else {
    const sid = params.get("CallSid") || ""
    if (!sid) return new Response("OK")
    const db = demoDb()
    const store = db ? createSideEffectStore(db, getSideEffectsCollection(db, getDemoTenantId())) : null
    const initialCallRecord = store ? await store.get(deriveSideEffectId(session.id, "initial-call")) : null
    const callbackCallRecord = store ? await store.get(deriveSideEffectId(session.id, "callback-call")) : null
    const knownCall = session.twilioCallSid === sid || session.callbackCallSid === sid || initialCallRecord?.providerId === sid || callbackCallRecord?.providerId === sid
    if (!knownCall) return new Response("OK")
    if (initialCallRecord?.providerId === sid) projectSideEffectRecord(session, "initial-call", initialCallRecord)
    if (callbackCallRecord?.providerId === sid) projectSideEffectRecord(session, "callback-call", callbackCallRecord)
    const status = params.get("CallStatus") || "unknown"
    upsertEvent(session, deterministicEvent(`call-status-${sid}-${status}`, `call.${status}`, `Call ${status}`, "Live Twilio call status.", "call", status === "completed" ? "completed" : ["failed", "busy", "no-answer", "canceled"].includes(status) ? "failed" : "running"))
    if (mode === "missed-call" && ["busy", "no-answer", "canceled"].includes(status)) {
      await triggerMissedCallRecovery(session, request)
    }
  }
  await saveFollowUpSession(session)
  return new Response("OK")
}
