import type { ExampleLimoProviderMode } from "./types"

export const EXAMPLE_LIMO_PRICING_VERSION = "proton-parity-v1"
export const EXAMPLE_LIMO_TIME_ZONE = "America/New_York"
export const EXAMPLE_LIMO_MIN_LEAD_MINUTES = 120
export const EXAMPLE_LIMO_MAX_DAYS_AHEAD = 180
export const EXAMPLE_LIMO_REVIEW_WINDOW_HOURS = 12
export const EXAMPLE_LIMO_AIRPORT_MIN_BASE_USD = 140
export const EXAMPLE_LIMO_GRATUITY_RATE = 0.18
export const EXAMPLE_LIMO_SALES_TAX_RATE = 0.06625

export type ExampleLimoSettings = {
  pricingVersion: string
  baseFare: number
  pricePerMile: number
  minFare: number
  hourlyRate: number
  dailyRate: number
  vehicleMultipliers: Record<string, number>
  vehicleTimeMileRatesByClass: Record<string, { perMinute: number; perMile: number }>
  gratuityRate: number
  salesTaxRate: number
  airportMinBaseFare: number
  maxPassengers: number
  maxLuggage: number
  vehicleCapacity: Record<string, { maxPassengers: number; maxLuggage: number }>
  minLeadMinutes: number
  maxDaysAhead: number
}

export const DEFAULT_EXAMPLE_LIMO_SETTINGS: ExampleLimoSettings = {
  pricingVersion: EXAMPLE_LIMO_PRICING_VERSION,
  baseFare: 20,
  pricePerMile: 3.5,
  minFare: 50,
  hourlyRate: 85,
  dailyRate: 1200,
  vehicleMultipliers: {
    "Luxury Sedan": 1,
    "Large SUV": 1.54528,
  },
  vehicleTimeMileRatesByClass: {
    "Luxury Sedan": { perMinute: 1.41, perMile: 6.259 },
    "Large SUV": { perMinute: 1.75, perMile: 3.5 },
  },
  gratuityRate: EXAMPLE_LIMO_GRATUITY_RATE,
  salesTaxRate: EXAMPLE_LIMO_SALES_TAX_RATE,
  airportMinBaseFare: EXAMPLE_LIMO_AIRPORT_MIN_BASE_USD,
  maxPassengers: 6,
  maxLuggage: 14,
  vehicleCapacity: {
    "Luxury Sedan": { maxPassengers: 3, maxLuggage: 3 },
    "Large SUV": { maxPassengers: 6, maxLuggage: 6 },
  },
  minLeadMinutes: EXAMPLE_LIMO_MIN_LEAD_MINUTES,
  maxDaysAhead: EXAMPLE_LIMO_MAX_DAYS_AHEAD,
}

function numeric(value: unknown, fallback: number, opts?: { min?: number; max?: number }) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  if (opts?.min !== undefined && parsed < opts.min) return fallback
  if (opts?.max !== undefined && parsed > opts.max) return fallback
  return parsed
}

function cleanRate(value: unknown, fallback: { perMinute: number; perMile: number }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback
  const record = value as Record<string, unknown>
  return {
    perMinute: numeric(record.perMinute ?? record.pricePerMinute ?? record.per_minute, fallback.perMinute, { min: 0.0001 }),
    perMile: numeric(record.perMile ?? record.pricePerMile ?? record.per_mile, fallback.perMile, { min: 0.0001 }),
  }
}

