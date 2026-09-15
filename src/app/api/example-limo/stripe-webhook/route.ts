import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { markExampleLimoReservationPaid } from "@/lib/example-limo/checkout"
import { getExampleLimoStripeWebhookSecret } from "@/lib/example-limo/config"

export const runtime = "nodejs"

function verifyStripeSignature(rawBody: string, signature: string, secret: string) {
  const timestamp = signature.split(",").find((part) => part.startsWith("t="))?.slice(2)
  const signatures = signature.split(",").filter((part) => part.startsWith("v1=")).map((part) => part.slice(3))
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  return signatures.some((value) => value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected)))
}

export async function POST(request: Request) {
  const raw = await request.text()
  const secret = getExampleLimoStripeWebhookSecret()
  if (!secret) return NextResponse.json({ ok: false, error: "Webhook is not configured." }, { status: 503 })
  const signature = request.headers.get("stripe-signature") || ""
  if (!verifyStripeSignature(raw, signature, secret)) return NextResponse.json({ ok: false, error: "Invalid Stripe signature." }, { status: 400 })
  try {
    const event = JSON.parse(raw) as {
      type?: string
      data?: { object?: {
        id?: string
        payment_status?: string
        amount_total?: number
        currency?: string
        metadata?: { reservationId?: string; tenantId?: string }
      } }
    }
    const object = event.data?.object
    if (event.type !== "checkout.session.completed" || object?.payment_status !== "paid") return NextResponse.json({ ok: true, ignored: true })
    const metadata = object.metadata
    if (!object.id || !metadata?.reservationId || !metadata.tenantId || !Number.isInteger(object.amount_total) || !object.currency) {
      return NextResponse.json({ ok: false, error: "Stripe checkout metadata is incomplete." }, { status: 400 })
    }
    const result = await markExampleLimoReservationPaid({
      tenantId: metadata.tenantId,
      reservationId: metadata.reservationId,
      sessionId: object.id,
      amountTotalCents: object.amount_total,
      currency: object.currency,
    })
    if (!result.reservation) return NextResponse.json({ ok: false, error: `Stripe payment rejected: ${result.reason}.` }, { status: result.reason === "reservation_not_found" ? 404 : 409 })
    return NextResponse.json({ ok: true, processed: result.processed === true, idempotent: result.idempotent === true })
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid webhook payload." }, { status: 400 })
  }
}
