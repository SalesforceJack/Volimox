import { NextResponse } from "next/server"
import { sendLeadNotification, validateSmtpConfig } from "@/lib/mail"
import type { LeadFormData } from "@/lib/mail"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { createSideEffectStore, executeSideEffect, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { demoDb, getSideEffectsCollection } from "@/lib/firebase-admin"
import { deriveContactLeadEffectId } from "@/lib/contact-idempotency"
import { persistContactLead, updateContactLeadNotification, type ContactLeadNotificationStatus } from "@/lib/contact-lead"
import type { SideEffectOutcome } from "@/lib/side-effect-machine"

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const allowed = await checkDurableRateLimit(`contact:${ip}`, 3, 60 * 60 * 1000, { failClosed: true })
  if (!allowed) {
    return NextResponse.json({ success: false, error: "Too many requests. Please try again later." }, { status: 429 })
  }

  try {
    const contentType = request.headers.get("content-type") ?? ""
    let body: Record<string, unknown>

    if (contentType.includes("application/json")) {
      body = (await request.json()) as Record<string, unknown>
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    }

    const fullName = cleanLine(String(body.fullName ?? ""))
    const email = cleanLine(String(body.email ?? "")).toLowerCase()
    const companyName = cleanLine(String(body.companyName ?? ""))
    const industry = cleanLine(String(body.industry ?? ""))
    const projectScope = String(body.projectScope ?? "").trim()
    const estimatedVolume = cleanLine(String(body.estimatedVolume ?? ""))
    const businessPhone = cleanLine(String(body.businessPhone ?? ""))
    const currentPhoneProvider = cleanLine(String(body.currentPhoneProvider ?? ""))
    const bookingSystem = cleanLine(String(body.bookingSystem ?? ""))
    const afterHours = cleanLine(String(body.afterHours ?? ""))

    const missing: string[] = []
    if (!fullName) missing.push("fullName")
    if (!email) missing.push("email")
    if (!companyName) missing.push("companyName")
    if (!industry) missing.push("industry")
    if (!projectScope) missing.push("projectScope")
    if (!estimatedVolume) missing.push("estimatedVolume")

    if (missing.length > 0) {
      return NextResponse.json({ success: false, error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 })
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Please provide a valid work email." }, { status: 400 })
    }

    const oversized =
      fullName.length > 120 ||
      email.length > 254 ||
      companyName.length > 160 ||
      industry.length > 120 ||
      projectScope.length > 4000 ||
      estimatedVolume.length > 12 ||
      businessPhone.length > 40 ||
      currentPhoneProvider.length > 120 ||
      bookingSystem.length > 120 ||
      afterHours.length > 120

    if (oversized) {
      return NextResponse.json({ success: false, error: "One or more fields exceed the allowed length." }, { status: 400 })
    }

    if (!/^\d{1,9}$/.test(estimatedVolume) || Number(estimatedVolume) < 1) {
      return NextResponse.json({ success: false, error: "Please provide a valid monthly request volume." }, { status: 400 })
    }

    if (businessPhone && !/^[+()\d .-]{7,40}$/.test(businessPhone)) {
      return NextResponse.json({ success: false, error: "Please provide a valid business phone number." }, { status: 400 })
    }

    const lead: LeadFormData = {
      fullName,
      email,
      companyName,
      industry,
      projectScope,
      estimatedVolume,
      businessPhone,
      currentPhoneProvider,
      bookingSystem,
      afterHours,
    }

    const effectId = deriveContactLeadEffectId(lead)
    const db = demoDb()
    if (!db) {
      return NextResponse.json({ success: false, error: "Your brief could not be stored safely. Please try again later." }, { status: 503 })
    }

    try {
      await persistContactLead(db, lead)
    } catch (error) {
      console.error("[api/contact] Lead persistence failed", error instanceof Error ? error.message : "unknown")
      return NextResponse.json({ success: false, error: "Your brief could not be stored safely. Please try again later." }, { status: 503 })
    }

    const collection = getSideEffectsCollection(db)
    let emailOutcome: SideEffectOutcome<Awaited<ReturnType<typeof sendLeadNotification>>> | null = null
    try {
      const store = createSideEffectStore(db, collection)
      emailOutcome = await executeSideEffect(
        store,
        effectId,
        "contact-lead-email",
        async () => {
          const res = await sendLeadNotification(lead)
          if (res.sent === false) throw new ProviderRejectedError(res.reasonCode)
          return { value: res, providerId: res.providerId }
        },
        {
          ttlHours: 90 * 24,
          preflight: () => {
            if (!validateSmtpConfig().configured) throw new SideEffectPreflightError("not_configured")
          },
        },
      )
    } catch (error) {
      console.error("[api/contact] Notification side effect unavailable", error instanceof Error ? error.message : "unknown")
    }

    let notificationStatus: ContactLeadNotificationStatus = "failed"
    let responseMessage = "Your operation brief was captured. Notification delivery is temporarily unavailable, but the team can still follow up."
    let responseStatus = 202

    if (emailOutcome?.kind === "executed" || emailOutcome?.kind === "already_completed") {
      notificationStatus = "sent"
      responseMessage = "Your operation brief was captured and the team was notified. We will follow up with a practical next step."
      responseStatus = 200
    } else if (emailOutcome?.kind === "already_dispatching") {
      notificationStatus = "pending"
      responseMessage = "Your operation brief was captured. Notification delivery is still being verified."
    } else if (emailOutcome?.kind === "uncertain") {
      notificationStatus = "uncertain_after_dispatch"
      responseMessage = "Your operation brief was captured. Notification delivery is being verified."
    } else if (emailOutcome?.kind === "reconciliation_required") {
      notificationStatus = "reconciliation_required"
      responseMessage = "Your operation brief was captured. Notification delivery needs verification."
    }

    try {
      const providerId = emailOutcome?.kind === "executed"
        ? emailOutcome.providerId
        : emailOutcome?.kind === "already_completed"
          ? emailOutcome.record.providerId
          : undefined
      await updateContactLeadNotification(db, effectId, notificationStatus, providerId)
    } catch (error) {
      console.error("[api/contact] Notification status persistence failed", error instanceof Error ? error.message : "unknown")
      notificationStatus = "reconciliation_required"
      responseMessage = "Your operation brief was captured. Notification delivery status is being verified."
      responseStatus = 202
    }

    const acceptHeader = request.headers.get("accept") ?? ""
    if (!acceptHeader.includes("application/json")) {
      const origin = new URL(request.url).origin
      return NextResponse.redirect(new URL("/thank-you", origin), 303)
    }

    return NextResponse.json({ success: true, message: responseMessage, notificationStatus }, { status: responseStatus })
  } catch (err) {
    console.error("[api/contact] Error processing lead:", err instanceof Error ? err.message : "unknown")
    return NextResponse.json({ success: false, error: "Internal server error. Please try again later." }, { status: 500 })
  }
}

function cleanLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
}
