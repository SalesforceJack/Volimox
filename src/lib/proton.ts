export type ProtonQuoteRequest = {
  pickup_address: string
  destination_address: string
  departure_time_iso: string
  passenger_count: number
  luggage_count: number
  service_type?: string
  vehicle_name?: string
  quote_vehicle_options?: "both"
}

type ProtonConfig = {
  baseUrl: string
  secret: string
}

function getProtonConfig(): ProtonConfig {
  const baseUrl = process.env.PROTON_API_BASE_URL?.trim().replace(/\/$/, "")
  const secret = process.env.PROTON_API_KEY?.trim()

  if (!baseUrl || !secret) {
    throw new Error("Proton integration is not configured.")
  }

  return { baseUrl, secret }
}

export async function callProton<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const { baseUrl, secret } = getProtonConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "x-proton-integration-secret": secret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    })

    const contentType = response.headers.get("content-type") || ""
    const data = contentType.includes("application/json") ? await response.json() : {}

    if (!response.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "Proton could not complete that request.")
    }

    return data as T
  } finally {
    clearTimeout(timeout)
  }
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export function normalizeQuoteRequest(body: Record<string, unknown>): ProtonQuoteRequest | null {
  const pickup = text(body.pickup_address, 220)
  const destination = text(body.destination_address, 220)
  const departure = text(body.departure_time_iso, 64)
  const passengers = number(body.passenger_count, 0)
  const luggage = number(body.luggage_count, 0)
  const departureDate = new Date(departure)

  if (!pickup || !destination || Number.isNaN(departureDate.getTime())) return null
  if (passengers < 1 || passengers > 6 || luggage < 0 || luggage > 14) return null

  const vehicle = text(body.vehicle_name, 48)
  return {
    pickup_address: pickup,
    destination_address: destination,
    departure_time_iso: departureDate.toISOString(),
    passenger_count: passengers,
    luggage_count: luggage,
    service_type: text(body.service_type, 32) || "point_to_point",
    ...(vehicle ? { vehicle_name: vehicle } : { quote_vehicle_options: "both" }),
  }
}
