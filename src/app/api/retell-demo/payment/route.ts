import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { NextResponse } from "next/server"
import { demoDb, getDemoReservationsCollection, getSideEffectsCollection, getDemoTenantId, isProductionFirebaseRequired } from "@/lib/firebase-admin"
import { publicDemoUrl, verifyRetell } from "@/lib/retell-demo"
import { createDemoToken, normalizeDemoPhone, readQuoteFingerprint, sendDemoSms, validateDemoSmsConfig } from "@/lib/volimox-demo"
import { hashRateLimitKey } from "@/lib/durable-rate-limit"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"

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
  if (!db && isProductionFirebaseRequired()) {
    return NextResponse.json({ ok: false, agent_say: "I cannot complete the reservation right now because persistence is unavailable." }, { status: 500 })
  }

  const callId = String(body.call_id || body.callId || (body.call && typeof body.call === "object" && (body.call as Record<string, unknown>).call_id) || "")
  const idKey = callId || `${phone}:${fingerprint}`
  const id = `RETELL-RES-${idKey}`
  const tenantId = getDemoTenantId()
  let smsSentResult = false

  if (db) {
    const docRef = getDemoReservationsCollection(db, tenantId).doc(id)
    await docRef.set({
      id,
      tenantId,
      phone,
      status: "confirmed",
      source: "volimox_retell_demo",
      schemaVersion: 1,
      quote,
      request: { phone: hashRateLimitKey(phone), confirmed: true, quoteFingerprint: fingerprint },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAtServer: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
    }, { merge: true })
  }

  const token = createDemoToken({ distanceMiles: Number(quote.miles) || 0, durationMinutes: Number(quote.durationMinutes) || 0, estimatedValueUsd: Number(quote.total) || 0, reservationId: id })
  const url = `${publicDemoUrl()}/demo/${token}`

  const sideEffectsRef = db ? getSideEffectsCollection(db, tenantId) : null
  const effectId = deriveSideEffectId(id, 'retell-payment-sms')

  const store = createSideEffectStore(db, sideEffectsRef)

  try {
    const outcome = await executeSideEffect(
      store,
      effectId,
      'retell-payment-sms',
      async () => {
        const sms = await sendDemoSms(phone, url)
        if (sms.sent === false) throw new ProviderRejectedError(sms.reasonCode)
        return { value: sms, providerId: sms.messageSid }
      },
      {
        preflight: () => {
          const config = validateDemoSmsConfig()
          if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
        },
      },
    )

    if (outcome.kind === "executed") {
      smsSentResult = true
    } else if (outcome.kind === "already_completed") {
      smsSentResult = outcome.record.state === "sent"
    }

    if (db && outcome.kind === "executed") {
      const docRef = getDemoReservationsCollection(db, tenantId).doc(id)
      await docRef.update({ smsStatus: "sent", smsSent: true, updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
    } else if (db && (outcome.kind === "persistence_unavailable" || outcome.kind === "preflight_failed" || outcome.kind === "provider_rejected")) {
      const docRef = getDemoReservationsCollection(db, tenantId).doc(id)
      await docRef.update({ smsStatus: "failed", smsSent: false, updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
    } else if (db && outcome.kind === "uncertain") {
      const docRef = getDemoReservationsCollection(db, tenantId).doc(id)
      await docRef.update({ smsStatus: "uncertain_after_dispatch", smsSent: false, updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
    }
  } catch (err: any) {
    if (db) {
      const docRef = getDemoReservationsCollection(db, tenantId).doc(id)
      await docRef.update({ smsStatus: "uncertain_after_dispatch", smsSent: false, updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true, booking_id: id, payment_link: url, sms_sent: smsSentResult, agent_say: smsSentResult ? "Perfect. Your reservation is confirmed, and I just texted the confirmation link to your phone." : "Perfect. Your reservation is confirmed and your confirmation link is ready." })
}
