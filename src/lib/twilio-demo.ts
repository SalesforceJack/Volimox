import crypto from "node:crypto"
import { ProviderRejectedError } from "@/lib/side-effect-machine"

function credentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  const dedicatedFrom = process.env.VOLIMOX_DEMO_PHONE_NUMBER?.trim() || process.env.TWILIO_DEMO_PHONE_NUMBER?.trim() || ""
  const from = dedicatedFrom || process.env.TWILIO_PHONE_NUMBER?.trim()
  if (!accountSid || !authToken) throw new Error("Twilio is not configured.")
  return { accountSid, authToken, messagingServiceSid, from, dedicatedFrom: Boolean(dedicatedFrom) }
}

export function validateTwilioConfig(): { configured: boolean; reasonCode?: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  const dedicatedFrom = process.env.VOLIMOX_DEMO_PHONE_NUMBER?.trim() || process.env.TWILIO_DEMO_PHONE_NUMBER?.trim() || ""
  const from = dedicatedFrom || process.env.TWILIO_PHONE_NUMBER?.trim()

  if (!accountSid || !authToken) return { configured: false, reasonCode: "credentials_missing" }
  if (!messagingServiceSid && !from) return { configured: false, reasonCode: "sender_missing" }
  return { configured: true }
}

export function validateTwilioCallConfig(): { configured: boolean; reasonCode?: string } {
  const base = validateTwilioConfig()
  if (!base.configured) return base
  const dedicatedFrom = process.env.VOLIMOX_DEMO_PHONE_NUMBER?.trim() || process.env.TWILIO_DEMO_PHONE_NUMBER?.trim()
  const from = dedicatedFrom || process.env.TWILIO_PHONE_NUMBER?.trim()
  return from ? { configured: true } : { configured: false, reasonCode: "sender_missing" }
}

async function twilioRequest(path: string, form: URLSearchParams) {
  const { accountSid, authToken } = credentials()
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new ProviderRejectedError(`twilio_${response.status}`)
    }
    throw new Error(payload?.message || "Twilio request failed.")
  }
  return payload as Record<string, unknown>
}

export async function sendFollowUpSms(input: { to: string; body: string; statusCallback: string; scheduleAt?: Date }) {
  const { messagingServiceSid, from, dedicatedFrom } = credentials()
  if (!messagingServiceSid && !from) throw new Error("A Twilio sender is not configured.")
  const useMessagingService = Boolean(messagingServiceSid && !dedicatedFrom)
  const form = new URLSearchParams({
    To: input.to,
    Body: input.body,
    StatusCallback: input.statusCallback,
    ...(useMessagingService ? { MessagingServiceSid: messagingServiceSid! } : { From: from! }),
  })
  if (input.scheduleAt && useMessagingService) {
    form.set("ScheduleType", "fixed")
    form.set("SendAt", input.scheduleAt.toISOString())
  }
  const payload = await twilioRequest("Messages.json", form)
  const sid = String(payload.sid || "")
  if (!sid) throw new Error("Twilio message response missing SID")
  return { sid, status: String(payload.status || "queued"), from: String(payload.from || from || "") }
}

export async function listInboundSms(input: { from: string; to: string; createdAfter: string }) {
  const { accountSid, authToken } = credentials()
  if (!input.to) return []
  const query = new URLSearchParams({ From: input.from, To: input.to, PageSize: "20" })
  query.set("DateSent>=", input.createdAfter.slice(0, 10))
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?${query}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.message || "Twilio message sync failed.")
  return (Array.isArray(payload?.messages) ? payload.messages : [])
    .map((item: Record<string, unknown>) => ({
      sid: String(item.sid || ""),
      body: String(item.body || ""),
      createdAt: String(item.date_created || item.date_sent || ""),
    }))
    .filter((item: { sid: string; body: string; createdAt: string }) => item.sid && item.body && new Date(item.createdAt).getTime() >= new Date(input.createdAfter).getTime())
    .sort((left: { createdAt: string }, right: { createdAt: string }) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}

export async function cancelScheduledSms(sid: string) {
  if (!sid) return
  await twilioRequest(`Messages/${encodeURIComponent(sid)}.json`, new URLSearchParams({ Status: "canceled" }))
}

export async function startDemoCall(input: { to: string; twimlUrl: string; statusCallback: string; machineDetection?: "Enable" | "DetectMessageEnd" }) {
  const { from } = credentials()
  if (!from) throw new Error("TWILIO_PHONE_NUMBER is required for demo calls.")
  const payload = await twilioRequest("Calls.json", new URLSearchParams({
    To: input.to,
    From: from,
    Url: input.twimlUrl,
    Method: "POST",
    StatusCallback: input.statusCallback,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "initiated ringing answered completed",
    ...(input.machineDetection ? {
      MachineDetection: input.machineDetection,
      MachineDetectionTimeout: "10",
    } : {}),
    Timeout: "20",
  }))
  const sid = String(payload.sid || "")
  if (!sid) throw new Error("Twilio call response missing SID")
  return { sid, status: String(payload.status || "queued"), from: String(payload.from || from || "") }
}

export async function getDemoCallStatus(sid: string) {
  const { accountSid, authToken } = credentials()
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${encodeURIComponent(sid)}.json`, {
    headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.message || "Twilio call status could not be read.")
  return { status: String(payload?.status || "unknown"), answeredBy: String(payload?.answered_by || "") }
}

export function verifyTwilioSignature(request: Request, params: URLSearchParams) {
  if (process.env.NODE_ENV !== "production" && !request.headers.get("x-twilio-signature")) return true
  const signature = request.headers.get("x-twilio-signature") || ""
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!signature || !authToken) return false
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const parsed = new URL(request.url)
  const url = forwardedHost ? `${forwardedProto || parsed.protocol.replace(":", "")}://${forwardedHost}${parsed.pathname}${parsed.search}` : request.url
  const sorted = [...params.entries()].sort(([left], [right]) => left.localeCompare(right))
  const payload = sorted.reduce((value, [key, item]) => `${value}${key}${item}`, url)
  const expected = crypto.createHmac("sha1", authToken).update(payload).digest("base64")
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
