import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { sendLeadNotification, validateSmtpConfig } from "@/lib/mail"
import { readDemoToken } from "@/lib/volimox-demo"
import { demoDb, getDemoLeadsCollection, getSideEffectsCollection, getDemoTenantId, isProductionFirebaseRequired } from "@/lib/firebase-admin"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"

export const runtime = "nodejs"

const clean = (value: unknown, length: number) => typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, length) : ""

export async function POST(request: Request) {
  if (!(await checkDurableRateLimit(`demo-lead:${getClientIp(request)}`, 5, 24 * 60 * 60 * 1000, { failClosed: true }))) {
    return NextResponse.json({ success: false, error: "Please try again tomorrow." }, { status: 429 })
  }

  try {
    let body: Record<string, unknown>
    try {
      body = await request.json() as Record<string, unknown>
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload." }, { status: 400 })
    }
    const token = clean(body.token, 5000)
    const continuation = readDemoToken(token)
    const fullName = clean(body.fullName, 120)
    const email = clean(body.email, 254).toLowerCase()
    const companyName = clean(body.companyName, 160)
    const industry = clean(body.industry, 120)
    const challenge = clean(body.challenge, 1400)
    const volume = clean(body.estimatedVolume, 12)

    if (!continuation || !fullName || !companyName || !industry || !challenge || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{1,9}$/.test(volume)) {
      return NextResponse.json({ success: false, error: "Complete the required fields with a valid work email." }, { status: 400 })
    }

    const db = demoDb()
    if (!db && isProductionFirebaseRequired()) {
      return NextResponse.json({ success: false, error: "Persistence system is temporarily unavailable. Please try again." }, { status: 500 })
    }

    const leadDocId = clean(body.idempotencyKey, 128) || continuation.id || continuation.reservationId || `lead-${Date.now()}`

    const tenantId = getDemoTenantId()

    if (db) {
      const docRef = getDemoLeadsCollection(db, tenantId).doc(leadDocId)
      await docRef.set({
        id: leadDocId,
        tenantId,
        fullName,
        email,
        companyName,
        industry,
        challenge,
        estimatedVolume: Number(volume),
        reservationId: continuation.reservationId || null,
        demoSessionId: continuation.id,
        source: "volimox_demo_continuation",
        status: "captured",
        schemaVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAtServer: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
      }, { merge: true })
    }

    const sideEffectsRef = db ? getSideEffectsCollection(db, tenantId) : null

    const store = createSideEffectStore(db, sideEffectsRef)

    const effectId = deriveSideEffectId(leadDocId, 'lead-notification')

    const outcome = await executeSideEffect(
      store,
      effectId,
      'lead-notification',
      async () => {
        const res = await sendLeadNotification({
          fullName,
          email,
          companyName,
          industry,
          estimatedVolume: volume,
          projectScope: `Live demo continuation. ${challenge}\n\nDemo route: ${continuation.distanceMiles.toFixed(1)} mi, ${continuation.durationMinutes} min, illustrative quote $${continuation.estimatedValueUsd.toFixed(2)}.`,
        })
        if (res.sent === false) throw new ProviderRejectedError(res.reasonCode)
        return { value: { sent: true }, providerId: res.providerId }
      },
      {
        preflight: () => {
          if (!validateSmtpConfig().configured) throw new SideEffectPreflightError("not_configured")
        },
      },
    )

    if (db) {
      const docRef = getDemoLeadsCollection(db, tenantId).doc(leadDocId)
      if (outcome.kind === "executed" && outcome.value.sent) {
        await docRef.update({ notificationStatus: "sent", updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
      } else if (outcome.kind === "already_completed" || outcome.kind === "already_dispatching") {
        // Ignored
      } else if (outcome.kind === "persistence_unavailable" || outcome.kind === "preflight_failed" || outcome.kind === "provider_rejected") {
        await docRef.update({ notificationStatus: "failed", updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
      } else {
        await docRef.update({ notificationStatus: "uncertain_after_dispatch", updatedAt: FieldValue.serverTimestamp() }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, message: "Your workflow brief is with Volimox. We will follow up with a practical operating design." })
  } catch (error) {
    console.error("[volimox/demo/lead]", error)
    return NextResponse.json({ success: false, error: "Your brief could not be sent. Please try again." }, { status: 500 })
  }
}
