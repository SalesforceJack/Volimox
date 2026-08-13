import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { buildGlobalDemoQuote, normalizeDemoRoute } from "@/lib/volimox-demo"
import { logEvent, requestIdFor, withRequestId } from "@/lib/observability"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const requestId = requestIdFor(request)
  if (!withinDemoRateLimit(`global-quote:${getClientIp(request)}`, 8, 60 * 60 * 1000)) {
    logEvent("warn", "demo.quote.rate_limited", { requestId })
    return withRequestId(NextResponse.json({ ok: false, error: "Demo request limit reached. Please try again later." }, { status: 429 }), requestId)
  }

  try {
    const route = normalizeDemoRoute(await request.json())
    if (!route) return withRequestId(NextResponse.json({ ok: false, error: "Enter two addresses and a valid passenger count." }, { status: 400 }), requestId)

    const quote = await buildGlobalDemoQuote(route)
    logEvent("info", "demo.quote.completed", { requestId })
    return withRequestId(NextResponse.json({
      ok: true,
      quote: { miles: quote.distanceMiles, durationMinutes: quote.durationMinutes },
      quotedTotalUsd: quote.estimatedValueUsd,
      quoteFingerprint: `demo-${Date.now()}`,
      quoteIssuedAt: new Date().toISOString(),
      distanceMiles: quote.distanceMiles,
      durationMinutes: quote.durationMinutes,
      estimatedValueUsd: quote.estimatedValueUsd,
      agent_say_price: `The route is ${quote.distanceMiles.toFixed(1)} miles and about ${quote.durationMinutes} minutes. The live mile-price tool returned an illustrative operating quote of $${quote.estimatedValueUsd.toFixed(2)}.`,
    }), requestId)
  } catch (error) {
    logEvent("error", "demo.quote.failed", { requestId, error })
    return withRequestId(NextResponse.json({ ok: false, error: "The global routing tool could not resolve that trip." }, { status: 502 }), requestId)
  }
}
