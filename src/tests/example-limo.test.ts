import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_EXAMPLE_LIMO_SETTINGS } from "@/lib/example-limo/config"
import { buildExampleLimoQuote, createQuoteFingerprint, verifyQuoteFingerprint } from "@/lib/example-limo/engine"
import { sendExampleLimoCheckoutLink, ExampleLimoCheckoutError } from "@/lib/example-limo/checkout"
import { clearExampleLimoIntegrityMemoryForTests, createVehicleSelectionIntent, explicitVehicleSelection, getOrCreateActiveQuote, isExplicitPriceApproval } from "@/lib/example-limo/integrity-state"
import { priceVehicle } from "@/lib/example-limo/pricing"
import { computeRouteLeg } from "@/lib/example-limo/routing"
import { readExampleLimoQuote } from "@/lib/example-limo/store"
import { ExampleLimoValidationError, validateAddressPair } from "@/lib/example-limo/validation"

const NOW = new Date("2026-07-27T12:00:00-04:00")
const BASE_REQUEST = {
  pickup_address: "105 Hospital Court, Secaucus, NJ 07094",
  destination_address: "Madison Square Garden, New York, NY",
  departure_time_iso: "2026-07-28T21:00:00-04:00",
  passenger_count: 2,
  luggage_count: 2,
  phone: "2015550123",
  service_type: "point_to_point" as const,
  trip_type: "one_way" as const,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  clearExampleLimoIntegrityMemoryForTests()
  delete process.env.EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY
  delete process.env.EXAMPLE_LIMO_USE_PROTON_CREDENTIALS
  delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  delete process.env.FIRESTORE_EMULATOR_HOST
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Example Limo Proton-parity pricing", () => {
  it("allows Google to resolve a numbered street without requiring city and state first", () => {
    expect(() => validateAddressPair("123 5th Avenue", "Empire State Building", { allowGoogleResolution: true })).not.toThrow()
    expect(() => validateAddressPair("123 5th Avenue", "Empire State Building")).toThrowError(ExampleLimoValidationError)
  })

  it("keeps Sedan and SUV rates, gratuity, tax, and toll rounding separate", () => {
    const priced = priceVehicle({
      vehicleName: "Luxury Sedan",
      serviceType: "point_to_point",
      routes: [{ distanceMiles: 10, durationMinutes: 35, staticDurationMinutes: 25, trafficRatio: 1.4, tollAmount: 3.6 }],
      hours: 2,
      settings: DEFAULT_EXAMPLE_LIMO_SETTINGS,
    })
    expect(priced.vehicleRoutePrice).toBe(Math.ceil(10 * 6.259 + 10 * 1.41))
    expect(priced.tollAmount).toBe(4)
    expect(priced.gratuityAmount).toBe(Math.round(priced.subtotal * 0.18))
    expect(priced.taxAmount).toBe(Math.round(priced.subtotal * 0.06625))
    expect(priced.totalPrice).toBe(priced.subtotal + priced.gratuityAmount + priced.taxAmount)
  })

  it("rounds each round-trip leg before adding tolls, gratuity, and tax", () => {
    const priced = priceVehicle({
      vehicleName: "Luxury Sedan",
      serviceType: "point_to_point",
      routes: [
        { distanceMiles: 1, durationMinutes: 5, staticDurationMinutes: 5, trafficRatio: 1, tollAmount: 0.49 },
        { distanceMiles: 1, durationMinutes: 5, staticDurationMinutes: 5, trafficRatio: 1, tollAmount: 0.49 },
      ],
      hours: 2,
      settings: DEFAULT_EXAMPLE_LIMO_SETTINGS,
    })
    // Proton rounds each leg's $50 minimum and $0.49 toll independently:
    // ($50 + $0) + ($50 + $0), then rounds tip and tax per leg.
    expect(priced.vehicleRoutePrice).toBe(100)
    expect(priced.tollAmount).toBe(0)
    expect(priced.subtotal).toBe(100)
    expect(priced.gratuityAmount).toBe(18)
    expect(priced.taxAmount).toBe(6)
    expect(priced.totalPrice).toBe(124)
  })

  it("returns a dual quote and uses simulated routing in development", async () => {
    const quote = await buildExampleLimoQuote(BASE_REQUEST, { now: NOW, allowSimulation: true, persist: false })
    expect(quote.dual_quote).toBe(true)
    expect(quote.quotes_by_vehicle["Luxury Sedan"]?.quoteFingerprint).toBeTruthy()
    expect(quote.quotes_by_vehicle["Large SUV"]?.quoteFingerprint).toBeTruthy()
    expect(quote.agent_say_price).toContain("Luxury Sedan")
    expect(quote.agent_say_price).toContain("Large SUV")
    expect(quote.agent_say_price).toContain("all-inclusive")
    expect(quote.agent_say_price).not.toContain("miles")
  })

  it("matches Proton Routes toll and landmark waypoint handling", async () => {
    process.env.EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY = `AIzaSy${"x".repeat(30)}`
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      calls.push({ url, init })
      if (url.includes("/geocode/json")) {
        return new Response(JSON.stringify({
          status: "OK",
          results: [{
            formatted_address: "105 Osprey Ct, Secaucus, NJ 07094, USA",
            address_components: [{ types: ["country"], short_name: "US" }],
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      if (url.includes("findplacefromtext")) {
        return new Response(JSON.stringify({
          status: "OK",
          candidates: [{
            formatted_address: "Madison Square Garden, 4 Pennsylvania Plaza, New York, NY 10001, USA",
            geometry: { location: { lat: 40.7505, lng: -73.9934 } },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return new Response(JSON.stringify({
        routes: [{
          duration: "3000s",
          staticDuration: "2400s",
          distanceMeters: 16093.4,
          travelAdvisory: { tollInfo: { estimatedPrice: [{ units: "2", nanos: 250000000 }] } },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }) as typeof fetch

    const route = await computeRouteLeg({
      pickup: BASE_REQUEST.pickup_address,
      destination: BASE_REQUEST.destination_address,
      departureTimeIso: BASE_REQUEST.departure_time_iso,
      fetcher,
      allowSimulation: false,
    })

    expect(route.distanceMiles).toBeCloseTo(10, 4)
    expect(route.durationMinutes).toBe(50)
    expect(route.staticDurationMinutes).toBe(40)
    expect(route.tollAmount).toBe(2.25)
    const routeCall = calls.find((call) => call.url.includes("routes.googleapis.com"))
    expect(routeCall).toBeTruthy()
    const routeBody = JSON.parse(String(routeCall?.init?.body)) as Record<string, any>
    expect(routeBody.routingPreference).toBe("TRAFFIC_AWARE_OPTIMAL")
    expect(routeBody.destination.location.latLng).toEqual({ latitude: 40.7505, longitude: -73.9934 })
    expect(route.destinationAddress).toBe("Madison Square Garden, 4 Pennsylvania Plaza, New York, NY 10001, USA")
  })

  it("lets Google canonicalize a numbered address without a spoken city/state", async () => {
    process.env.EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY = `AIzaSy${"x".repeat(30)}`
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes("geocode/json")) {
        const query = new URL(url).searchParams.get("address") || ""
        return new Response(JSON.stringify({
          status: "OK",
          results: [{
            formatted_address: query === "123 5th Avenue"
              ? "123 5th Ave, New York, NY 10003, USA"
              : "Empire State Building, 20 W 34th St, New York, NY 10001, USA",
            address_components: [{ types: ["country"], short_name: "US" }],
          }],
        }), { status: 200 })
      }
      return new Response(JSON.stringify({
        routes: [{
          duration: "600s",
          staticDuration: "480s",
          distanceMeters: 4184,
          travelAdvisory: { tollInfo: { estimatedPrice: [{ units: "0", nanos: 0 }] } },
        }],
      }), { status: 200 })
    }) as typeof fetch

    const quote = await buildExampleLimoQuote({
      ...BASE_REQUEST,
      pickup_address: "123 5th Avenue",
      destination_address: "Empire State Building",
    }, { now: NOW, fetcher, allowSimulation: false, persist: false })

    expect(quote.pickupAddress).toContain("123 5th Ave, New York, NY 10003")
    expect(quote.destinationAddress).toContain("Empire State Building")
  })

  it("resolves an unqualified named venue before enforcing the pickup service area", async () => {
    process.env.EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY = `AIzaSy${"x".repeat(30)}`
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes("findplacefromtext")) {
        const isGarden = new URL(url).searchParams.get("input") === "Madison Square Garden"
        return new Response(JSON.stringify({
          status: "OK",
          candidates: [{
            formatted_address: isGarden
              ? "Madison Square Garden, 4 Pennsylvania Plaza, New York, NY 10001, USA"
              : "John F. Kennedy International Airport, Queens, NY 11430, USA",
            geometry: { location: { lat: isGarden ? 40.7505 : 40.6413, lng: isGarden ? -73.9934 : -73.7781 } },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return new Response(JSON.stringify({
        routes: [{
          duration: "3000s",
          staticDuration: "2400s",
          distanceMeters: 16093.4,
          travelAdvisory: { tollInfo: { estimatedPrice: [{ units: "2", nanos: 250000000 }] } },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    }) as typeof fetch

    const quote = await buildExampleLimoQuote({
      ...BASE_REQUEST,
      pickup_address: "Madison Square Garden",
      destination_address: "JFK Airport",
      service_type: "airport_departure",
      airline: "",
    }, { now: NOW, fetcher, allowSimulation: false, persist: false })

    expect(quote.pickupAddress).toContain("New York, NY 10001")
    expect(quote.destinationAddress).toContain("Queens, NY 11430")
    expect(quote.quotes_by_vehicle["Luxury Sedan"]?.routeLegs[0]?.pickupAddress).toContain("New York, NY 10001")
  })

  it("applies the $140 airport floor before gratuity and tax", () => {
    const priced = priceVehicle({
      vehicleName: "Luxury Sedan",
      serviceType: "airport_departure",
      routes: [{ distanceMiles: 1, durationMinutes: 5, staticDurationMinutes: 5, trafficRatio: 1, tollAmount: 0 }],
      hours: 2,
      settings: DEFAULT_EXAMPLE_LIMO_SETTINGS,
    })
    expect(priced.vehicleRoutePrice).toBe(140)
    expect(priced.totalPrice).toBe(140 + Math.round(140 * 0.18) + Math.round(140 * 0.06625))
  })

  it("removes Sedan when capacity requires the SUV", async () => {
    const quote = await buildExampleLimoQuote({ ...BASE_REQUEST, passenger_count: 4, luggage_count: 4 }, { now: NOW, allowSimulation: true, persist: false })
    expect(quote.quotes_by_vehicle["Luxury Sedan"]).toBeUndefined()
    expect(quote.quotes_by_vehicle["Large SUV"]).toBeTruthy()
  })

  it("prices round trips as two route legs and enforces the hourly minimum", async () => {
    const roundTrip = await buildExampleLimoQuote({ ...BASE_REQUEST, trip_type: "round_trip", return_departure_time_iso: "2026-07-29T21:00:00-04:00" }, { now: NOW, allowSimulation: true, persist: false })
    expect(roundTrip.routeLegs).toHaveLength(2)
    expect(roundTrip.quotes_by_vehicle["Luxury Sedan"]?.durationMinutes).toBeGreaterThan(0)
    const hourly = await buildExampleLimoQuote({ ...BASE_REQUEST, service_type: "hourly", trip_type: undefined, hours_requested: 1 }, { now: NOW, allowSimulation: true, persist: false })
    expect(hourly.routeLegs).toHaveLength(0)
    expect(hourly.quotes_by_vehicle["Luxury Sedan"]?.durationMinutes).toBe(120)
  })

  it("keeps airport arrival classification explicit", async () => {
    const airport = await buildExampleLimoQuote({ ...BASE_REQUEST, pickup_address: "EWR Airport, Newark, NJ", service_type: "airport_arrival", trip_type: undefined, airline: "United" }, { now: NOW, allowSimulation: true, persist: false })
    expect(airport.serviceType).toBe("airport_arrival")
    expect(airport.quotes_by_vehicle["Luxury Sedan"]?.vehicleRoutePrice).toBeGreaterThanOrEqual(140)
  })

  it("requires an explicit trip type and round-trip return time", async () => {
    await expect(buildExampleLimoQuote({ ...BASE_REQUEST, trip_type: undefined }, { now: NOW, allowSimulation: true, persist: false })).rejects.toMatchObject({ code: "trip_type_required" })
    await expect(buildExampleLimoQuote({ ...BASE_REQUEST, trip_type: "round_trip" }, { now: NOW, allowSimulation: true, persist: false })).rejects.toMatchObject({ code: "return_time_required" })
  })

  it("enforces the two-hour lead window and service area", async () => {
    await expect(buildExampleLimoQuote({ ...BASE_REQUEST, departure_time_iso: "2026-07-27T13:00:00-04:00" }, { now: NOW, allowSimulation: true, persist: false })).rejects.toMatchObject({ code: "too_soon" })
    await expect(buildExampleLimoQuote({ ...BASE_REQUEST, pickup_address: "1 Main Street, Philadelphia, PA 19103" }, { now: NOW, allowSimulation: true, persist: false })).rejects.toMatchObject({ code: "pickup_outside_coverage" })
  })

  it("allows a quote in the two-to-twelve-hour review window but blocks payment later", async () => {
    const quote = await buildExampleLimoQuote({ ...BASE_REQUEST, departure_time_iso: "2026-07-27T20:00:00-04:00" }, { now: NOW, allowSimulation: true, persist: false })
    expect(quote.requiresAdminApproval).toBe(true)
    expect(quote.quotes_by_vehicle["Luxury Sedan"]?.requiresAdminApproval).toBe(true)
  })

  it("binds amount and pricing version to a tenant-scoped HMAC fingerprint", () => {
    const input = {
      tenantId: "tenant-a",
      pickupAddress: BASE_REQUEST.pickup_address,
      destinationAddress: BASE_REQUEST.destination_address,
      departureTimeIso: BASE_REQUEST.departure_time_iso,
      serviceType: BASE_REQUEST.service_type,
      vehicleName: "Luxury Sedan",
      passengerCount: 2,
      luggageCount: 2,
      amount: 123.45,
      pricingVersion: "proton-parity-v1",
    }
    const fingerprint = createQuoteFingerprint(input)
    expect(verifyQuoteFingerprint(fingerprint, input)).toBe(true)
    expect(verifyQuoteFingerprint(fingerprint, { ...input, amount: 123.46 })).toBe(false)
    expect(verifyQuoteFingerprint(fingerprint, { ...input, tenantId: "tenant-b" })).toBe(false)
  })

  it("rejects a missing destination instead of inventing one", async () => {
    await expect(buildExampleLimoQuote({ ...BASE_REQUEST, destination_address: "" }, { now: NOW, allowSimulation: true, persist: false })).rejects.toBeInstanceOf(ExampleLimoValidationError)
  })

  it("rejects city-only addresses and gives truthful standard-vehicle capacity limits", async () => {
    await expect(buildExampleLimoQuote({ ...BASE_REQUEST, pickup_address: "Secaucus, New Jersey" }, { now: NOW, allowSimulation: true, persist: false })).rejects.toMatchObject({ code: "pickup_address_incomplete" })
    await expect(buildExampleLimoQuote({ ...BASE_REQUEST, destination_address: "Manhattan" }, { now: NOW, allowSimulation: true, persist: false })).rejects.toMatchObject({ code: "destination_address_incomplete" })
    await expect(buildExampleLimoQuote({ ...BASE_REQUEST, luggage_count: 14 }, { now: NOW, allowSimulation: true, persist: false })).rejects.toMatchObject({
      code: "vehicle_capacity_dispatch_required",
      message: expect.stringContaining("Large SUV fits up to 6 passengers and 6 bags"),
    })
  })

  it("does not treat mixed-language or garbled ASR as vehicle selection or price approval", () => {
    expect(explicitVehicleSelection("完美")).toBeNull()
    expect(explicitVehicleSelection("sit down")).toBeNull()
    expect(explicitVehicleSelection("I choose the Large SUV")).toBe("Large SUV")
    expect(isExplicitPriceApproval("maybe")).toBe(false)
    expect(isExplicitPriceApproval("yes, but change the time")).toBe(false)
    expect(isExplicitPriceApproval("Yes, please send the link")).toBe(true)
    expect(isExplicitPriceApproval("Yes, I approve that exact price")).toBe(true)
    expect(isExplicitPriceApproval("Sí, apruebo ese precio exacto")).toBe(true)
  })

  it("reuses the active quote for an unchanged session booking", async () => {
    let builds = 0
    const input = { ...BASE_REQUEST }
    const first = await getOrCreateActiveQuote({
      sessionId: "session-reuse",
      tenantId: "volimox-demo",
      input,
      build: async () => {
        builds += 1
        return buildExampleLimoQuote(input, { now: NOW, allowSimulation: true, persist: true })
      },
    })
    const second = await getOrCreateActiveQuote({
      sessionId: "session-reuse",
      tenantId: "volimox-demo",
      input,
      build: async () => {
        builds += 1
        return buildExampleLimoQuote(input, { now: NOW, allowSimulation: true, persist: true })
      },
    })
    expect(builds).toBe(1)
    expect(second.reused).toBe(true)
    expect(second.quote.quoteId).toBe(first.quote.quoteId)
  })

  it("does not expose a memory quote across tenants", async () => {
    const quote = await buildExampleLimoQuote(BASE_REQUEST, { now: NOW, allowSimulation: true, persist: true })
    expect(await readExampleLimoQuote(quote.quoteId, "volimox-demo")).toBeTruthy()
    expect(await readExampleLimoQuote(quote.quoteId, "another-tenant")).toBeNull()
  })

  it("creates a simulated checkout only for the selected, approved vehicle", async () => {
    const sessionId = "session-checkout"
    const { quote } = await getOrCreateActiveQuote({ sessionId, tenantId: "volimox-demo", input: BASE_REQUEST, build: () => buildExampleLimoQuote(BASE_REQUEST, { now: NOW, allowSimulation: true, persist: true }) })
    const selected = quote.quotes_by_vehicle["Large SUV"]!
    const selection = await createVehicleSelectionIntent({
      sessionId,
      tenantId: "volimox-demo",
      quoteId: quote.quoteId,
      vehicleName: "Large SUV",
      quoteFingerprint: selected.quoteFingerprint,
      quotedTotalUsd: selected.quotedTotalUsd,
      quoteIssuedAt: selected.quoteIssuedAt,
      selectionUtterance: "I choose the Large SUV",
    })
    const request = {
      ...BASE_REQUEST,
      vehicle_name: "Large SUV",
      quote_fingerprint: selected.quoteFingerprint,
      quote_id: quote.quoteId,
      quoted_total_usd: selected.quotedTotalUsd,
      quote_issued_at: selected.quoteIssuedAt,
      conversation_transcript: "Customer: Large SUV, yes.\nDiane: I will prepare secure checkout.",
      approval: "yes",
    } as const
    await expect(sendExampleLimoCheckoutLink(request, "http://localhost:3004/")).rejects.toMatchObject({ code: "approval_intent_invalid_or_expired" })
    await expect(sendExampleLimoCheckoutLink(request, "http://localhost:3004/", {
      sessionId,
      tenantId: "volimox-demo",
      approvalIntentToken: selection.token,
      lastCustomerUtterance: "maybe",
    })).rejects.toMatchObject({ code: "explicit_price_approval_required" })
    const integrity = { sessionId, tenantId: "volimox-demo", approvalIntentToken: selection.token, lastCustomerUtterance: "Yes, please send the link" }
    const result = await sendExampleLimoCheckoutLink(request, "http://localhost:3004/", integrity)
    expect(result.ok).toBe(true)
    expect(result.checkoutUrl).toContain("/example-limo/checkout/")
    const repeated = await sendExampleLimoCheckoutLink({ ...request, conversation_transcript: "Customer: Large SUV, yes." }, "http://localhost:3004/", integrity)
    expect(repeated.reservationId).toBe(result.reservationId)
    await expect(sendExampleLimoCheckoutLink({
      ...request,
      quoted_total_usd: selected.quotedTotalUsd + 1,
      conversation_transcript: "Customer: maybe SUV",
    }, "http://localhost:3004/", integrity)).rejects.toMatchObject({ code: "approval_intent_tuple_mismatch" })
  })

  it("accepts a clear yes as the selection when capacity leaves only one vehicle", async () => {
    const sessionId = "session-single-vehicle"
    const input = { ...BASE_REQUEST, passenger_count: 4, luggage_count: 4 }
    const { quote } = await getOrCreateActiveQuote({
      sessionId,
      tenantId: "volimox-demo",
      input,
      build: () => buildExampleLimoQuote(input, { now: NOW, allowSimulation: true, persist: true }),
    })
    expect(quote.quotes_by_vehicle["Luxury Sedan"]).toBeUndefined()
    const suv = quote.quotes_by_vehicle["Large SUV"]!
    const selection = await createVehicleSelectionIntent({
      sessionId,
      tenantId: "volimox-demo",
      quoteId: quote.quoteId,
      vehicleName: "Large SUV",
      quoteFingerprint: suv.quoteFingerprint,
      quotedTotalUsd: suv.quotedTotalUsd,
      quoteIssuedAt: suv.quoteIssuedAt,
      selectionUtterance: "Yes, please continue with that option.",
    })
    expect(selection.intent.vehicleName).toBe("Large SUV")
    expect(selection.intent.quotedTotalUsd).toBe(suv.quotedTotalUsd)
  })
})
