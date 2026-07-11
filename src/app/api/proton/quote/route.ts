import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { callProton, normalizeQuoteRequest } from "@/lib/proton"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!withinDemoRateLimit(`quote:${getClientIp(request)}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Demo request limit reached. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json()
    const quote = normalizeQuoteRequest(body)
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Enter a valid route, future pickup time, passenger count, and luggage count." }, { status: 400 })
    }

    const result = await callProton<Record<string, unknown>>("/api/integrations/retell/quote", quote)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[volimox/proton/quote]", error)
    return NextResponse.json({ ok: false, error: "The live pricing system is unavailable right now." }, { status: 502 })
  }
}
