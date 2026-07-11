import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { createDemoToken, normalizeDemoPhone, sendDemoSms } from "@/lib/volimox-demo"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!withinDemoRateLimit(`demo-link:${getClientIp(request)}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Demo-link request limit reached. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const phone = normalizeDemoPhone(body.phone)
    const distanceMiles = Number(body.distanceMiles)
    const durationMinutes = Number(body.durationMinutes)
    const estimatedValueUsd = Number(body.estimatedValueUsd)
    if (!phone || !Number.isFinite(distanceMiles) || !Number.isFinite(durationMinutes) || !Number.isFinite(estimatedValueUsd)) {
      return NextResponse.json({ ok: false, error: "A valid mobile number and live route result are required." }, { status: 400 })
    }

    const token = createDemoToken({ distanceMiles, durationMinutes, estimatedValueUsd })
    const url = new URL(`/demo/${token}`, request.url).toString()
    const sms = await sendDemoSms(phone, url)
    return NextResponse.json({ ok: true, url, smsSent: sms.sent, smsReason: sms.reason })
  } catch (error) {
    console.error("[volimox/demo/link]", error)
    return NextResponse.json({ ok: false, error: "The demo continuation link could not be created." }, { status: 502 })
  }
}
