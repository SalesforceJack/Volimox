/**
 * Volimox — Contact / Lead Capture API Route
 *
 * Receives form submissions from the Lead Estimator Console,
 * validates required fields, and sends an email notification
 * via Nodemailer (Gmail SMTP).
 *
 * Accepts both:
 *   - POST with Content-Type: application/json
 *   - POST with Content-Type: application/x-www-form-urlencoded (standard HTML forms)
 *
 * Body fields: fullName, email, companyName, industry, projectScope, estimatedVolume
 */

import { NextResponse } from "next/server"
import { sendLeadNotification, validateSmtpConfig } from "@/lib/mail"
import type { LeadFormData } from "@/lib/mail"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { demoDb, getSideEffectsCollection } from "@/lib/firebase-admin"

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

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
      // Parse form-urlencoded (standard HTML form submission)
      const text = await request.text()
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    }

    // --- Field validation ---
    const fullName = cleanLine(String(body.fullName ?? ""))
    const email = cleanLine(String(body.email ?? "")).toLowerCase()
    const companyName = cleanLine(String(body.companyName ?? ""))
    const industry = cleanLine(String(body.industry ?? ""))
    const projectScope = String(body.projectScope ?? "").trim()
    const estimatedVolume = cleanLine(String(body.estimatedVolume ?? ""))

    const missing: string[] = []
    if (!fullName) missing.push("fullName")
    if (!email) missing.push("email")
    if (!companyName) missing.push("companyName")
    if (!industry) missing.push("industry")
    if (!projectScope) missing.push("projectScope")
    if (!estimatedVolume) missing.push("estimatedVolume")

    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missing.join(", ")}`,
        },
        { status: 400 },
      )
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid work email." },
        { status: 400 },
      )
    }

    const oversized =
      fullName.length > 120 ||
      email.length > 254 ||
      companyName.length > 160 ||
      industry.length > 120 ||
      projectScope.length > 4000 ||
      estimatedVolume.length > 12

    if (oversized) {
      return NextResponse.json(
        { success: false, error: "One or more fields exceed the allowed length." },
        { status: 400 },
      )
    }

    if (!/^\d{1,9}$/.test(estimatedVolume) || Number(estimatedVolume) < 1) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid monthly request volume." },
        { status: 400 },
      )
    }

    // --- Send notification ---
    const lead: LeadFormData = {
      fullName,
      email,
      companyName,
      industry,
      projectScope,
      estimatedVolume,
    }

    const effectId = deriveSideEffectId("contact-lead", email, companyName)
    const db = demoDb()
    const collection = db ? getSideEffectsCollection(db) : null

    const store = createSideEffectStore(db, collection)

    const emailOutcome = await executeSideEffect(
      store,
      effectId,
      "contact-lead-email",
      async () => {
        const res = await sendLeadNotification(lead)
        if (res.sent === false) throw new ProviderRejectedError(res.reasonCode)
        return { value: res, providerId: res.providerId }
      },
      {
        preflight: () => {
          if (!validateSmtpConfig().configured) throw new SideEffectPreflightError("not_configured")
        },
      },
    )

    if (emailOutcome.kind === "already_completed" || emailOutcome.kind === "already_dispatching") {
      return NextResponse.json({ success: true, message: "Your operation brief has already been submitted." })
    }

    if (emailOutcome.kind === "persistence_unavailable") {
      console.error("[api/contact] Side-effect persistence unavailable")
      return NextResponse.json({ success: false, error: "Internal server error. Please try again later." }, { status: 500 })
    }

    if (emailOutcome.kind === "provider_rejected") {
      return NextResponse.json({ success: false, error: "Service temporarily unavailable. Please try again later." }, { status: 503 })
    }

    // --- Redirect to thank-you page for HTML form submissions ---
    const acceptHeader = request.headers.get("accept") ?? ""

    if (!acceptHeader.includes("application/json")) {
      // Standard HTML form submission — redirect to thank-you page
      const origin = new URL(request.url).origin
      return NextResponse.redirect(new URL("/thank-you", origin), 303)
    }

    // API call — return JSON
    return NextResponse.json({
      success: true,
      message:
        "Your operation brief is in the queue. We will review the workflow and follow up with a practical next step.",
    })
  } catch (err) {
    console.error("[api/contact] Error processing lead:", err instanceof Error ? err.message : "unknown")
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error. Please try again later.",
      },
      { status: 500 },
    )
  }
}

function cleanLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
}
