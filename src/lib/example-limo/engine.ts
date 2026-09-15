import crypto from "node:crypto"
import { EXAMPLE_LIMO_PRICING_VERSION, getExampleLimoGoogleMapsKeys, getExampleLimoHmacSecret, getExampleLimoTenantId } from "./config"
import { formatDualAgentSayPrice, priceVehicle } from "./pricing"
import { computeRouteLeg } from "./routing"
import { createQuoteId, readExampleLimoSettings, saveExampleLimoQuote } from "./store"
import type { ExampleLimoQuoteRequest, ExampleLimoQuoteResponse, ExampleLimoRouteLeg, ExampleLimoVehicleName, ExampleLimoVehicleQuote } from "./types"
import type { ExampleLimoSettings } from "./config"
import { ExampleLimoValidationError, normalizeVehicle, parseHours, parseTripType, text, validateAddressPair, validateAirport, validateCounts, validateDepartureTime, validatePhone, validateRouteComplexity, validateServiceArea, validateServiceType, validateTrip } from "./validation"

export function createQuoteFingerprint(input: {
  tenantId: string
  pickupAddress: string
  destinationAddress: string
  departureTimeIso: string
  returnDepartureTimeIso?: string
  serviceType: string
  tripType?: string
  vehicleName: string
  passengerCount: number
  luggageCount: number
  amount: number
  pricingVersion: string
  stops?: string[]
  hoursRequested?: number
  airline?: string
}) {
  const canonical = JSON.stringify({
    tenantId: input.tenantId,
    pickupAddress: input.pickupAddress.trim().toLowerCase(),
    destinationAddress: input.destinationAddress.trim().toLowerCase(),
    departureTimeIso: input.departureTimeIso,
    returnDepartureTimeIso: input.returnDepartureTimeIso || null,
    serviceType: input.serviceType,
    tripType: input.tripType || null,
    vehicleName: input.vehicleName,
    passengerCount: input.passengerCount,
    luggageCount: input.luggageCount,
    amount: Number(input.amount.toFixed(2)),
    pricingVersion: input.pricingVersion,
    stops: (input.stops || []).map((stop) => stop.trim().toLowerCase()),
    hoursRequested: input.hoursRequested || null,
    airline: input.airline?.trim().toLowerCase() || null,
  })
  const encoded = Buffer.from(canonical).toString("base64url")
  const signature = crypto.createHmac("sha256", getExampleLimoHmacSecret()).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

export function verifyQuoteFingerprint(value: string, expected: Partial<Parameters<typeof createQuoteFingerprint>[0]> & { tenantId: string }) {
  const [encoded, signature] = value.split(".")
  if (!encoded || !signature) return false
  const expectedSignature = crypto.createHmac("sha256", getExampleLimoHmacSecret()).update(encoded).digest("base64url")
  if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return false
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>
    if (String(parsed.tenantId) !== expected.tenantId) return false
    for (const key of ["pickupAddress", "destinationAddress", "departureTimeIso", "serviceType", "tripType", "vehicleName", "passengerCount", "luggageCount", "pricingVersion", "hoursRequested", "airline"]) {
      if (expected[key as keyof typeof expected] !== undefined) {
        const expectedValue = key === "pickupAddress" || key === "destinationAddress" || key === "airline"
          ? String(expected[key as keyof typeof expected]).trim().toLowerCase()
          : String(expected[key as keyof typeof expected])
        if (String(parsed[key]) !== expectedValue) return false
      }
    }
    if (expected.stops !== undefined && JSON.stringify(parsed.stops || []) !== JSON.stringify(expected.stops.map((stop) => stop.trim().toLowerCase()))) return false
    if (expected.amount !== undefined && Math.abs(Number(parsed.amount) - Number(expected.amount)) > 0.001) return false
    if (expected.returnDepartureTimeIso !== undefined && String(parsed.returnDepartureTimeIso || "") !== String(expected.returnDepartureTimeIso || "")) return false
    return Number.isFinite(Number(parsed.amount)) && Number(parsed.amount) >= 0
  } catch {
    return false
  }
}

function requiresAdminApproval(departureTimeIso: string, now = new Date()) {
  const delta = new Date(departureTimeIso).getTime() - now.getTime()
  return delta >= 2 * 60 * 60 * 1000 && delta < 12 * 60 * 60 * 1000
}

