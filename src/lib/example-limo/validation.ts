import { EXAMPLE_LIMO_TIME_ZONE } from "./config"
import type { ExampleLimoServiceType, ExampleLimoTripType, ExampleLimoVehicleName } from "./types"

export class ExampleLimoValidationError extends Error {
  constructor(message: string, public readonly code = "validation_error", public readonly details?: Record<string, unknown>) {
    super(message)
    this.name = "ExampleLimoValidationError"
  }
}

const STATES: Record<string, string> = {
  alabama: "AL", al: "AL", alaska: "AK", ak: "AK", arizona: "AZ", az: "AZ", arkansas: "AR", ar: "AR",
  california: "CA", ca: "CA", colorado: "CO", co: "CO", connecticut: "CT", ct: "CT", delaware: "DE", de: "DE",
  florida: "FL", fl: "FL", georgia: "GA", ga: "GA", illinois: "IL", il: "IL", indiana: "IN", in: "IN",
  iowa: "IA", ia: "IA", kansas: "KS", ks: "KS", kentucky: "KY", ky: "KY", louisiana: "LA", la: "LA",
  maine: "ME", me: "ME", maryland: "MD", md: "MD", massachusetts: "MA", ma: "MA", michigan: "MI", mi: "MI",
  minnesota: "MN", mn: "MN", mississippi: "MS", ms: "MS", missouri: "MO", mo: "MO", nebraska: "NE", ne: "NE",
  nevada: "NV", nv: "NV", "new hampshire": "NH", nh: "NH", "new jersey": "NJ", nj: "NJ", "new mexico": "NM", nm: "NM",
  "new york": "NY", ny: "NY", northcarolina: "NC", nc: "NC", ohio: "OH", oh: "OH", oklahoma: "OK", ok: "OK",
  oregon: "OR", or: "OR", pennsylvania: "PA", pa: "PA", "rhode island": "RI", ri: "RI", tennessee: "TN", tn: "TN",
  texas: "TX", tx: "TX", utah: "UT", ut: "UT", virginia: "VA", va: "VA", washington: "WA", wa: "WA", wisconsin: "WI", wi: "WI",
}

const NYC_LOCALITIES = new Set(["new york", "manhattan", "brooklyn", "queens", "bronx", "staten island", "jamaica", "flushing", "long island city", "astoria"])

export function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max) : ""
}

