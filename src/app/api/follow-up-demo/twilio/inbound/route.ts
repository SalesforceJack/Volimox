import { findLatestSessionByPhone } from "@/lib/follow-up-demo"
import { processInboundDemoSms } from "@/lib/follow-up-demo-processor"
import { verifyTwilioSignature } from "@/lib/twilio-demo"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const raw = await request.text()
  const params = new URLSearchParams(raw)
  if (!verifyTwilioSignature(request, params)) return new Response("Invalid signature", { status: 403 })
  const session = await findLatestSessionByPhone(params.get("From"))
  const body = params.get("Body") || ""
  if (session && body) await processInboundDemoSms(session, body, params.get("MessageSid") || undefined, request)
  return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", { headers: { "Content-Type": "text/xml" } })
}