function normalizeRequest(input: ExampleLimoQuoteRequest, now = new Date(), settings?: ExampleLimoSettings) {
  const pickup = text(input.pickup_address, 240)
  const destination = text(input.destination_address, 240)
  const serviceType = validateServiceType(input.service_type)
  const tripType = parseTripType(input.trip_type)
  const timeOptions = settings ? { minLeadMinutes: settings.minLeadMinutes, maxDaysAhead: settings.maxDaysAhead } : undefined
  const departureTimeIso = validateDepartureTime(input.departure_time_iso, now, timeOptions)
  const returnDepartureTimeIso = input.return_departure_time_iso ? validateDepartureTime(input.return_departure_time_iso, now, timeOptions) : undefined
  const { passengerCount, luggageCount } = validateCounts(input.passenger_count, input.luggage_count)
  validateAddressPair(pickup, destination, { allowGoogleResolution: getExampleLimoGoogleMapsKeys().length > 0 })
  validateTrip(serviceType, tripType, returnDepartureTimeIso)
  const phone = validatePhone(input.phone)
  const stops = validateRouteComplexity(input.stops)
  const airline = validateAirport(serviceType, pickup, destination, input.airline)
  const vehicleName = input.vehicle_name ? normalizeVehicle(input.vehicle_name) : undefined
  if (input.vehicle_name && !vehicleName) throw new ExampleLimoValidationError("Choose Luxury Sedan or Large SUV.", "unknown_vehicle")
  return { pickup, destination, serviceType, tripType, departureTimeIso, returnDepartureTimeIso, passengerCount, luggageCount, phone, stops, airline, vehicleName, hours: parseHours(input.hours_requested) }
}

