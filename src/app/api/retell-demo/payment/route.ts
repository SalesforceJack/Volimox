import { FieldValue } from "firebase-admin/firestore"
import { NextResponse } from "next/server"
import { demoDb } from "@/lib/firebase-admin"
import { publicDemoUrl, verifyRetell } from "@/lib/retell-demo"
import { createDemoToken, normalizeDemoPhone, readQuoteFingerprint, sendDemoSms } from "@/lib/volimox-demo"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyRetell(request, raw)) return NextResponse.json({ ok: false }, { status: 401 })
  const body = JSON.parse(raw) as Record<string, unknown>
  const phone = normalizeDemoPhone(body.phone)
  const fingerprint = String(body.quote_fingerprint || body.quoteFingerprint || "")
  const quote = readQuoteFingerprint(fingerprint)
  const confirmed = body.user_confirmed_price === true || String(body.user_confirmed_price).toLowerCase() === "true"
  if (!phone || !quote || !confirmed) return NextResponse.json({ ok: false, agent_say: "I need your confirmation of the quoted price before I can continue." }, { status: 400 })
  const db = demoDb()
  const id = crypto.randomUUID()
  const record = { id, phone, status: "confirmed", source: "volimox_retell_demo", quote, request: body, createdAt: FieldValue.serverTimestamp() }
  if (db) await db.collection("volimox_demo_reservations").doc(id).set(record)
  const token = createDemoToken({ distanceMiles: Number(quote.miles) || 0, durationMinutes: Number(quote.durationMinutes) || 0, estimatedValueUsd: Number(quote.total) || 0, reservationId: id })
  const url = `${publicDemoUrl()}/demo/${token}`
  const sms = await sendDemoSms(phone, url)
  return NextResponse.json({ ok: true, booking_id: id, payment_link: url, sms_sent: sms.sent, agent_say: sms.sent ? "Perfect. Your reservation is confirmed, and I just texted the confirmation link to your phone." : "Perfect. Your reservation is confirmed and your confirmation link is ready." })
}
