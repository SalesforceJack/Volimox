import assert from "node:assert/strict"
import { logEvent, redactForLog } from "../lib/observability.js"
import { requestIdFrom } from "../lib/request-id.js"

const originalInfo = console.info

try {
  let line = ""
  console.info = ((value?: unknown) => {
    line = String(value)
  }) as typeof console.info

  logEvent("info", "test.event", {
    requestId: "req-123",
    authorization: "Bearer do-not-log",
    email: "customer@example.com",
    nested: { password: "PLACEHOLDER_VALUE" },
  })

  assert.match(line, /"event":"test\.event"/)
  assert.match(line, /"requestId":"req-123"/)
  assert.match(line, /\[REDACTED\]/)
  assert.doesNotMatch(line, /PLACEHOLDER_VALUE/)
  assert.doesNotMatch(line, /customer@example\.com/)

  const error = new Error("provider unavailable: Bearer top-secret-token")
  Object.assign(error, { code: "ETIMEDOUT", secret: "do-not-log" })
  const redacted = redactForLog({ error }) as { error: Record<string, unknown> }
  assert.deepEqual(redacted.error, { name: "Error", message: "provider unavailable: [REDACTED]", code: "ETIMEDOUT" })

  const redactedPayload = redactForLog({
    customer_email: "customer@example.com",
    customerEmail: "customer@example.com",
    pickup_address: "1 Main Street",
    pickupAddress: "1 Main Street",
    destination_address: "JFK Airport",
    passenger_phone: "+1 555 0100",
    nested: [{ passengerEmail: "passenger@example.com" }],
    requestId: "req-123",
    eventId: "evt-123",
    paymentIntentId: "pi-123",
    bookingId: "booking-123",
    providerRequestId: "provider-123",
    emailEnabled: true,
    addressVerified: true,
    phoneRetryCount: 2,
  }) as Record<string, unknown>
  assert.equal(redactedPayload.customer_email, "[REDACTED]")
  assert.equal(redactedPayload.customerEmail, "[REDACTED]")
  assert.equal(redactedPayload.pickup_address, "[REDACTED]")
  assert.equal(redactedPayload.pickupAddress, "[REDACTED]")
  assert.equal(redactedPayload.destination_address, "[REDACTED]")
  assert.equal(redactedPayload.passenger_phone, "[REDACTED]")
  assert.deepEqual(redactedPayload.nested, [{ passengerEmail: "[REDACTED]" }])
  assert.equal(redactedPayload.requestId, "req-123")
  assert.equal(redactedPayload.eventId, "evt-123")
  assert.equal(redactedPayload.paymentIntentId, "pi-123")
  assert.equal(redactedPayload.bookingId, "booking-123")
  assert.equal(redactedPayload.providerRequestId, "provider-123")
  assert.equal(redactedPayload.emailEnabled, true)
  assert.equal(redactedPayload.addressVerified, true)
  assert.equal(redactedPayload.phoneRetryCount, 2)

  assert.equal(requestIdFrom(new Headers({ "x-request-id": "req-123" })), "req-123")
  assert.notEqual(requestIdFrom(new Headers({ "x-request-id": "contains spaces" })), "contains spaces")

  console.log("Observability tests: 2 passed")
} finally {
  console.info = originalInfo
}