/** Merge tenant settings without allowing malformed Firestore data to zero a fare. */
export function normalizeExampleLimoSettings(raw?: Record<string, unknown> | null): ExampleLimoSettings {
  const data = raw && typeof raw === "object" ? raw : {}
  const nested = ["pricing", "rates", "booking", "quote", "limo"].reduce<Record<string, unknown>>((acc, key) => {
    const value = data[key]
    if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(acc, value)
    return acc
  }, {})
  const merged = { ...nested, ...data }
  const vehicleMultipliers = { ...DEFAULT_EXAMPLE_LIMO_SETTINGS.vehicleMultipliers }
  const rawMultipliers = merged.vehicleMultipliers ?? merged.multipliers
  if (rawMultipliers && typeof rawMultipliers === "object" && !Array.isArray(rawMultipliers)) {
    for (const [key, value] of Object.entries(rawMultipliers as Record<string, unknown>)) {
      const parsed = numeric(value, 0, { min: 0.0001 })
      if (parsed > 0) vehicleMultipliers[key] = parsed
    }
  }
  vehicleMultipliers["Luxury Sedan"] = vehicleMultipliers["Luxury Sedan"] || 1
  vehicleMultipliers["Large SUV"] = vehicleMultipliers["Large SUV"] || vehicleMultipliers["Premium SUV"] || 1.54528

  const rawRates = merged.vehicleTimeMileRatesByClass ?? merged.vehicle_time_mile_rates
  const rates = {
    "Luxury Sedan": cleanRate((rawRates as Record<string, unknown> | undefined)?.["Luxury Sedan"], DEFAULT_EXAMPLE_LIMO_SETTINGS.vehicleTimeMileRatesByClass["Luxury Sedan"]),
    "Large SUV": cleanRate((rawRates as Record<string, unknown> | undefined)?.["Large SUV"] ?? (rawRates as Record<string, unknown> | undefined)?.["Premium SUV"], DEFAULT_EXAMPLE_LIMO_SETTINGS.vehicleTimeMileRatesByClass["Large SUV"]),
  }

  return {
    ...DEFAULT_EXAMPLE_LIMO_SETTINGS,
    pricingVersion: typeof merged.pricingVersion === "string" && merged.pricingVersion.trim() ? merged.pricingVersion.trim() : EXAMPLE_LIMO_PRICING_VERSION,
    baseFare: numeric(merged.baseFare ?? merged.base, DEFAULT_EXAMPLE_LIMO_SETTINGS.baseFare, { min: 0 }),
    pricePerMile: numeric(merged.pricePerMile ?? merged.perMile ?? merged.mileRate, DEFAULT_EXAMPLE_LIMO_SETTINGS.pricePerMile, { min: 0.0001 }),
    minFare: numeric(merged.minFare ?? merged.minimumFare, DEFAULT_EXAMPLE_LIMO_SETTINGS.minFare, { min: 0.0001 }),
    hourlyRate: numeric(merged.hourlyRate ?? merged.hourly, DEFAULT_EXAMPLE_LIMO_SETTINGS.hourlyRate, { min: 0.0001 }),
    dailyRate: numeric(merged.dailyRate ?? merged.daily, DEFAULT_EXAMPLE_LIMO_SETTINGS.dailyRate, { min: 0.0001 }),
    vehicleMultipliers,
    vehicleTimeMileRatesByClass: rates,
    gratuityRate: numeric(merged.gratuityRate ?? merged.tipRate, EXAMPLE_LIMO_GRATUITY_RATE, { min: 0, max: 2 }),
    salesTaxRate: numeric(merged.salesTaxRate ?? merged.taxRate, EXAMPLE_LIMO_SALES_TAX_RATE, { min: 0, max: 2 }),
    airportMinBaseFare: numeric(merged.airportMinBaseFare ?? merged.airportMinimumFare, EXAMPLE_LIMO_AIRPORT_MIN_BASE_USD, { min: 0 }),
    minLeadMinutes: numeric(merged.minLeadMinutes, EXAMPLE_LIMO_MIN_LEAD_MINUTES, { min: 0 }),
    maxDaysAhead: numeric(merged.maxDaysAhead, EXAMPLE_LIMO_MAX_DAYS_AHEAD, { min: 1 }),
  }
}

