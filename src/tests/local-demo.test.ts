import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isLocalDemoExternalConfigurationKey } from "@/lib/local-demo"
import type { ExampleLimoQuoteRequest, ExampleLimoQuoteResponse } from "@/lib/example-limo/types"

const URL = "http://127.0.0.1:3002/api/example-limo/simulation"
let api: typeof import("@/app/api/example-limo/simulation/route")
let network: ReturnType<typeof vi.fn>

function trip(overrides: Partial<ExampleLimoQuoteRequest> = {}): ExampleLimoQuoteRequest {
  return {
    pickup_address: "123 5th Avenue, New York, NY 10003",
    destination_address: "Newark Liberty International Airport, Newark, NJ",
    departure_time_iso: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    passenger_count: 2, luggage_count: 2, phone: "+12025550123",
    service_type: "airport_departure", trip_type: "one_way", ...overrides,
  }
}

async function post(body: Record<string, unknown>, options?: { url?: string; headers?: Record<string, string> }) {
  const response = await api.POST(new Request(options?.url || URL, {
    method: "POST", headers: { "content-type": "application/json", origin: "http://127.0.0.1:3002", ...options?.headers }, body: JSON.stringify(body),
  }))
  return { status: response.status, body: await response.json() }
}

async function start() {
  const result = await post({ action: "start" })
  expect(result.status).toBe(200)
  return result.body.sessionToken as string
}

async function quote(sessionToken: string, input = trip()) {
  const result = await post({ action: "quote", sessionToken, trip: input })
  expect(result.status).toBe(200)
  return result.body.quote as ExampleLimoQuoteResponse
}

async function select(sessionToken: string, quoteId: string, vehicleName = "Luxury Sedan") {
  const result = await post({ action: "select_vehicle", sessionToken, quoteId, vehicleName })
  expect(result.status).toBe(200)
  return result.body.approvalIntentToken as string
}

async function checkout(sessionToken: string, quoteId: string, approvalIntentToken: string, extra: Record<string, unknown> = {}) {
  return post({ action: "create_checkout", sessionToken, quoteId, vehicleName: "Luxury Sedan", approvalIntentToken, approved: true, ...extra })
}

