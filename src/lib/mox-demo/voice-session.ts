import crypto from "node:crypto"
import { getDemoTenantId } from "@/lib/firebase-admin"

export type MoxDemoVoiceSessionPayload = {
  id: string
  agentId: string
  tenantId: string
  exp: number
}

function getMoxDemoVoiceHmacSecret() {
  const secret = process.env.MOX_DEMO_VOICE_HMAC_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === "production") throw new Error("MOX_DEMO_VOICE_HMAC_SECRET is required in production.")
  return "volimox-development-mox-demo-voice-secret"
}

export function createMoxDemoVoiceSessionToken(agentId: string, tenantId?: string, ttlSeconds = 15 * 60) {
  const payload: MoxDemoVoiceSessionPayload = {
    id: `moxv_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
    agentId,
    tenantId: tenantId?.trim() || getDemoTenantId(),
    exp: Date.now() + ttlSeconds * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto.createHmac("sha256", getMoxDemoVoiceHmacSecret()).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

export function verifyMoxDemoVoiceSessionToken(value: unknown, expectedAgentId: string) {
  if (typeof value !== "string") return null
  const [encoded, signature] = value.split(".")
  if (!encoded || !signature) return null
  const expected = crypto.createHmac("sha256", getMoxDemoVoiceHmacSecret()).update(encoded).digest("base64url")
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as MoxDemoVoiceSessionPayload
    if (
      payload.agentId !== expectedAgentId
      || payload.exp <= Date.now()
      || !payload.tenantId
      || !/^moxv_[a-z0-9]{24}$/.test(payload.id)
    ) return null
    return payload
  } catch {
    return null
  }
}
