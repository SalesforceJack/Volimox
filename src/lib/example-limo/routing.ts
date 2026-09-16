import { getExampleLimoGoogleMapsKeys } from "./config"
import type { ExampleLimoRouteLeg, ExampleLimoRouteMetrics } from "./types"
import { ExampleLimoValidationError, looksLikeLocation, looksResolvableByGoogle } from "./validation"

const METERS_PER_MILE = 1609.34

type RouteWaypoint =
  | { address: string }
  | { location: { latLng: { latitude: number; longitude: number } } }

type RoutesPayload = {
  routes?: Array<{
    duration?: string
    staticDuration?: string
    distanceMeters?: number
    legs?: Array<{ duration?: string; staticDuration?: string; distanceMeters?: number }>
    travelAdvisory?: { tollInfo?: { estimatedPrice?: Array<{ units?: string; nanos?: number }> } }
  }>
  error?: { message?: string }
}

type GeocodeResult = {
  formatted_address?: string
  address_components?: Array<{ types?: string[]; short_name?: string }>
  geometry?: { location?: { lat?: number; lng?: number } }
  plus_code?: { global_code?: string }
}

type GeocodePayload = {
  status?: string
  results?: GeocodeResult[]
  error_message?: string
}

type PlacePayload = {
  status?: string
  candidates?: Array<{
    formatted_address?: string
    geometry?: { location?: { lat?: number; lng?: number } }
    plus_code?: { global_code?: string }
  }>
  error_message?: string
}

type ResolvedAddress = {
  waypoint: RouteWaypoint
  formattedAddress: string
}

function hash(value: string) {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) result = Math.imul(result ^ value.charCodeAt(index), 16777619)
  return result >>> 0
}

function simulatedRoute(pickup: string, destination: string, stops: string[]): ExampleLimoRouteMetrics {
  const seed = hash(`${pickup}|${destination}|${stops.join("|")}`)
  const distanceMiles = 8 + (seed % 4200) / 100
  const staticDurationMinutes = Math.max(8, Math.round((distanceMiles * 2.05 + (seed % 17)) * 10) / 10)
  const trafficExtra = 2 + (seed % 13)
  const durationMinutes = staticDurationMinutes + trafficExtra
  const tollAmount = Math.round(((seed % 31) / 10) * 100) / 100
  return {
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes,
    staticDurationMinutes,
    trafficRatio: durationMinutes / staticDurationMinutes,
    tollAmount,
  }
}

function toRouteWaypoint(value: string): RouteWaypoint {
  const coordinates = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (coordinates) {
    const latitude = Number(coordinates[1])
    const longitude = Number(coordinates[2])
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { location: { latLng: { latitude, longitude } } }
    }
  }
  return { address: value }
}

