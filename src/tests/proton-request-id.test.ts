import assert from "node:assert/strict"
import { POST as postQuote } from "../app/api/proton/quote/route"

const originalFetch = globalThis.fetch
const originalBaseUrl = process.env.PROTON_API_BASE_URL
const originalApiKey = process.env.PROTON_API_KEY

const quotePayload = {
  pickup_address: "1 Main Street, New York, NY",
  destination_address: "JFK Airport",
  departure_time_iso: "2030-01-01T12:00:00Z",
  passenger_count: 1,
  luggage_count: 0,
}

async function run() {
  process.env.PROTON_API_BASE_URL = "https://proton.example.test"
  process.env.PROTON_API_KEY = "test-proton-key"

  let capturedHeaders = new Headers()
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers)
    return new Response(JSON.stringify({ ok: true, quote: { amount: 100 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch

  const preservedResponse = await postQuote(new Request("http://localhost/api/proton/quote", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.10",
      "x-request-id": "vol-req-123",
    },
    body: JSON.stringify(quotePayload),
  }))
  assert.equal(preservedResponse.status, 200)
  assert.equal(preservedResponse.headers.get("x-request-id"), "vol-req-123")
  assert.equal(capturedHeaders.get("x-request-id"), "vol-req-123")
  assert.equal(capturedHeaders.get("authorization"), "Bearer test-proton-key")
  assert.equal(capturedHeaders.get("x-proton-integration-secret"), "test-proton-key")
  assert.equal(capturedHeaders.get("content-type"), "application/json")

  const invalidResponse = await postQuote(new Request("http://localhost/api/proton/quote", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.11",
      "x-request-id": "invalid request id",
    },
    body: JSON.stringify(quotePayload),
  }))
  const generatedInvalidRequestId = invalidResponse.headers.get("x-request-id") || ""
  assert.match(generatedInvalidRequestId, /^[A-Za-z0-9._:-]{1,128}$/)
  assert.notEqual(generatedInvalidRequestId, "invalid request id")
  assert.equal(capturedHeaders.get("x-request-id"), generatedInvalidRequestId)

  const missingResponse = await postQuote(new Request("http://localhost/api/proton/quote", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.12",
    },
    body: JSON.stringify(quotePayload),
  }))
  const generatedMissingRequestId = missingResponse.headers.get("x-request-id") || ""
  assert.match(generatedMissingRequestId, /^[A-Za-z0-9._:-]{1,128}$/)
  assert.equal(capturedHeaders.get("x-request-id"), generatedMissingRequestId)

  console.log("Proton request ID propagation tests: preserved, invalid/missing generation, outbound forwarding, and auth headers passed")
}

run().finally(() => {
  globalThis.fetch = originalFetch
  if (originalBaseUrl === undefined) delete process.env.PROTON_API_BASE_URL
  else process.env.PROTON_API_BASE_URL = originalBaseUrl
  if (originalApiKey === undefined) delete process.env.PROTON_API_KEY
  else process.env.PROTON_API_KEY = originalApiKey
})
