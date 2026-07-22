import { NextResponse } from "next/server"
import { buildGlobalDemoQuote, createQuoteFingerprint, normalizeDemoPhone } from "@/lib/volimox-demo"
import { verifyRetell } from "@/lib/retell-demo"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyRetell(request, raw)) return NextResponse.json({ ok: false }, { status: 401 })
  const body = JSON.parse(raw) as Record<string, unknown>
  const pickup = String(body.pickup_address || "").trim().slice(0, 240)
  const destination = String(body.destination_address || "").trim().slice(0, 240)
  const passengers = Math.max(1, Math.min(80, Math.trunc(Number(body.passenger_count) || 1)))
  if (!pickup || !destination || !normalizeDemoPhone(body.phone)) return NextResponse.json({ ok: false, error: "Missing trip details." }, { status: 400 })
  try {
    const route = await buildGlobalDemoQuote({ pickup, destination, passengers })
    const issued = new Date().toISOString()
    const make = (vehicle: string, multiplier: number) => {
      const total = Math.round(route.estimatedValueUsd * multiplier * 100) / 100
      const fingerprint = createQuoteFingerprint({ vehicle, total, pickup, destination, passengers, miles: route.distanceMiles, durationMinutes: route.durationMinutes })
      return { quote: { miles: route.distanceMiles, durationMinutes: route.durationMinutes }, quotedTotalUsd: total, quoteFingerprint: fingerprint, quote_fingerprint: fingerprint, quoteIssuedAt: issued, quote_issued_at: issued }
    }
    const sedan = make("Luxury Sedan", 1)
    const suv = make("Large SUV", 1.28)
    return NextResponse.json({ ok: true, dual_quote: true, quotes_by_vehicle: { "Luxury Sedan": sedan, "Large SUV": suv }, quote: sedan.quote, quotedTotalUsd: sedan.quotedTotalUsd, quoteFingerprint: sedan.quoteFingerprint, quote_fingerprint: sedan.quoteFingerprint, quoteIssuedAt: issued, quote_issued_at: issued, agent_say_price: `The luxury sedan is $${sedan.quotedTotalUsd.toFixed(2)}, and the large SUV is $${suv.quotedTotalUsd.toFixed(2)}. Which vehicle would you prefer?` })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Quote failed." }, { status: 502 })
  }
}