export async function buildExampleLimoQuote(input: ExampleLimoQuoteRequest, options?: { now?: Date; fetcher?: typeof fetch; allowSimulation?: boolean; persist?: boolean }): Promise<ExampleLimoQuoteResponse> {
  // Keep validation deterministic for tests while production uses the current clock.
  const now = options?.now || new Date()
  const pickup = text(input.pickup_address, 240)
  const destination = text(input.destination_address, 240)
  const serviceType = validateServiceType(input.service_type)
  const tripType = parseTripType(input.trip_type)
  const departureTimeIso = (() => {
    const raw = text(input.departure_time_iso, 80)
    const parsed = new Date(raw)
    if (!raw || Number.isNaN(parsed.getTime())) throw new ExampleLimoValidationError("I need an exact future pickup date and time.", "invalid_departure_time")
    return parsed.toISOString()
  })()
  const returnDepartureTimeIso = input.return_departure_time_iso ? text(input.return_departure_time_iso, 80) : undefined
  const settings = await readExampleLimoSettings(input.tenant_id)

  // normalizeRequest uses Date.now; validate the same fields with the injected clock here.
  if (new Date(departureTimeIso).getTime() <= now.getTime()) throw new ExampleLimoValidationError("That pickup time is in the past. Please provide a future date and time.", "past_departure_time")
  if (new Date(departureTimeIso).getTime() < now.getTime() + settings.minLeadMinutes * 60 * 1000) throw new ExampleLimoValidationError(`Pickup time must be at least ${settings.minLeadMinutes} minutes from now (${"America/New_York"}).`, "too_soon")
  if (new Date(departureTimeIso).getTime() > now.getTime() + settings.maxDaysAhead * 24 * 60 * 60 * 1000) throw new ExampleLimoValidationError(`Pickup time cannot be more than ${settings.maxDaysAhead} days ahead.`, "too_far_ahead")
  if (returnDepartureTimeIso) {
    const parsedReturn = new Date(returnDepartureTimeIso)
    if (Number.isNaN(parsedReturn.getTime())) throw new ExampleLimoValidationError("I need an exact future return pickup date and time.", "invalid_return_time")
    if (parsedReturn.getTime() <= new Date(departureTimeIso).getTime()) throw new ExampleLimoValidationError("The return pickup must be after the outbound pickup.", "invalid_return_time")
  }
  // Run all remaining validations with the canonical request shape.
  const normalized = normalizeRequest({ ...input, pickup_address: pickup, destination_address: destination, service_type: serviceType, trip_type: tripType, departure_time_iso: departureTimeIso, return_departure_time_iso: returnDepartureTimeIso }, now, settings)
  const tenantId = getExampleLimoTenantId(input.tenant_id)
  const approvalRequired = requiresAdminApproval(departureTimeIso, now)
  const routes: ExampleLimoRouteLeg[] = []

  if (serviceType !== "hourly") {
    routes.push(await computeRouteLeg({ pickup: normalized.pickup, destination: normalized.destination, stops: normalized.stops, departureTimeIso: normalized.departureTimeIso, fetcher: options?.fetcher, allowSimulation: options?.allowSimulation }))
    if (normalized.tripType === "round_trip") {
      routes.push(await computeRouteLeg({ pickup: normalized.destination, destination: normalized.pickup, stops: [...normalized.stops].reverse(), departureTimeIso: normalized.returnDepartureTimeIso, fetcher: options?.fetcher, allowSimulation: options?.allowSimulation }))
    }
  }

  // Google Places/Geocoding can turn a valid landmark such as Madison Square
  // Garden into its canonical street address. Apply the service-area policy to
  // that resolved address rather than rejecting the landmark before resolution.
  const resolvedPickup = routes[0]?.pickupAddress || normalized.pickup
  const resolvedDestination = routes[0]?.destinationAddress || normalized.destination
  validateServiceArea(resolvedPickup, resolvedDestination)

  const vehicles: ExampleLimoVehicleName[] = []
  const sedanFits = normalized.passengerCount <= settings.vehicleCapacity["Luxury Sedan"].maxPassengers && normalized.luggageCount <= settings.vehicleCapacity["Luxury Sedan"].maxLuggage
  const suvFits = normalized.passengerCount <= settings.vehicleCapacity["Large SUV"].maxPassengers && normalized.luggageCount <= settings.vehicleCapacity["Large SUV"].maxLuggage
  if (normalized.vehicleName) {
    if (normalized.vehicleName === "Luxury Sedan" && !sedanFits) {
      const message = suvFits
        ? "Luxury Sedan fits up to 3 passengers and 3 bags. Large SUV is required for this party."
        : "Standard Example Limo vehicles cannot fit this request. Luxury Sedan fits up to 3 passengers and 3 bags; Large SUV fits up to 6 passengers and 6 bags. Dispatch assistance is required."
      throw new ExampleLimoValidationError(message, suvFits ? "vehicle_capacity" : "vehicle_capacity_dispatch_required", { maxSedanPassengers: 3, maxSedanLuggage: 3, maxSuvPassengers: 6, maxSuvLuggage: 6 })
    }
    if (normalized.vehicleName === "Large SUV" && !suvFits) throw new ExampleLimoValidationError("Standard Example Limo vehicles cannot fit this request. Luxury Sedan fits up to 3 passengers and 3 bags; Large SUV fits up to 6 passengers and 6 bags. Dispatch assistance is required.", "vehicle_capacity_dispatch_required", { maxSedanPassengers: 3, maxSedanLuggage: 3, maxSuvPassengers: 6, maxSuvLuggage: 6 })
    vehicles.push(normalized.vehicleName)
  } else {
    if (sedanFits) vehicles.push("Luxury Sedan")
    if (suvFits) vehicles.push("Large SUV")
  }
  if (!vehicles.length) throw new ExampleLimoValidationError("Standard Example Limo vehicles cannot fit this request. Luxury Sedan fits up to 3 passengers and 3 bags; Large SUV fits up to 6 passengers and 6 bags. Dispatch assistance is required.", "vehicle_capacity_dispatch_required", { maxSedanPassengers: 3, maxSedanLuggage: 3, maxSuvPassengers: 6, maxSuvLuggage: 6 })

  const quoteIssuedAt = now.toISOString()
  const quotesByVehicle: Partial<Record<ExampleLimoVehicleName, ExampleLimoVehicleQuote>> = {}
  for (const vehicleName of vehicles) {
    const priced = priceVehicle({ vehicleName, serviceType, routes, hours: normalized.hours, settings })
    const fingerprint = createQuoteFingerprint({ tenantId, pickupAddress: resolvedPickup, destinationAddress: resolvedDestination, departureTimeIso: normalized.departureTimeIso, returnDepartureTimeIso: normalized.returnDepartureTimeIso, serviceType, tripType: normalized.tripType, vehicleName, passengerCount: normalized.passengerCount, luggageCount: normalized.luggageCount, amount: priced.totalPrice, pricingVersion: settings.pricingVersion || EXAMPLE_LIMO_PRICING_VERSION, stops: normalized.stops, hoursRequested: serviceType === "hourly" ? normalized.hours : undefined, airline: normalized.airline || undefined })
    quotesByVehicle[vehicleName] = {
      vehicleName,
      serviceType,
      pickupAddress: resolvedPickup,
      destinationAddress: resolvedDestination,
      miles: priced.miles,
      durationMinutes: priced.durationMinutes,
      trafficMultiplier: priced.trafficMultiplier,
      tollAmount: priced.tollAmount,
      baseRoutePrice: priced.baseRoutePrice,
      vehicleRoutePrice: priced.vehicleRoutePrice,
      subtotal: priced.subtotal,
      gratuityAmount: priced.gratuityAmount,
      taxAmount: priced.taxAmount,
      totalPrice: priced.totalPrice,
      quotedTotalUsd: priced.totalPrice,
      quoteFingerprint: fingerprint,
      quoteIssuedAt,
      currency: "USD",
      routeLegs: routes,
      pricingVersion: settings.pricingVersion || EXAMPLE_LIMO_PRICING_VERSION,
      requiresAdminApproval: approvalRequired,
    }
  }

  const first = quotesByVehicle["Luxury Sedan"] || quotesByVehicle["Large SUV"] || null
  const dualQuoteFingerprint = createQuoteFingerprint({ tenantId, pickupAddress: resolvedPickup, destinationAddress: resolvedDestination, departureTimeIso: normalized.departureTimeIso, returnDepartureTimeIso: normalized.returnDepartureTimeIso, serviceType, tripType: normalized.tripType, vehicleName: `dual:${vehicles.join("+")}`, passengerCount: normalized.passengerCount, luggageCount: normalized.luggageCount, amount: first?.totalPrice || 0, pricingVersion: settings.pricingVersion || EXAMPLE_LIMO_PRICING_VERSION, stops: normalized.stops, hoursRequested: serviceType === "hourly" ? normalized.hours : undefined, airline: normalized.airline || undefined })
  const quoteId = createQuoteId()
  const response: ExampleLimoQuoteResponse = {
    ok: true,
    quoteId,
    dual_quote: vehicles.length > 1,
    quote: first,
    quotes_by_vehicle: quotesByVehicle,
    quoteFingerprint: dualQuoteFingerprint,
    quoteIssuedAt,
    quotedTotalUsd: first?.totalPrice ?? null,
    agent_say_price: formatDualAgentSayPrice(quotesByVehicle, first?.miles || 0, serviceType, first?.durationMinutes || normalized.hours * 60),
    requiresAdminApproval: approvalRequired,
    pickupAddress: resolvedPickup,
    destinationAddress: resolvedDestination,
    departureTimeIso: normalized.departureTimeIso,
    serviceType,
    tripType: normalized.tripType,
    passengerCount: normalized.passengerCount,
    luggageCount: normalized.luggageCount,
    phone: normalized.phone,
    stops: normalized.stops,
    hoursRequested: serviceType === "hourly" ? normalized.hours : undefined,
    airline: normalized.airline || undefined,
    returnDepartureTimeIso: normalized.returnDepartureTimeIso,
    pricingVersion: settings.pricingVersion || EXAMPLE_LIMO_PRICING_VERSION,
    routeLegs: routes,
  }
  if (options?.persist !== false) {
    const createdAt = now.toISOString()
    await saveExampleLimoQuote({ ...response, id: quoteId, tenantId, createdAt, expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString() })
  }
  return response
}

export function getSelectedQuote(response: ExampleLimoQuoteResponse, vehicleName: unknown) {
  const normalized = normalizeVehicle(vehicleName)
  if (!normalized) throw new ExampleLimoValidationError("Choose Luxury Sedan or Large SUV before checkout.", "vehicle_required")
  const selected = response.quotes_by_vehicle[normalized]
  if (!selected) throw new ExampleLimoValidationError("That vehicle does not fit the passenger and luggage count.", "vehicle_unavailable")
  return selected
}
