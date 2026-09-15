import { describe, expect, it } from "vitest"
import {
  createLiveTranscriptDeduplicationState,
  shouldAcceptFinalTranscript,
} from "@/lib/live-transcript"

describe("live transcript final event deduplication", () => {
  it("accepts one final event for an updated/completed/done sequence", () => {
    const state = createLiveTranscriptDeduplicationState()

    expect(shouldAcceptFinalTranscript({ state, role: "user", itemId: "item-1", text: "Hello Diane" })).toBe(true)
    expect(shouldAcceptFinalTranscript({ state, role: "user", itemId: "item-1", text: "Hello Diane", now: 1000 })).toBe(false)
    expect(shouldAcceptFinalTranscript({ state, role: "user", itemId: "item-1", text: "Hello Diane", now: 2000 })).toBe(false)
  })

  it("deduplicates final text when the provider omits an item id", () => {
    const state = createLiveTranscriptDeduplicationState()

    expect(shouldAcceptFinalTranscript({ state, role: "user", text: "I need an appointment", now: 1000 })).toBe(true)
    expect(shouldAcceptFinalTranscript({ state, role: "user", text: "I need an appointment", now: 2000 })).toBe(false)
    expect(shouldAcceptFinalTranscript({ state, role: "user", text: "I need an appointment", now: 7001 })).toBe(true)
  })

  it("does not collapse separate roles or separate provider items", () => {
    const state = createLiveTranscriptDeduplicationState()

    expect(shouldAcceptFinalTranscript({ state, role: "user", itemId: "user-1", text: "Thanks" })).toBe(true)
    expect(shouldAcceptFinalTranscript({ state, role: "agent", itemId: "agent-1", text: "Thanks" })).toBe(true)
    expect(shouldAcceptFinalTranscript({ state, role: "user", itemId: "user-2", text: "Thanks" })).toBe(true)
  })
})