function parseDurationSeconds(durationText: unknown) {
  if (typeof durationText !== "string" || !durationText.trim()) return null
  const parsed = Number.parseInt(durationText.replace(/[^0-9]/g, ""), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseTollAmount(toll: { units?: string; nanos?: number } | undefined) {
  if (!toll) return 0
  const units = Number.parseInt(toll.units || "0", 10)
  const nanos = typeof toll.nanos === "number" && Number.isFinite(toll.nanos) ? toll.nanos : 0
  return (Number.isFinite(units) ? units : 0) + nanos / 1_000_000_000
}

function isLandmarkOrAirport(address: string) {
  const normalized = address.toLowerCase()
  const airportPatterns = ["jfk", "lga", "ewr", "airport", "terminal", "hub"]
  const landmarkPatterns = [
    "times square", "central park", "penn station", "pennsylvania station", "grand central",
    "empire state", "statue of liberty", "rockefeller", "broadway", "metropolitan museum",
    "lincoln center", "barclays center", "madison square garden", "msg", "yankee stadium",
    "citi field", "metlife stadium", "american dream", "wall street", "oculus",
    "one world trade", "world trade center", "brooklyn bridge", "high line", "radio city",
    "carnegie hall", "columbia university", "nyu", "coney island", "port authority",
    "hoboken terminal", "hudson yards", "chelsea market", "soho", "chinatown",
    "little italy", "harlem", "williamsburg", "dumbo", "liberty state park",
    "journal square", "newport", "fort lee", "exchange place", "jacob javits",
    "javits center", "united nations", "moma", "guggenheim", "brooklyn museum",
    "chrysler building", "vessel", "edge nyc", "summit one vanderbilt",
  ]
  const landmarkNouns = [
    "stadium", "museum", "station", "terminal", "square", "center", "university",
    "college", "park", "plaza", "building", "garden", "hall", "theatre", "theater",
    "school", "hospital", "arena", "bridge", "market", "hotel", "house", "church",
    "cathedral", "temple", "memorial", "library", "zoo", "aquarium",
  ]
  const isAirport = airportPatterns.some((pattern) => normalized.includes(pattern))
  const isLandmark = landmarkPatterns.some((pattern) => normalized.includes(pattern))
    || landmarkNouns.some((noun) => new RegExp(`\\b${noun}\\b`, "i").test(normalized))
  const lacksStreetNumber = !/\b\d+\s+/.test(address)
  return isAirport || (isLandmark && lacksStreetNumber)
}

/** Detailed curbside/parking labels should stay as addresses, not POI centroids. */
function shouldResolveLandmarkToCoordinates(address: string) {
  if (/\b(?:short[- ]term|long[- ]term)?\s*(?:parking|garage|lot|curbside|pickup|drop[- ]?off)\b/i.test(address)) return false
  return isLandmarkOrAirport(address)
}

function isUsCountry(result: GeocodeResult) {
  const country = result.address_components?.find((component) => component.types?.includes("country"))?.short_name
  if (country && country !== "US") throw new ExampleLimoValidationError("Example Limo can only quote United States routes.", "destination_outside_us")
}

function coordinateOrPlusCode(result: GeocodeResult | PlacePayload["candidates"][number] | undefined) {
  const plusCode = result?.plus_code?.global_code?.trim()
  if (plusCode) return plusCode
  const location = result?.geometry?.location
  if (location && typeof location.lat === "number" && typeof location.lng === "number" && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    return `${location.lat},${location.lng}`
  }
  return null
}

async function resolveLandmarkToCoordinatesOrPlusCode(query: string, keys: string[], fetcher: typeof fetch): Promise<{ waypointValue: string; formattedAddress?: string } | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  for (const key of keys) {
    try {
      const placesUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json")
      placesUrl.searchParams.set("input", trimmed)
      placesUrl.searchParams.set("inputtype", "textquery")
      placesUrl.searchParams.set("fields", "formatted_address,geometry,plus_code,place_id")
      placesUrl.searchParams.set("key", key)
      const response = await fetcher(placesUrl, { cache: "no-store" })
      const payload = await response.json().catch(() => null) as PlacePayload | null
      if (!response.ok || payload?.status !== "OK") continue
      const candidate = payload.candidates?.[0]
      const resolved = coordinateOrPlusCode(candidate)
      if (resolved) return { waypointValue: resolved, formattedAddress: candidate?.formatted_address?.trim() || undefined }
    } catch {
      // Try the next configured key and then geocoding fallback below.
    }
  }

  for (const key of keys) {
    try {
      const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json")
      geocodeUrl.searchParams.set("address", trimmed)
      geocodeUrl.searchParams.set("key", key)
      const response = await fetcher(geocodeUrl, { cache: "no-store" })
      const payload = await response.json().catch(() => null) as GeocodePayload | null
      if (!response.ok || payload?.status !== "OK") continue
      const result = payload.results?.[0]
      const resolved = coordinateOrPlusCode(result)
      if (resolved) return { waypointValue: resolved, formattedAddress: result?.formatted_address?.trim() || undefined }
    } catch {
      // The route request will report a useful error if all geocoding attempts fail.
    }
  }
  return null
}

async function geocodeAddress(value: string, keys: string[], fetcher: typeof fetch) {
  let lastError = "Could not locate the address."
  for (const key of keys) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
      url.searchParams.set("address", value)
      url.searchParams.set("key", key)
      const response = await fetcher(url, { cache: "no-store" })
      const payload = await response.json().catch(() => null) as GeocodePayload | null
      if (!response.ok) {
        lastError = `Google Geocoding returned HTTP ${response.status}.`
        continue
      }
      if (payload?.status === "ZERO_RESULTS" || !payload?.results?.[0]) {
        lastError = `Could not locate ${value}. Please verify the address and city/state.`
        continue
      }
      const result = payload.results[0]
      isUsCountry(result)
      return { formattedAddress: result.formatted_address || value }
    } catch (error) {
      if (error instanceof ExampleLimoValidationError) throw error
      lastError = error instanceof Error ? error.message : lastError
    }
  }
  throw new ExampleLimoValidationError(lastError, "geocode_failed")
}

async function resolveRoutingAddress(value: string, keys: string[], fetcher: typeof fetch): Promise<ResolvedAddress> {
  if (shouldResolveLandmarkToCoordinates(value)) {
    const resolved = await resolveLandmarkToCoordinatesOrPlusCode(value, keys, fetcher)
    if (resolved) return { waypoint: toRouteWaypoint(resolved.waypointValue), formattedAddress: resolved.formattedAddress || value }
  }
  const geocoded = await geocodeAddress(value, keys, fetcher)
  return { waypoint: { address: geocoded.formattedAddress }, formattedAddress: geocoded.formattedAddress }
}