describe("isolated local Example Limo walkthrough", () => {
  beforeEach(async () => {
    vi.resetModules()
    for (const name of Object.keys(process.env)) if (isLocalDemoExternalConfigurationKey(name)) vi.stubEnv(name, "")
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("VOLIMOX_LOCAL_DEMO", "true")
    vi.stubEnv("EXAMPLE_LIMO_PROVIDER_MODE", "simulate")
    vi.stubEnv("EXAMPLE_LIMO_USE_PROTON_CREDENTIALS", "false")
    network = vi.fn(async () => { throw new Error("Unexpected network access") })
    vi.stubGlobal("fetch", network)
    api = await import("@/app/api/example-limo/simulation/route")
  })

  afterEach(() => {
    expect(network).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("reports readiness without creating demo data", async () => {
    const response = await api.GET(new Request(URL))
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({ ok: true, enabled: true, mode: "local-simulation" })
    const { exampleLimoMemoryStatsForTests } = await import("@/lib/example-limo/store")
    expect(exampleLimoMemoryStatsForTests()).toMatchObject({ quotes: 0, reservations: 0, interactions: 0 })
  })

  it.each([
    ["NODE_ENV", "production", 404],
    ["VOLIMOX_LOCAL_DEMO", "false", 404],
    ["VOLIMOX_LOCAL_DEMO", "", 404],
    ["EXAMPLE_LIMO_PROVIDER_MODE", "live", 503],
    ["EXAMPLE_LIMO_PROVIDER_MODE", "disabled", 503],
    ["EXAMPLE_LIMO_USE_PROTON_CREDENTIALS", "true", 503],
  ])("refuses unsafe mode %s=%s", async (name, value, expectedStatus) => {
    vi.stubEnv(name, value)
    expect((await post({ action: "start" })).status).toBe(expectedStatus)
    expect((await api.GET(new Request(URL))).status).toBe(expectedStatus)
  })

  it.each([
    "FIREBASE_SERVICE_ACCOUNT_KEY", "FIRESTORE_EMULATOR_HOST", "GOOGLE_APPLICATION_CREDENTIALS",
    "VOLIMOX_FIREBASE_PROJECT_ID", "EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_API_KEY",
    "EXAMPLE_LIMO_STRIPE_SECRET_KEY", "TWILIO_AUTH_TOKEN", "RETELL_API_KEY", "GEMINI_API_KEY", "XAI_API_KEY", "PROTON_API_BASE_URL",
  ])("refuses configured %s before any storage or network action", async (name) => {
    vi.stubEnv(name, "deliberately-invalid-local-test-value")
    const result = await post({ action: "start" })
    expect(result.status).toBe(503)
    expect(result.body.code).toBe("local_demo_unsafe_configuration")
    expect(JSON.stringify(result.body)).not.toContain("deliberately-invalid-local-test-value")
  })

  it("requires loopback and matching browser origin", async () => {
    expect((await post({ action: "start" }, { url: "http://demo.example/api/example-limo/simulation" })).status).toBe(403)
    expect((await post({ action: "start" }, { headers: { host: "demo.example" } })).status).toBe(403)
    expect((await post({ action: "start" }, { headers: { "x-forwarded-host": "demo.example" } })).status).toBe(403)
    expect((await post({ action: "start" }, { headers: { origin: "https://other.example" } })).status).toBe(403)
    expect((await post({ action: "start" }, { headers: { origin: "null" } })).status).toBe(403)
    expect((await post({ action: "start" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403)
    expect((await api.GET(new Request("http://localhost:3002/api/example-limo/simulation"))).status).toBe(200)
    expect((await api.GET(new Request("http://[::1]:3002/api/example-limo/simulation"))).status).toBe(200)
  })

  it("accepts Next's internal loopback alias while binding browser origin to Host", async () => {
    const options = { url: "http://localhost:3002/api/example-limo/simulation", headers: { host: "127.0.0.1:3002", "x-forwarded-host": "127.0.0.1:3002" } }
    expect((await api.GET(new Request(options.url, { headers: options.headers }))).status).toBe(200)
    expect((await post({ action: "start" }, options)).status).toBe(200)
    expect((await post({ action: "start" }, { ...options, headers: { ...options.headers, origin: "http://localhost:3002" } })).status).toBe(403)
    expect((await post({ action: "start" }, { ...options, headers: { ...options.headers, origin: "http://127.0.0.1:3003" } })).status).toBe(403)
  })

  it("rejects mismatched loopback ports, forwarded authorities and malformed Host values", async () => {
    const internalUrl = "http://localhost:3002/api/example-limo/simulation"
    for (const host of ["127.0.0.1:3003", "127.0.0.1", "127.0.0.1:3002@other.example", "127.0.0.1:3002/path", "127.0.0.1:3002,other.example", ""]) {
      expect((await api.GET(new Request(internalUrl, { headers: { host } }))).status).toBe(403)
    }
    expect((await api.GET(new Request(internalUrl, { headers: { host: "127.0.0.1:3002", "x-forwarded-host": "localhost:3002" } }))).status).toBe(403)
    expect((await api.GET(new Request(internalUrl, { headers: { host: "127.0.0.1:3002", "x-forwarded-host": "127.0.0.1:3003" } }))).status).toBe(403)
  })

  it("quotes, selects, explicitly approves and completes through the existing engine offline", async () => {
    const sessionToken = await start()
    const input = trip({ tenant_id: "untrusted-client-tenant" })
    const currentQuote = await quote(sessionToken, input)
    const repeat = await post({ action: "quote", sessionToken, trip: input })
    expect(repeat.body.quote.quoteId).toBe(currentQuote.quoteId)
    expect(repeat.body.activeQuoteReused).toBe(true)
    expect(currentQuote.quotes_by_vehicle["Luxury Sedan"]?.quotedTotalUsd).toBeGreaterThan(0)
    const approvalIntentToken = await select(sessionToken, currentQuote.quoteId)
    const result = await checkout(sessionToken, currentQuote.quoteId, approvalIntentToken, { quotedTotalUsd: 0.01, tenant_id: "other", pickup_address: "tampered" })
    expect(result.status).toBe(200)
    expect(result.body.reservation).toMatchObject({ status: "simulation_ready", providerMode: "simulate", quotedTotalUsd: currentQuote.quotes_by_vehicle["Luxury Sedan"]?.quotedTotalUsd })
    const duplicate = await checkout(sessionToken, currentQuote.quoteId, approvalIntentToken)
    expect(duplicate.body.reservation.id).toBe(result.body.reservation.id)
    const completed = await post({ action: "complete", sessionToken, reservationId: result.body.reservation.id })
    expect(completed.status).toBe(200)
    expect(completed.body.reservation).toMatchObject({ status: "paid", providerMode: "simulate" })
    expect(completed.body.idempotent).toBe(false)
    expect((await post({ action: "complete", sessionToken, reservationId: result.body.reservation.id })).body.idempotent).toBe(true)
    const { readExampleLimoReservation, exampleLimoMemoryStatsForTests } = await import("@/lib/example-limo/store")
    const stored = await readExampleLimoReservation(result.body.reservation.id, "volimox-local-demo")
    expect(stored).toMatchObject({ pickupAddress: currentQuote.pickupAddress, simulationCompletedAt: expect.any(String) })
    expect(exampleLimoMemoryStatsForTests()).toMatchObject({ reservations: 1, interactions: 1 })
    expect((await import("@/lib/firebase-admin")).demoDb()).toBeNull()
  })

  it("requires a literal approval action and validates its vehicle selection token", async () => {
    const sessionToken = await start()
    const currentQuote = await quote(sessionToken)
    const approvalIntentToken = await select(sessionToken, currentQuote.quoteId)
    for (const approved of [undefined, false, "true"]) {
      const result = await checkout(sessionToken, currentQuote.quoteId, approvalIntentToken, { approved })
      expect(result.body.code).toBe("explicit_price_approval_required")
    }
    expect((await checkout(sessionToken, currentQuote.quoteId, `${approvalIntentToken}x`)).status).toBe(409)
    const changedVehicle = await checkout(sessionToken, currentQuote.quoteId, approvalIntentToken, { vehicleName: "Large SUV" })
    expect(changedVehicle.body.code).toBe("approval_intent_tuple_mismatch")
    const { exampleLimoMemoryStatsForTests } = await import("@/lib/example-limo/store")
    expect(exampleLimoMemoryStatsForTests().reservations).toBe(0)
  })

  it("invalidates previous selection after trip changes", async () => {
    const sessionToken = await start()
    const first = await quote(sessionToken)
    const token = await select(sessionToken, first.quoteId)
    await quote(sessionToken, trip({ passenger_count: 4 }))
    expect((await checkout(sessionToken, first.quoteId, token)).body.code).toBe("quote_not_active_for_session")
  })

  it("does not fall back to a previous checkout after a replacement quote fails", async () => {
    const sessionToken = await start()
    const first = await quote(sessionToken)
    const token = await select(sessionToken, first.quoteId)
    const rejected = await post({ action: "quote", sessionToken, trip: trip({ passenger_count: 7 }) })
    expect(rejected.body.code).toBe("invalid_passenger_count")
    expect((await checkout(sessionToken, first.quoteId, token)).body.code).toBe("quote_not_active_for_session")
    const { exampleLimoMemoryStatsForTests } = await import("@/lib/example-limo/store")
    expect(exampleLimoMemoryStatsForTests().reservations).toBe(0)
  })

  it("rejects cross-session quote, checkout, reservation and signed-token replay", async () => {
    const sessionA = await start()
    const sessionB = await start()
    const input = trip()
    const quoteA = await quote(sessionA, input)
    const approvalA = await select(sessionA, quoteA.quoteId)
    expect((await post({ action: "select_vehicle", sessionToken: sessionB, quoteId: quoteA.quoteId, vehicleName: "Luxury Sedan" })).status).toBe(409)
    expect((await checkout(sessionB, quoteA.quoteId, approvalA)).status).toBe(409)
    const reservationA = await checkout(sessionA, quoteA.quoteId, approvalA)
    expect((await post({ action: "complete", sessionToken: sessionB, reservationId: reservationA.body.reservation.id })).status).toBe(403)
    const quoteB = await quote(sessionB, input)
    const approvalB = await select(sessionB, quoteB.quoteId)
    expect((await checkout(sessionB, quoteB.quoteId, approvalB)).body.code).toBe("local_demo_checkout_owned")
    const { createExampleLimoVoiceSessionToken } = await import("@/lib/example-limo/voice-session")
    const forged = createExampleLimoVoiceSessionToken("limo", "volimox-local-demo", 900, { runId: "elv_123456789012" })
    expect((await post({ action: "quote", sessionToken: forged, trip: input })).status).toBe(401)
    expect((await post({ action: "quote", sessionToken: `${sessionA}.extra`, trip: input })).status).toBe(401)
  })

  it("leaves short-notice rides pending human review and refuses completion", async () => {
    const sessionToken = await start()
    const currentQuote = await quote(sessionToken, trip({ departure_time_iso: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() }))
    expect(currentQuote.requiresAdminApproval).toBe(true)
    const approvalIntentToken = await select(sessionToken, currentQuote.quoteId)
    const result = await checkout(sessionToken, currentQuote.quoteId, approvalIntentToken)
    expect(result.body).toMatchObject({ reviewRequired: true, reservation: { status: "pending_review", providerMode: "simulate" } })
    expect((await post({ action: "complete", sessionToken, reservationId: result.body.reservation.id })).body.code).toBe("human_review_required")
    const { readExampleLimoReservation, exampleLimoMemoryStatsForTests } = await import("@/lib/example-limo/store")
    expect((await readExampleLimoReservation(result.body.reservation.id))?.status).toBe("pending_review")
    expect(exampleLimoMemoryStatsForTests().reviewNotifications).toBe(1)
  })

  it("keeps core lead-time and vehicle-capacity validation", async () => {
    const sessionToken = await start()
    expect((await post({ action: "quote", sessionToken, trip: trip({ departure_time_iso: new Date(Date.now() + 60 * 60 * 1000).toISOString() }) })).body.code).toBe("too_soon")
    expect((await post({ action: "quote", sessionToken, trip: trip({ passenger_count: 7 }) })).body.code).toBe("invalid_passenger_count")
    expect((await post({ action: "quote", sessionToken, trip: trip({ luggage_count: 7 }) })).body.code).toBe("vehicle_capacity_dispatch_required")
  })
})
