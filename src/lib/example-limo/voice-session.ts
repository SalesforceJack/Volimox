import crypto from "node:crypto"
import { getExampleLimoHmacSecret, getExampleLimoTenantId } from "./config"

export type ExampleLimoVoiceSessionPayload = {
  id: string
  runId: string
  agentId: string
  tenantId: string
  exp: number
}

export function createExampleLimoVoiceSessionToken(agentId: string, tenantId?: string, ttlSeconds = 15 * 60, options?: { runId?: string; sessionId?: string }) {
  const runId = options?.runId?.trim()
  if (!runId) throw new Error("A stable Example Limo run ID is required for a voice session token.")
  const sessionId = options?.sessionId?.trim() || crypto.randomUUID()
  const payload: ExampleLimoVoiceSessionPayload = { id: sessionId, runId, agentId, tenantId: getExampleLimoTenantId(tenantId), exp: Date.now() + ttlSeconds * 1000 }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto.createHmac("sha256", getExampleLimoHmacSecret()).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

export function verifyExampleLimoVoiceSessionToken(value: unknown, expectedAgentId = "limo") {
  if (typeof value !== "string") return null
  const [encoded, signature] = value.split(".")
  if (!encoded || !signature) return null
  const expected = crypto.createHmac("sha256", getExampleLimoHmacSecret()).update(encoded).digest("base64url")
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ExampleLimoVoiceSessionPayload
    if (payload.agentId !== expectedAgentId || payload.exp <= Date.now() || !payload.id || !/^elv_[a-z0-9]{12,64}$/.test(payload.runId)) return null
    return payload
  } catch {
    return null
  }
}
