import { beforeEach, describe, expect, it } from "vitest"
import { isExplicitPriceApproval } from "@/lib/example-limo/integrity-state"
import { completeExampleLimoSimulation } from "@/lib/example-limo/simulation"
import { readExampleLimoReviewNotification, resetExampleLimoStoreMemoryForTests, saveExampleLimoDispatchRequest, saveExampleLimoReservation, saveExampleLimoReviewNotification, exampleLimoMemoryStatsForTests } from "@/lib/example-limo/store"

const reservation = {
  id: "elr_fix_test",
  tenantId: "volimox-demo",
  quoteId: "elq_fix_test",
  status: "simulation_ready" as const,
  providerMode: "simulate" as const,
  vehicleName: "Luxury Sedan" as const,
  quotedTotalUsd: 125,
  quoteFingerprint: "fix-fingerprint",
  quoteIssuedAt: "2026-07-27T12:00:00.000Z",
  phone: "+12015550123",
  pickupAddress: "123 5th Avenue, New York, NY 10003",
  destinationAddress: "Empire State Building, New York, NY",
  departureTimeIso: "2026-07-28T21:00:00.000Z",
  passengerCount: 3,
  luggageCount: 2,
  serviceType: "point_to_point" as const,
  tripType: "round_trip" as const,
  createdAt: "2026-07-27T12:00:00.000Z",
  updatedAt: "2026-07-27T12:00:00.000Z",
}

describe("Example Limo hardening fixes", () => {
  beforeEach(() => resetExampleLimoStoreMemoryForTests())

  it("accepts clear bilingual price approval and rejects ambiguous changes", () => {
    expect(isExplicitPriceApproval("Yes, that's correct.")).toBe(true)
    expect(isExplicitPriceApproval("Yes, please send the link for the exact price.")).toBe(true)
    expect(isExplicitPriceApproval("Sí, apruebo ese precio exacto.")).toBe(true)
    expect(isExplicitPriceApproval("maybe")).toBe(false)
    expect(isExplicitPriceApproval("Yes, but change the vehicle.")).toBe(false)
    expect(isExplicitPriceApproval("Did you say yes?")).toBe(false)
    expect(isExplicitPriceApproval("Yes, send the SUV link.")).toBe(false)
  })

  it("completes simulation exactly once and never accepts live reservations", async () => {
    await saveExampleLimoReservation(reservation)
    const first = await completeExampleLimoSimulation(reservation.id)
    expect(first.idempotent).toBe(false)
    expect(first.reservation.status).toBe("paid")
    const second = await completeExampleLimoSimulation(reservation.id)
    expect(second.idempotent).toBe(true)
    await saveExampleLimoReservation({ ...reservation, id: "elr_live_fix_test", providerMode: "live" as const })
    await expect(completeExampleLimoSimulation("elr_live_fix_test")).rejects.toThrow("unavailable for live")
  })

  it("clears all development memory stores between runs", () => {
    expect(exampleLimoMemoryStatsForTests()).toEqual({ quotes: 0, reservations: 0, interactions: 0, runs: 0, dispatchRequests: 0, reviewNotifications: 0 })
  })

  it("keeps dispatch records idempotent and development memory bounded", async () => {
    const dispatch = { id: "eld_same", tenantId: "volimox-demo", runId: "elv_123456789012", voiceSessionId: "voice-1", kind: "dispatch_callback_request" as const, phoneLastFour: "0123", serviceSummary: "Needs a larger vehicle", providerMode: "simulate" as const, createdAt: new Date().toISOString() }
    await saveExampleLimoDispatchRequest(dispatch)
    await saveExampleLimoDispatchRequest({ ...dispatch, serviceSummary: "same request replay" })
    expect(exampleLimoMemoryStatsForTests().dispatchRequests).toBe(1)
    for (let index = 0; index < 520; index += 1) await saveExampleLimoReservation({ ...reservation, id: `elr_bound_${index}` })
    expect(exampleLimoMemoryStatsForTests().reservations).toBeLessThanOrEqual(500)
  })

  it("stores review notifications under the tenant and replays the same record", async () => {
    const notification = { id: "eln_review", tenantId: "volimox-demo", reservationId: reservation.id, quoteFingerprint: reservation.quoteFingerprint, vehicleName: reservation.vehicleName, quotedTotalUsd: reservation.quotedTotalUsd, departureTimeIso: reservation.departureTimeIso, phoneLastFour: "0123", reason: "review_window" as const, status: "open" as const, createdAt: reservation.createdAt }
    await saveExampleLimoReviewNotification(notification)
    await saveExampleLimoReviewNotification(notification)
    expect(await readExampleLimoReviewNotification(notification.id, notification.tenantId)).toMatchObject(notification)
    expect(await readExampleLimoReviewNotification(notification.id, "other-tenant")).toBeNull()
  })
})