export async function computeRouteLeg(input: {
  pickup: string
  destination: string
  stops?: string[]
  departureTimeIso?: string
  fetcher?: typeof fetch
  allowSimulation?: boolean
}): Promise<ExampleLimoRouteLeg> {
  const pickup = input.pickup.trim()
  const destination = input.destination.trim()
  const stops = (input.stops || []).map((stop) => stop.trim()).filter(Boolean)
  // The quote validator allows Google-resolvable numbered streets and named
  // places without a spoken city/state. Do not reject those values again
  // before the Places/Geocoding resolver gets a chance to canonicalize them.
  const acceptableRouteLocation = (value: string) => looksLikeLocation(value) || looksResolvableByGoogle(value)
  if (!acceptableRouteLocation(pickup) || !acceptableRouteLocation(destination)) throw new ExampleLimoValidationError("Both pickup and drop-off must be recognizable locations.", "route_location_invalid")

  const fetcher = input.fetcher || fetch
  const keys = getExampleLimoGoogleMapsKeys()
  if (!keys.length) {
    if (input.allowSimulation === false || process.env.NODE_ENV === "production") throw new Error("EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY is required for live routing.")
    const metrics = simulatedRoute(pickup, destination, stops)
    return { ...metrics, pickupAddress: pickup, destinationAddress: destination, departureTimeIso: input.departureTimeIso, stops }
  }

  let validDepartureTime: string | undefined
  if (input.departureTimeIso) {
    const parsed = new Date(input.departureTimeIso)
    if (Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now() + 5 * 60 * 1000) validDepartureTime = parsed.toISOString()
  }

  const origin = await resolveRoutingAddress(pickup, keys, fetcher)
  const destinationResolved = await resolveRoutingAddress(destination, keys, fetcher)
  const resolvedStops: ResolvedAddress[] = []
  for (const stop of stops) resolvedStops.push(await resolveRoutingAddress(stop, keys, fetcher))

  const body: Record<string, unknown> = {
    origin: origin.waypoint,
    destination: destinationResolved.waypoint,
    intermediates: resolvedStops.map((stop) => stop.waypoint),
    travelMode: "DRIVE",
    routingPreference: validDepartureTime ? "TRAFFIC_AWARE_OPTIMAL" : "TRAFFIC_AWARE",
    extraComputations: ["TOLLS"],
    units: "IMPERIAL",
  }
  if (validDepartureTime) body.departureTime = validDepartureTime

  let payload: RoutesPayload | null = null
  let lastError = "Google Routes could not resolve this trip."
  for (const key of keys) {
    try {
      const response = await fetcher("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters,routes.legs.duration,routes.legs.staticDuration,routes.legs.distanceMeters,routes.travelAdvisory.tollInfo",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      })
      const candidate = await response.json().catch(() => null) as RoutesPayload | null
      if (response.ok && candidate?.routes?.[0]) {
        payload = candidate
        break
      }
      lastError = candidate?.error?.message || `Google Routes returned HTTP ${response.status}.`
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
    }
  }
  if (!payload?.routes?.[0]) throw new Error(lastError)

  const route = payload.routes[0]
  const legDistanceMeters = (route.legs || []).reduce((sum, leg) => sum + (typeof leg.distanceMeters === "number" && Number.isFinite(leg.distanceMeters) && leg.distanceMeters > 0 ? leg.distanceMeters : 0), 0)
  const distanceMeters = typeof route.distanceMeters === "number" && Number.isFinite(route.distanceMeters) && route.distanceMeters > 0 ? route.distanceMeters : legDistanceMeters
  if (!distanceMeters || distanceMeters <= 0) throw new Error("Route response did not include a usable distance.")

  const legDurationSeconds = (route.legs || []).reduce((sum, leg) => sum + (parseDurationSeconds(leg.duration) || 0), 0)
  const legStaticDurationSeconds = (route.legs || []).reduce((sum, leg) => sum + (parseDurationSeconds(leg.staticDuration) || 0), 0)
  const parsedRouteDuration = parseDurationSeconds(route.duration)
  const durationSeconds = Math.max(parsedRouteDuration ?? legDurationSeconds, 1)
  const staticDurationSeconds = Math.max(parseDurationSeconds(route.staticDuration) ?? (legStaticDurationSeconds || parsedRouteDuration || legDurationSeconds || durationSeconds), 1)
  const distanceMiles = distanceMeters / METERS_PER_MILE
  const durationMinutes = durationSeconds / 60
  const staticDurationMinutes = staticDurationSeconds / 60

  return {
    distanceMiles,
    durationMinutes,
    staticDurationMinutes,
    trafficRatio: durationMinutes / staticDurationMinutes,
    tollAmount: parseTollAmount(route.travelAdvisory?.tollInfo?.estimatedPrice?.[0]),
    pickupAddress: origin.formattedAddress,
    destinationAddress: destinationResolved.formattedAddress,
    departureTimeIso: input.departureTimeIso,
    stops: resolvedStops.map((stop) => stop.formattedAddress),
  }
}
