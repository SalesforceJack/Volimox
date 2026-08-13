import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { callProton, normalizeQuoteRequest } from "@/lib/proton"
import { logEvent, requestIdFor, withRequestId } from "@/lib/observability"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const requestId = requestIdFor(request)
  if (!withinDemoRateLimit(`quote:${getClientIp(request)}`, 8, 60 * 60 * 1000)) {
    logEvent("warn", "proton.quote.rate_limited", { requestId })
    return withRequestId(NextResponse.json({ ok: false, error: "Demo request limit reached. Please try again later." }, { status: 429 }), requestId)
  }

  try {
    const body = await request.json()
    const quote = normalizeQuoteRequest(body)
    if (!quote) {
      return withRequestId(NextResponse.json({ ok: false, error: "Enter a valid route, future pickup time, passenger count, and luggage count." }, { status: 400 }), requestId)
    }

    const result = await callProton<Record<string, unknown>>("/api/integrations/retell/quote", quote, { requestId })
    logEvent("info", "proton.quote.completed", { requestId })
    return withRequestId(NextResponse.json(result), requestId)
  } catch (error) {
    logEvent("error", "proton.quote.failed", { requestId, error })
    return withRequestId(NextResponse.json({ ok: false, error: "The live pricing system is unavailable right now." }, { status: 502 }), requestId)
  }
}
