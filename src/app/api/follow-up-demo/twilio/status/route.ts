import { getFollowUpSession, event, saveFollowUpSession } from "@/lib/follow-up-demo"
import { verifyTwilioSignature } from "@/lib/twilio-demo"
import { triggerMissedCallRecovery } from "@/lib/follow-up-demo-processor"

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
    const status = params.get("MessageStatus") || "unknown"
    session.messages = session.messages.map((item) => item.sid === sid ? { ...item, status } : item)
    if (["delivered", "undelivered", "failed"].includes(status)) {
      session.events.push(event(`sms.${status}`, status === "delivered" ? "SMS delivered" : "SMS delivery failed", status === "delivered" ? "Confirmed by Twilio" : params.get("ErrorMessage") || status, "sms", status === "delivered" ? "completed" : "failed"))
    }
  } else {
    const status = params.get("CallStatus") || "unknown"
    session.events.push(event(`call.${status}`, `Call ${status}`, "Live Twilio call status", "call", status === "completed" ? "completed" : ["failed", "busy", "no-answer", "canceled"].includes(status) ? "failed" : "running"))
    if (mode === "missed-call" && ["busy", "no-answer", "canceled"].includes(status) && !session.messages.some((item) => item.direction === "outbound")) {
      await triggerMissedCallRecovery(session, request)
    }
  }
  await saveFollowUpSession(session)
  return new Response("OK")
}
