import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { callProton, normalizeQuoteRequest } from "@/lib/proton"

export const runtime = "nodejs"

function getString(body: Record<string, unknown>, name: string, maxLength = 160) {
  return typeof body[name] === "string" ? body[name].trim().slice(0, maxLength) : ""
}

export async function POST(request: Request) {
  if (!withinDemoRateLimit(`payment:${getClientIp(request)}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Payment-link request limit reached. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json()
    const quote = normalizeQuoteRequest(body)
    const phone = getString(body, "phone", 32)
    const quoteFingerprint = getString(body, "quote_fingerprint", 600)
    const quoteIssuedAt = getString(body, "quote_issued_at", 64)

    if (!quote || !phone || !quoteFingerprint || !quoteIssuedAt || body.user_confirmed_price !== true) {
      return NextResponse.json({ ok: false, error: "A current quote, mobile number, and explicit price approval are required." }, { status: 400 })
    }

    const result = await callProton<Record<string, unknown>>("/api/integrations/retell/payment", {
      ...quote,
      phone,
      quote_fingerprint: quoteFingerprint,
      quote_issued_at: quoteIssuedAt,
      user_confirmed_price: true,
      send_sms: true,
    })

    return NextResponse.json({
      ok: result.ok === true,
      code: result.code,
      error: result.error,
      assistantPrompt: result.assistantPrompt || result.assistant_message,
      checkoutUrl: result.checkoutUrl,
      reservationId: result.reservationId,
      amountUsd: result.amountUsd,
      requiresAdminApproval: result.requiresAdminApproval === true,
    })
  } catch (error) {
    console.error("[volimox/proton/payment]", error)
    return NextResponse.json({ ok: false, error: "The payment link could not be created." }, { status: 502 })
  }
}
