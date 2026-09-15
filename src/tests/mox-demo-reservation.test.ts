import { describe, expect, it } from "vitest"
import { getMoxAgent } from "@/lib/mox-agents"
import { createMoxDemoVoiceSessionToken, verifyMoxDemoVoiceSessionToken } from "@/lib/mox-demo/voice-session"
import {
  NON_LIMO_AGENT_IDS,
  validateAndBuildVerticalDemoReservation,
} from "@/lib/mox-demo/reservation"

function toolNames(agentId: string) {
  return (getMoxAgent(agentId).tools as Array<{ functionDeclarations?: Array<{ name?: string }> }>)
    .flatMap((group) => group.functionDeclarations || [])
    .map((tool) => tool.name)
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    agentId: "dental",
    sessionId: "moxv_test_session",
    tenantId: "volimox-demo",
    full_name: "Alex Example",
    email: "alex@example.com",
    phone: "+12025550123",
    requested_start_iso: "2026-08-28T15:00:00.000Z",
    time_zone: "America/New_York",
    service_summary: "Routine dental consultation",
    details: "New patient; routine cleaning; no urgency.",
    consent_sms: true,
    consent_email: true,
    last_customer_utterance: "Yes, please send it.",
    last_agent_utterance: "May I send this simulated confirmation by text message and email?",
    ...overrides,
  }
}

describe("non-Limo demo reservation flow", () => {
  it("advertises only the simulated reservation tool for every non-Limo agent", () => {
    for (const agentId of NON_LIMO_AGENT_IDS) {
      expect(toolNames(agentId)).toEqual(["create_demo_reservation"])
    }
    expect(toolNames("limo")).not.toContain("create_demo_reservation")
    expect(toolNames("limo")).not.toContain("capture_demo_contact")
  })

  it("requires an explicit answer to the confirmation question", () => {
    const missingQuestion = validateAndBuildVerticalDemoReservation(validInput({ last_agent_utterance: "What time works for you?" }), Date.parse("2026-08-27T12:00:00.000Z"))
    const ambiguousAnswer = validateAndBuildVerticalDemoReservation(validInput({ last_customer_utterance: "That sounds good." }), Date.parse("2026-08-27T12:00:00.000Z"))
    const missingConsent = validateAndBuildVerticalDemoReservation(validInput({ consent_email: false }), Date.parse("2026-08-27T12:00:00.000Z"))

    expect(missingQuestion.ok).toBe(false)
    expect(ambiguousAnswer.ok).toBe(false)
    expect(missingConsent.ok).toBe(false)
  })

  it("normalizes a valid request and derives the same id for a replay", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z")
    const first = validateAndBuildVerticalDemoReservation(validInput(), now)
    const replay = validateAndBuildVerticalDemoReservation(validInput(), now)

    expect(first.ok).toBe(true)
    expect(replay.ok).toBe(true)
    if (!first.ok || !replay.ok) return
    expect(first.record.id).toBe(replay.record.id)
    expect(first.record.simulation).toBe(true)
    expect(first.record.customer.phone).toBe("+12025550123")
    expect(first.record.status).toBe("demo_confirmed_partial")
  })

  it("rejects Limo, malformed contact data, and past times", () => {
    const now = Date.parse("2026-08-27T12:00:00.000Z")
    expect(validateAndBuildVerticalDemoReservation(validInput({ agentId: "limo" }), now).ok).toBe(false)
    expect(validateAndBuildVerticalDemoReservation(validInput({ email: "not-an-email" }), now).ok).toBe(false)
    expect(validateAndBuildVerticalDemoReservation(validInput({ requested_start_iso: "2026-08-27T11:59:00.000Z" }), now).ok).toBe(false)
  })

  it("signs a non-Limo voice session for the reservation route", () => {
    const token = createMoxDemoVoiceSessionToken("dental", "volimox-demo", 60)
    expect(verifyMoxDemoVoiceSessionToken(token, "dental")?.agentId).toBe("dental")
    expect(verifyMoxDemoVoiceSessionToken(token, "law")).toBeNull()
    expect(verifyMoxDemoVoiceSessionToken(`${token}x`, "dental")).toBeNull()
  })
})