export function normalizePhone(value: unknown) {
  const raw = text(value, 32)
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`
  return ""
}

export function parseServiceType(value: unknown): ExampleLimoServiceType {
  const normalized = text(value, 40).toLowerCase().replace(/[\s-]+/g, "_")
  if (["airport_arrival", "airport_departure", "special_event", "hourly"].includes(normalized)) return normalized as ExampleLimoServiceType
  return "point_to_point"
}

export function validateServiceType(value: unknown): ExampleLimoServiceType {
  const normalized = text(value, 40).toLowerCase().replace(/[\s-]+/g, "_")
  if (!["point_to_point", "airport_arrival", "airport_departure", "special_event", "hourly"].includes(normalized)) {
    throw new ExampleLimoValidationError("Please confirm the ride service type before I calculate a quote.", "service_type_required")
  }
  return normalized as ExampleLimoServiceType
}

export function parseTripType(value: unknown): ExampleLimoTripType | undefined {
  const normalized = text(value, 40).toLowerCase().replace(/[\s-]+/g, "_")
  return normalized === "one_way" || normalized === "round_trip" ? normalized : undefined
}

export function normalizeVehicle(value: unknown): ExampleLimoVehicleName | undefined {
  const normalized = text(value, 60).toLowerCase().replace(/[\s_-]+/g, " ")
  if (normalized === "luxury sedan" || normalized === "sedan") return "Luxury Sedan"
  if (normalized === "large suv" || normalized === "luxury suv" || normalized === "premium suv" || normalized === "suv") return "Large SUV"
  return undefined
}

export function looksLikeLocation(value: string) {
  const normalized = value.trim()
  if (!normalized) return false
  if (/\b(JFK|LGA|EWR)\b/i.test(normalized) || /\bairport\b/i.test(normalized)) return true
  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean)
  const streetAddress = /\b\d+[A-Z-]?\b/i.test(normalized)
    && /\b(street|st|avenue|ave|road|rd|drive|dr|court|ct|boulevard|blvd|parkway|pkwy|lane|ln|way|place|pl|highway|hwy|route|rte)\b/i.test(normalized)
    && parts.length >= 2
    && Boolean(extractState(normalized))
  const namedLandmark = parts.length >= 3 && parts[0].split(/\s+/).filter(Boolean).length >= 2 && Boolean(extractState(normalized))
  // A recognizable named venue can be resolved server-side before routing.
  // Do not accept a city or a generic street name here; those remain ambiguous.
  const namedVenue = /\b(?:stadium|museum|station|terminal|park|plaza|building|garden|hall|theatre|theater|arena|bridge|market|hotel|hospital|university|college|center)\b/i.test(normalized)
    && normalized.split(/\s+/).filter(Boolean).length >= 2
  return streetAddress || namedLandmark || namedVenue
}

export function extractState(address: string) {
  const normalized = address.toLowerCase().replace(/\s+/g, " ").trim()
  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean).reverse()
  for (const part of parts) {
    for (const [name, code] of Object.entries(STATES)) {
      if (part === name || part.startsWith(`${name} `) || new RegExp(`\\b${name}\\b`).test(part)) return code
    }
  }
  return null
}

function extractZip(address: string) {
  return address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0].slice(0, 5) || null
}

function extractCity(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return ""
  const stateIndex = parts.findIndex((part) => extractState(part))
  if (stateIndex > 0) return parts[stateIndex - 1].replace(/\b\d{5}(?:-\d{4})?\b/g, "").trim().toLowerCase()
  return parts[parts.length - 2].replace(/\b\d{5}(?:-\d{4})?\b/g, "").trim().toLowerCase()
}

function isNycZip(zip: string | null) {
  if (!zip) return false
  const first = Number(zip.slice(0, 3))
  return (first >= 100 && first <= 104) || (first >= 111 && first <= 114) || first === 116 || zip === "11004" || zip === "11005"
}

export function validateServiceArea(pickup: string, destination: string) {
  const pickupState = extractState(pickup)
  if (!pickupState) throw new ExampleLimoValidationError("I need the pickup city and state before I can quote this ride.", "pickup_state_unclear")
  const covered = pickupState === "NJ" || (pickupState === "NY" && (NYC_LOCALITIES.has(extractCity(pickup)) || isNycZip(extractZip(pickup))))
  if (!covered) throw new ExampleLimoValidationError("Example Limo pickup service is limited to New Jersey and New York City. Drop-off can be anywhere in the United States.", "pickup_outside_coverage")
  if (/\b(Canada|Mexico|Toronto|Montreal|Vancouver|Tijuana)\b/i.test(destination)) throw new ExampleLimoValidationError("Example Limo can only quote United States drop-off locations.", "destination_outside_us")
  return { pickupState, destinationState: extractState(destination) }
}

/**
 * Google can resolve a numbered street or a named place even when the rider
 * did not speak the full city/state line. Keep this separate from
 * `looksLikeLocation`, which is intentionally strict for already-canonical
 * addresses and service-area checks.
 */
export function looksResolvableByGoogle(value: string) {
  const normalized = value.trim()
  if (!normalized) return false
  const numberedStreet = /\b\d+[A-Z-]?\b/i.test(normalized)
    && /\b(street|st|avenue|ave|road|rd|drive|dr|court|ct|boulevard|blvd|parkway|pkwy|lane|ln|way|place|pl|highway|hwy|route|rte)\b/i.test(normalized)
  const namedPlace = normalized.split(/\s+/).filter(Boolean).length >= 2
    && /\b(?:airport|stadium|museum|station|terminal|park|plaza|building|garden|hall|theatre|theater|arena|bridge|market|hotel|hospital|university|college|center)\b/i.test(normalized)
  return numberedStreet || namedPlace
}

export function validateAddressPair(pickup: string, destination: string, options?: { allowGoogleResolution?: boolean }) {
  const acceptable = (value: string) => looksLikeLocation(value) || (options?.allowGoogleResolution === true && looksResolvableByGoogle(value))
  if (!acceptable(pickup)) throw new ExampleLimoValidationError("I still need a recognizable pickup address or place name.", "pickup_address_incomplete")
  if (!acceptable(destination)) throw new ExampleLimoValidationError("I still need a recognizable drop-off address or place name.", "destination_address_incomplete")
}

export function validateCounts(passengerCount: unknown, luggageCount: unknown) {
  const passengers = Number(passengerCount)
  const luggage = Number(luggageCount)
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 6) throw new ExampleLimoValidationError("Passenger count must be an integer from 1 to 6.", "invalid_passenger_count")
  if (!Number.isInteger(luggage) || luggage < 0 || luggage > 14) throw new ExampleLimoValidationError("Luggage count must be an integer from 0 to 14.", "invalid_luggage_count")
  if (passengers > 6 || luggage > 14) throw new ExampleLimoValidationError("This request exceeds Example Limo capacity.", "capacity_exceeded")
  return { passengerCount: passengers, luggageCount: luggage }
}

export function validateDepartureTime(value: unknown, now = new Date(), opts?: { minLeadMinutes?: number; maxDaysAhead?: number }) {
  const raw = text(value, 80)
  const parsed = new Date(raw)
  if (!raw || Number.isNaN(parsed.getTime())) throw new ExampleLimoValidationError("I need an exact future pickup date and time.", "invalid_departure_time")
  const lead = opts?.minLeadMinutes ?? 120
  const maxDays = opts?.maxDaysAhead ?? 180
  if (parsed.getTime() <= now.getTime()) throw new ExampleLimoValidationError("That pickup time is in the past. Please provide a future date and time.", "past_departure_time")
  if (parsed.getTime() < now.getTime() + lead * 60 * 1000) throw new ExampleLimoValidationError(`Pickup time must be at least ${lead} minutes from now (${EXAMPLE_LIMO_TIME_ZONE}).`, "too_soon")
  if (parsed.getTime() > now.getTime() + maxDays * 24 * 60 * 60 * 1000) throw new ExampleLimoValidationError(`Pickup time cannot be more than ${maxDays} days ahead.`, "too_far_ahead")
  return parsed.toISOString()
}

export function validateAirport(serviceType: ExampleLimoServiceType, pickup: string, destination: string, airline?: unknown) {
  const isAirport = (value: string) => /\b(JFK|LGA|EWR|airport|terminal|newark international|la guardia|kennedy)\b/i.test(value)
  const validateTerminal = (value: string) => {
    const airport = value.toUpperCase()
    if (!/\b(?:JFK|LGA|EWR|KENNEDY|LAGUARDIA|NEWARK)\b/.test(airport)) return
    const match = airport.match(/\b(?:TERMINAL|TERM)\s*([A-Z0-9]+)\b|\b(?:JFK|LGA|EWR)\s+T\s*([A-Z0-9]+)\b/i)
    if (!match) return
    const terminal = (match[1] || match[2] || "").toUpperCase()
    if (/\b(?:JFK|KENNEDY)\b/.test(airport) && !["1", "4", "5", "7", "8"].includes(terminal)) throw new ExampleLimoValidationError(`JFK Airport only has Terminals 1, 4, 5, 7, and 8. Terminal ${terminal} is invalid.`, "invalid_airport_terminal")
    if (/\b(?:LGA|LAGUARDIA)\b/.test(airport) && !["A", "B", "C"].includes(terminal)) throw new ExampleLimoValidationError(`LaGuardia Airport only has Terminals A, B, and C. Terminal ${terminal} is invalid.`, "invalid_airport_terminal")
    if (/\b(?:EWR|NEWARK)\b/.test(airport) && !["A", "B", "C"].includes(terminal)) throw new ExampleLimoValidationError(`Newark Airport only has Terminals A, B, and C. Terminal ${terminal} is invalid.`, "invalid_airport_terminal")
  }
  if (serviceType === "airport_arrival" && !isAirport(pickup)) throw new ExampleLimoValidationError("For an airport arrival, the pickup must identify an airport.", "airport_pickup_required")
  if (serviceType === "airport_departure" && !isAirport(destination)) throw new ExampleLimoValidationError("For an airport departure, the destination must identify an airport.", "airport_destination_required")
  if (serviceType === "airport_arrival") validateTerminal(pickup)
  if (serviceType === "airport_departure") validateTerminal(destination)
  return text(airline, 120) || null
}

export function validateRouteComplexity(stops: unknown) {
  if (stops === undefined) return []
  if (!Array.isArray(stops)) throw new ExampleLimoValidationError("Stops must be supplied as a list of locations.", "invalid_stops")
  const normalized = stops.map((stop) => text(stop, 240)).filter(Boolean)
  if (normalized.length > 3) throw new ExampleLimoValidationError("A maximum of three intermediate stops can be quoted.", "too_many_stops")
  if (normalized.some((stop) => !looksLikeLocation(stop))) throw new ExampleLimoValidationError("Each stop needs a recognizable location.", "stop_address_incomplete")
  return normalized
}

export function validateTrip(serviceType: ExampleLimoServiceType, tripType?: ExampleLimoTripType, returnDepartureTimeIso?: string) {
  if (serviceType === "airport_arrival" || serviceType === "hourly") return
  if (!tripType) throw new ExampleLimoValidationError("Please confirm whether this is one-way or round-trip.", "trip_type_required")
  if (tripType === "round_trip" && !returnDepartureTimeIso) throw new ExampleLimoValidationError("Round-trip rides need the return pickup date and time.", "return_time_required")
}

export function validatePhone(value: unknown) {
  const phone = normalizePhone(value)
  if (!/^\+1\d{10}$/.test(phone)) throw new ExampleLimoValidationError("Before I can quote this ride, I need a valid 10-digit US phone number.", "phone_required")
  return phone
}

export function parseHours(value: unknown) {
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours <= 0) return 2
  return Math.max(2, Math.round(hours * 100) / 100)
}
