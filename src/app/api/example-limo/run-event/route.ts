import { NextResponse } from "next/server"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { appendExampleLimoInteractionEvent } from "@/lib/example-limo/store"
import { verifyExampleLimoVoiceSessionToken } from "@/lib/example-limo/voice-session"
import type { ExampleLimoInteractionEventType } from "@/lib/example-limo/types"

export const runtime = "nodejs"

const EVENT_TYPES = new Set<ExampleLimoInteractionEventType>([
  "transcript_draft",
  "transcript_final",
  "lifecycle_connected",
  "lifecycle_goaway",
  "lifecycle_resume_started",
  "lifecycle_resume_succeeded",
  "lifecycle_resume_failed",
  "lifecycle_closed",
  "tool_requested",
  "tool_completed",
  "tool_failed",
  "error",
])

const SECRET_KEY = /(?:api[_-]?key|authorization|credential|password|private[_-]?key|secret|token|resume[_-]?handle|^handle$|twilio.*(?:auth|token)|stripe.*(?:secret|key))/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function cleanEventId(value: unknown) {
  return typeof value === "string" && /^evt_[a-zA-Z0-9_-]{6,96}$/.test(value) ? value : ""
}

function cleanRunId(value: unknown) {
  return typeof value === "string" && /^elv_[a-z0-9]{12,64}$/.test(value) ? value : ""
}

function cleanOccurredAt(value: unknown) {
  if (typeof value !== "string" || value.length > 80 || !Number.isFinite(Date.parse(value))) return new Date().toISOString()
  return new Date(value).toISOString()
}

/** Remove credentials and bound all client-supplied audit payloads before persistence. */
function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]"
  if (typeof value === "string") return value.slice(0, 6000)
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "boolean" || value === null) return value
  if (Array.isArray(value)) return value.slice(0, 32).map((entry) => sanitizeAuditValue(entry, depth + 1))
  if (!isRecord(value)) return null
  const output: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value).slice(0, 40)) {
    output[key.slice(0, 100)] = SECRET_KEY.test(key) ? "[redacted]" : sanitizeAuditValue(nested, depth + 1)
  }
  return output
}

function clientEventFromBody(body: Record<string, unknown>, session: NonNullable<ReturnType<typeof verifyExampleLimoVoiceSessionToken>>) {
  const runId = cleanRunId(body.runId)
  if (!runId || runId !== session.runId) throw new Error("The run ID does not match this Example Limo voice session.")
  const id = cleanEventId(body.eventId)
  if (!id) throw new Error("A stable Example Limo event ID is required.")
  const sequence = Number(body.sequence)
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 1_000_000) throw new Error("Example Limo event sequence must be a positive integer.")
  const type = typeof body.eventType === "string" && EVENT_TYPES.has(body.eventType as ExampleLimoInteractionEventType)
    ? body.eventType as ExampleLimoInteractionEventType
    : null
  if (!type) throw new Error("Example Limo event type is invalid.")
  const sanitizedPayload = body.payload === undefined ? undefined : sanitizeAuditValue(body.payload)
  if (sanitizedPayload !== undefined && !isRecord(sanitizedPayload)) throw new Error("Example Limo event payload must be an object.")
  const payload = sanitizedPayload as Record<string, unknown> | undefined
  return {
    id,
    runId,
    tenantId: session.tenantId,
    sequence,
    type,
    source: "client_observed" as const,
    occurredAt: cleanOccurredAt(body.occurredAt),
    receivedAt: new Date().toISOString(),
    payload,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!isRecord(body)) return NextResponse.json({ ok: false, error: "A JSON audit event is required." }, { status: 400 })
    const rawToken = request.headers.get("x-example-limo-voice-session") || body.voiceSessionToken
    const session = verifyExampleLimoVoiceSessionToken(rawToken, "limo")
    if (!session) return NextResponse.json({ ok: false, error: "A valid Example Limo voice session is required." }, { status: 401 })
    if (!(await checkDurableRateLimit(`example-limo-run-event:${session.id}`, 180, 60 * 60 * 1000, { failClosed: true }))) {
      return NextResponse.json({ ok: false, error: "This Example Limo voice session has reached its audit event limit." }, { status: 429 })
    }
    const event = clientEventFromBody(body, session)
    const result = await appendExampleLimoInteractionEvent(event)
    return NextResponse.json({ ok: true, runId: event.runId, eventId: result.event.id, sequence: result.event.sequence, idempotent: result.idempotent })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Example Limo audit event could not be recorded."
    const status = /sequence|reused|does not match/i.test(message) ? 409 : /not found|required|invalid|must be/i.test(message) ? 400 : 503
    if (status >= 500) console.error("[example-limo/run-event]", message.slice(0, 300))
    return NextResponse.json({ ok: false, error: status >= 500 ? "Example Limo audit storage is unavailable." : message }, { status })
  }
}
