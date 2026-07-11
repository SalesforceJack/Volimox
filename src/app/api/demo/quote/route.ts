import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { buildGlobalDemoQuote, normalizeDemoRoute } from "@/lib/volimox-demo"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!withinDemoRateLimit(`global-quote:${getClientIp(request)}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Demo request limit reached. Please try again later." }, { status: 429 })
  }

  try {
    const route = normalizeDemoRoute(await request.json())
    if (!route) return NextResponse.json({ ok: false, error: "Enter two addresses and a valid passenger count." }, { status: 400 })

    const quote = await buildGlobalDemoQuote(route)
    return NextResponse.json({
      ok: true,
      quote: { miles: quote.distanceMiles, durationMinutes: quote.durationMinutes },
      quotedTotalUsd: quote.estimatedValueUsd,
      quoteFingerprint: `demo-${Date.now()}`,
      quoteIssuedAt: new Date().toISOString(),
      distanceMiles: quote.distanceMiles,
      durationMinutes: quote.durationMinutes,
      estimatedValueUsd: quote.estimatedValueUsd,
      agent_say_price: `The route is ${quote.distanceMiles.toFixed(1)} miles and about ${quote.durationMinutes} minutes. The live mile-price tool returned an illustrative operating quote of $${quote.estimatedValueUsd.toFixed(2)}.`,
    })
  } catch (error) {
    console.error("[volimox/demo/quote]", error)
    return NextResponse.json({ ok: false, error: "The global routing tool could not resolve that trip." }, { status: 502 })
  }
}
