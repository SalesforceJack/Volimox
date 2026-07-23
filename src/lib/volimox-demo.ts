import crypto from "node:crypto"

const METERS_PER_MILE = 1609.344

type DemoQuote = {
  distanceMiles: number
  durationMinutes: number
  estimatedValueUsd: number
  pickupAddress: string
  destinationAddress: string
}

type DemoTokenPayload = {
  id: string
  exp: number
  distanceMiles: number
  durationMinutes: number
  estimatedValueUsd: number
  reservationId?: string
}

function getMapsKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ""
}

function getLinkSecret() {
  const secret = process.env.VOLIMOX_DEMO_LINK_SECRET?.trim()
  if (!secret) throw new Error("Volimox demo link signing is not configured.")
  return secret
}

function asText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/[\r\n]+/g, " ").slice(0, maxLength) : ""
}

function asCount(value: unknown, minimum: number, maximum: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const normalized = Math.trunc(number)
  return normalized >= minimum && normalized <= maximum ? normalized : null
}

export function normalizeDemoRoute(body: Record<string, unknown>) {
  const pickup = asText(body.pickup_address, 240)
  const destination = asText(body.destination_address, 240)
  const passengers = asCount(body.passenger_count, 1, 80)

  if (!pickup || !destination || passengers === null) return null
  return { pickup, destination, passengers }
}

export async function buildGlobalDemoQuote(input: { pickup: string; destination: string; passengers: number }): Promise<DemoQuote> {
  const apiKey = getMapsKey()
  if (!apiKey) throw new Error("Google Routes is not configured.")

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: { address: input.pickup },
      destination: { address: input.destination },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      units: "IMPERIAL",
    }),
    cache: "no-store",
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.routes?.[0]?.distanceMeters) {
    throw new Error(payload?.error?.message || "Google Routes could not resolve that trip.")
  }

  const distanceMiles = Math.round((Number(payload.routes[0].distanceMeters) / METERS_PER_MILE) * 10) / 10
  const durationSeconds = Number(String(payload.routes[0].duration || "0s").replace("s", ""))
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60))
  const base = Number(process.env.VOLIMOX_DEMO_BASE_RATE || 36)
  const perMile = Number(process.env.VOLIMOX_DEMO_PER_MILE_RATE || 3.25)
  const passengerAdjustment = Math.max(0, input.passengers - 1) * 8
  const estimatedValueUsd = Math.round((base + distanceMiles * perMile + passengerAdjustment) * 100) / 100

  return {
    distanceMiles,
    durationMinutes,
    estimatedValueUsd,
    pickupAddress: input.pickup,
    destinationAddress: input.destination,
  }
}

export function createDemoToken(quote: Pick<DemoQuote, "distanceMiles" | "durationMinutes" | "estimatedValueUsd"> & {
  reservationId?: string
  tokenId?: string
  expiresAt?: number
}) {
  const { tokenId, expiresAt, ...tokenQuote } = quote
  const payload: DemoTokenPayload = {
    id: tokenId || crypto.randomUUID(),
    exp: expiresAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
    ...tokenQuote,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto.createHmac("sha256", getLinkSecret()).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

export function createQuoteFingerprint(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify({ ...payload, issuedAt: new Date().toISOString() })).toString("base64url")
  const signature = crypto.createHmac("sha256", getLinkSecret()).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

export function readQuoteFingerprint(value: string) {
  const [encoded, signature] = value.split(".")
  if (!encoded || !signature) return null
  const expected = crypto.createHmac("sha256", getLinkSecret()).update(encoded).digest("base64url")
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>
    // Validate fingerprint age — reject fingerprints older than 2 hours
    const MAX_FINGERPRINT_AGE_MS = 2 * 60 * 60 * 1000
    if (typeof parsed.issuedAt === "string") {
      const issuedAt = new Date(parsed.issuedAt).getTime()
      if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_FINGERPRINT_AGE_MS) return null
    }
    // Validate passenger count bounds
    if ("passengers" in parsed) {
      const p = Number(parsed.passengers)
      if (!Number.isFinite(p) || p < 1 || p > 80) return null
    }
    // Validate route field lengths
    if (typeof parsed.pickup === "string" && parsed.pickup.length > 240) return null
    if (typeof parsed.destination === "string" && parsed.destination.length > 240) return null
    return parsed
  } catch { return null }
}

export function readDemoToken(token: string): DemoTokenPayload | null {
  const [encoded, signature] = token.split(".")
  if (!encoded || !signature) return null

  const expected = crypto.createHmac("sha256", getLinkSecret()).update(encoded).digest("base64url")
  const valid = Buffer.byteLength(signature) === Buffer.byteLength(expected) && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!valid) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DemoTokenPayload
    if (!payload.id || !Number.isFinite(payload.exp) || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function normalizeDemoPhone(value: unknown) {
  const raw = asText(value, 32)
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length >= 8 && digits.length <= 15 && raw.startsWith("+")) return `+${digits}`
  return ""
}

export function validateDemoSmsConfig(): { configured: boolean; reasonCode?: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  const dedicatedFrom = process.env.VOLIMOX_DEMO_PHONE_NUMBER?.trim() || process.env.TWILIO_DEMO_PHONE_NUMBER?.trim()
  const from = dedicatedFrom || process.env.TWILIO_PHONE_NUMBER?.trim()
  if (!accountSid || !authToken) return { configured: false, reasonCode: "credentials_missing" }
  if (!messagingServiceSid && !from) return { configured: false, reasonCode: "sender_missing" }
  return { configured: true }
}

export async function sendDemoSms(phone: string, url: string): Promise<{ sent: true; messageSid: string } | { sent: false; reasonCode: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  const dedicatedFrom = process.env.VOLIMOX_DEMO_PHONE_NUMBER?.trim() || process.env.TWILIO_DEMO_PHONE_NUMBER?.trim()
  const from = dedicatedFrom || process.env.TWILIO_PHONE_NUMBER?.trim()

  if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
    return { sent: false, reasonCode: "not_configured" }
  }

  const form = new URLSearchParams({
    To: phone,
    Body: `Volimox live demo: see the operating workflow we prepared for your business: ${url}`,
    ...(messagingServiceSid ? { MessagingServiceSid: messagingServiceSid } : { From: from! }),
  })
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok && response.status >= 400 && response.status < 500) {
    return { sent: false, reasonCode: "provider_error" }
  }

  if (!response.ok) throw new Error("Twilio SMS request failed")

  if (!payload?.sid) {
    throw new Error("Twilio SMS response missing SID")
  }

  return { sent: true, messageSid: payload.sid }
}
