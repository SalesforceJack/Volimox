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
 * Body fields: fullName, companyName, industry, projectScope, estimatedVolume
 */

import { NextResponse } from "next/server"
import { sendLeadNotification } from "@/lib/mail"
import type { LeadFormData } from "@/lib/mail"

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
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
    const fullName = String(body.fullName ?? "").trim()
    const companyName = String(body.companyName ?? "").trim()
    const industry = String(body.industry ?? "").trim()
    const projectScope = String(body.projectScope ?? "").trim()
    const estimatedVolume = String(body.estimatedVolume ?? "").trim()

    const missing: string[] = []
    if (!fullName) missing.push("fullName")
    if (!companyName) missing.push("companyName")
    if (!industry) missing.push("industry")
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

    // --- Send notification ---
    const lead: LeadFormData = {
      fullName,
      companyName,
      industry,
      projectScope,
      estimatedVolume,
    }

    await sendLeadNotification(lead)

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
        "Thank you. Our engineering team will review your request and provide a customized deployment projection.",
    })
  } catch (err) {
    console.error("[api/contact] Error processing lead:", err)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error. Please try again later.",
      },
      { status: 500 },
    )
  }
}
