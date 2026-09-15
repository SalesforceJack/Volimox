import { beforeEach, describe, expect, it } from "vitest"
import { POST as postRunEvent } from "@/app/api/example-limo/run-event/route"
import { EXAMPLE_LIMO_PRICING_VERSION } from "@/lib/example-limo/config"
import {
  appendExampleLimoInteractionEvent,
  createExampleLimoRunId,
  createExampleLimoVoiceRun,
  readExampleLimoInteraction,
  readExampleLimoInteractionEvent,
  resetExampleLimoAuditMemoryForTests,
} from "@/lib/example-limo/store"
import { createExampleLimoVoiceSessionToken, verifyExampleLimoVoiceSessionToken } from "@/lib/example-limo/voice-session"

const tenantId = "audit-test-tenant"

beforeEach(() => {
  resetExampleLimoAuditMemoryForTests()
  delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  delete process.env.FIRESTORE_EMULATOR_HOST
})

async function createRun() {
  const id = createExampleLimoRunId()
  return createExampleLimoVoiceRun({
    id,
    tenantId,
    metadata: {
      agentId: "limo",
      model: "gemini-test-live",
      provider: "gemini_live",
      providerMode: "simulate",
      pricingVersion: EXAMPLE_LIMO_PRICING_VERSION,
      sessionExpiresAt: "2026-07-27T16:10:00.000Z",
    },
    createdAt: "2026-07-27T16:00:00.000Z",
  })
}

describe("Example Limo durable voice run audit", () => {
  it("creates a public run ID and binds it to a signed voice session", async () => {
    const run = await createRun()
    const token = createExampleLimoVoiceSessionToken("limo", tenantId, 900, { runId: run.id })
    const verified = verifyExampleLimoVoiceSessionToken(token, "limo")
    expect(run.id).toMatch(/^elv_[a-z0-9]{24}$/)
    expect(verified?.runId).toBe(run.id)
    expect(verified?.tenantId).toBe(tenantId)
    const refreshedToken = createExampleLimoVoiceSessionToken("limo", tenantId, 900, {
      runId: run.id,
      sessionId: verified?.id,
    })
    expect(verifyExampleLimoVoiceSessionToken(refreshedToken, "limo")?.id).toBe(verified?.id)
    expect((await readExampleLimoInteraction(run.id, tenantId))?.lastEventSequence).toBe(0)
  })

  it("persists bounded ordered events and treats an identical event ID as idempotent", async () => {
    const run = await createRun()
    const event = {
      id: "evt_turn_000001",
      runId: run.id,
      tenantId,
      sequence: 1,
      type: "transcript_final" as const,
      source: "server" as const,
      occurredAt: "2026-07-27T16:00:02.000Z",
      receivedAt: "2026-07-27T16:00:03.000Z",
      payload: { role: "customer", text: "105 Osprey Court" },
    }
    expect((await appendExampleLimoInteractionEvent(event)).idempotent).toBe(false)
    expect((await appendExampleLimoInteractionEvent(event)).idempotent).toBe(true)
    expect((await readExampleLimoInteractionEvent(run.id, event.id, tenantId))?.payload?.text).toBe("105 Osprey Court")
    expect((await readExampleLimoInteraction(run.id, tenantId))?.eventCount).toBe(1)
    await expect(appendExampleLimoInteractionEvent({ ...event, id: "evt_turn_000003", sequence: 3 })).rejects.toThrow("sequence must be 2")
  })

  it("requires the signed token/run pairing and redacts client secrets", async () => {
    const run = await createRun()
    const token = createExampleLimoVoiceSessionToken("limo", tenantId, 900, { runId: run.id })
    const response = await postRunEvent(new Request("http://localhost/api/example-limo/run-event", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-example-limo-voice-session": token },
      body: JSON.stringify({
        runId: run.id,
        eventId: "evt_client_000001",
        sequence: 1,
        eventType: "tool_completed",
        payload: { toolName: "get_example_limo_quote", apiKey: "must-not-persist", result: { amount: 155 } },
      }),
    }))
    expect(response.status).toBe(200)
    const stored = await readExampleLimoInteractionEvent(run.id, "evt_client_000001", tenantId)
    expect(stored?.source).toBe("client_observed")
    expect(stored?.payload?.apiKey).toBe("[redacted]")

    const rejected = await postRunEvent(new Request("http://localhost/api/example-limo/run-event", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-example-limo-voice-session": token },
      body: JSON.stringify({ runId: createExampleLimoRunId(), eventId: "evt_client_000002", sequence: 2, eventType: "error" }),
    }))
    expect(rejected.status).toBe(409)
  })
})
