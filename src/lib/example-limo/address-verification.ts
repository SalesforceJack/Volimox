import { getExampleLimoGoogleMapsKeys } from "./config"
import { looksLikeLocation, looksResolvableByGoogle } from "./validation"

export type ExampleLimoAddressVerificationResult =
  | { ok: true; status: "confirmed"; resolved_address: string; spoken_address: string }
  | { ok: true; status: "needs_confirmation"; resolved_address: string; spoken_address: string; original_address: string; agent_say_line: string }
  | { ok: false; status: "unresolved"; original_address: string; agent_say_line: string }

type GeocodeResult = {
  formatted_address?: string
  address_components?: Array<{ types?: string[]; short_name?: string }>
}

type GeocodeResponse = {
  status?: string
  results?: GeocodeResult[]
}

const COUNTRY_SEGMENTS = new Set(["usa", "us", "united states", "united states of america"])
const TRAILING_POSTCODE = /\s+\d{5}(?:-\d{4})?$/
const STREET_WORDS: Record<string, string> = {
  street: "st", avenue: "ave", road: "rd", drive: "dr", court: "ct", boulevard: "blvd",
  parkway: "pkwy", lane: "ln", place: "pl", highway: "hwy", route: "rte",
}

export function toSpokenAddress(formattedAddress: string) {
  const segments = formattedAddress.split(",").map((segment) => segment.trim()).filter(Boolean)
  if (segments.length < 2) return formattedAddress.trim()
  if (COUNTRY_SEGMENTS.has(segments[segments.length - 1]!.toLowerCase())) segments.pop()
  if (!segments.length) return formattedAddress.trim()
  const last = segments[segments.length - 1]!
  segments[segments.length - 1] = last.replace(TRAILING_POSTCODE, "").trim()
  return segments.filter(Boolean).join(", ")
}

function normalizedAddress(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(united states(?: of america)?|usa|us)\b/g, "")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => STREET_WORDS[part] || part)
    .join(" ")
}

function addressDrifted(original: string, resolved: string) {
  const left = normalizedAddress(original)
  const right = normalizedAddress(resolved)
  return Boolean(left && right && left !== right && !left.includes(right) && !right.includes(left))
}

function unresolved(kind: "pickup" | "destination", originalAddress: string): ExampleLimoAddressVerificationResult {
  const label = kind === "destination" ? "drop-off" : "pickup"
  return {
    ok: false,
    status: "unresolved",
    original_address: originalAddress,
    agent_say_line: `Could you please repeat your ${label} address with the street number, city, and state?`,
  }
}

export async function verifyExampleLimoAddress(
  rawAddress: unknown,
  kind: "pickup" | "destination" = "pickup",
  fetcher: typeof fetch = fetch,
): Promise<ExampleLimoAddressVerificationResult> {
  const originalAddress = typeof rawAddress === "string" ? rawAddress : ""
  const address = originalAddress.trim()
  if (!address || (!looksLikeLocation(address) && !looksResolvableByGoogle(address))) return unresolved(kind, originalAddress)

  const keys = getExampleLimoGoogleMapsKeys()
  if (!keys.length) {
    if (process.env.NODE_ENV === "production") return unresolved(kind, originalAddress)
    return { ok: true, status: "confirmed", resolved_address: address, spoken_address: address }
  }

  for (const key of keys) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
      url.searchParams.set("address", address)
      url.searchParams.set("key", key)
      const response = await fetcher(url, { cache: "no-store" })
      const payload = await response.json().catch(() => null) as GeocodeResponse | null
      const resolved = payload?.status === "OK" ? payload.results?.[0]?.formatted_address?.trim() : ""
      if (!response.ok || !resolved) continue

      const spoken = toSpokenAddress(resolved)
      if (addressDrifted(address, resolved)) {
        const label = kind === "destination" ? "drop-off" : "pickup"
        return {
          ok: true,
          status: "needs_confirmation",
          resolved_address: resolved,
          spoken_address: spoken,
          original_address: originalAddress,
          agent_say_line: `I found ${spoken} for your ${label} — is that correct, or would you like to provide a different address?`,
        }
      }
      return { ok: true, status: "confirmed", resolved_address: resolved, spoken_address: spoken }
    } catch {
      // Try the next configured key. An unresolved result is spoken as a repair question.
    }
  }

  return unresolved(kind, originalAddress)
}