export function getExampleLimoProviderMode(): ExampleLimoProviderMode {
  const raw = process.env.EXAMPLE_LIMO_PROVIDER_MODE?.trim().toLowerCase()
  if (raw === "live" || raw === "simulate" || raw === "disabled") return raw
  if (useProtonCredentials()) return "live"
  return process.env.NODE_ENV === "production" ? "disabled" : "simulate"
}

export function getExampleLimoTenantId(value?: string) {
  return value?.trim() || process.env.VOLIMOX_DEMO_TENANT_ID?.trim() || "volimox-demo"
}

export function getExampleLimoHmacSecret() {
  const secret = process.env.EXAMPLE_LIMO_QUOTE_HMAC_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === "production") throw new Error("EXAMPLE_LIMO_QUOTE_HMAC_SECRET is required in production.")
  return "example-limo-development-quote-secret"
}

export function getExampleLimoGoogleMapsKey() {
  return getExampleLimoGoogleMapsKeys()[0] || ""
}

/**
 * Returns server-usable Google keys in the same order as Proton's routing
 * implementation. Generic Proton keys are considered only after the explicit
 * Example Limo opt-in has been enabled.
 */
export function getExampleLimoGoogleMapsKeys() {
  const candidates = [
    process.env.EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY,
    useProtonCredentials() ? process.env.GOOGLE_MAPS_API_KEY : "",
    useProtonCredentials() ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY : "",
    useProtonCredentials() ? process.env.VITE_GOOGLE_MAPS_API_KEY : "",
  ]
  return candidates
    .map((value) => value?.trim() || "")
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index && isLikelyValidGoogleServerKey(value))
}

function firstConfigured(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim() || "").find(Boolean) || ""
}

function isLikelyValidGoogleServerKey(value: string) {
  return !/placeholder|example|changeme|your_/i.test(value) && /^AIza[\w-]{20,}$/.test(value)
}

/** Explicit local-test opt-in for reusing the owner's existing Proton provider credentials. */
export function useProtonCredentials() {
  return process.env.EXAMPLE_LIMO_USE_PROTON_CREDENTIALS?.trim().toLowerCase() === "true"
}

export function getExampleLimoStripeSecretKey() {
  return firstConfigured(process.env.EXAMPLE_LIMO_STRIPE_SECRET_KEY, useProtonCredentials() ? process.env.STRIPE_SECRET_KEY : "")
}

export function getExampleLimoStripeWebhookSecret() {
  return firstConfigured(process.env.EXAMPLE_LIMO_STRIPE_WEBHOOK_SECRET, useProtonCredentials() ? process.env.STRIPE_WEBHOOK_SECRET : "")
}

export function getExampleLimoTwilioAccountSid() {
  return firstConfigured(process.env.EXAMPLE_LIMO_TWILIO_ACCOUNT_SID, useProtonCredentials() ? process.env.TWILIO_ACCOUNT_SID : "")
}

export function getExampleLimoTwilioAuthToken() {
  return firstConfigured(process.env.EXAMPLE_LIMO_TWILIO_AUTH_TOKEN, useProtonCredentials() ? process.env.TWILIO_AUTH_TOKEN : "")
}

export function getExampleLimoTwilioMessagingServiceSid() {
  return firstConfigured(process.env.EXAMPLE_LIMO_TWILIO_MESSAGING_SERVICE_SID, useProtonCredentials() ? process.env.TWILIO_MESSAGING_SERVICE_SID : "")
}

export function getExampleLimoTwilioPhoneNumber() {
  return firstConfigured(process.env.EXAMPLE_LIMO_TWILIO_PHONE_NUMBER, useProtonCredentials() ? process.env.TWILIO_PHONE_NUMBER : "")
}

export function isExampleLimoLiveConfigured() {
  return Boolean(
    getExampleLimoStripeSecretKey()
    && getExampleLimoStripeWebhookSecret()
    && getExampleLimoTwilioAccountSid()
    && getExampleLimoTwilioAuthToken()
    && (getExampleLimoTwilioMessagingServiceSid() || getExampleLimoTwilioPhoneNumber()),
  )
}
