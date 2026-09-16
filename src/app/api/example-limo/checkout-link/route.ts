import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { sendExampleLimoCheckoutLink, ExampleLimoCheckoutError } from "@/lib/example-limo/checkout"
import { createVehicleSelectionIntent } from "@/lib/example-limo/integrity-state"
import { verifyExampleLimoVoiceSessionToken } from "@/lib/example-limo/voice-session"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const ip = getClientIp(request)
  if (!(await checkDurableRateLimit(`example-limo-checkout:${ip}`, 8, 60 * 60 * 1000, { failClosed: true }))) return NextResponse.json({ ok: false, error: "Example Limo checkout limit reached. Please try again later." }, { status: 429 })
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const token = request.headers.get("x-example-limo-voice-session") || (typeof body.voiceSessionToken === "string" ? body.voiceSessionToken : "")
    const session = verifyExampleLimoVoiceSessionToken(token, "limo")
    if (!session) return NextResponse.json({ ok: false, error: "A valid Example Limo voice session is required.", code: "voice_session_required" }, { status: 401 })
    const action = body.action === "select_vehicle" ? "select_vehicle" : "create_checkout"
    const sessionLimit = action === "select_vehicle" ? 8 : 4
    if (!(await checkDurableRateLimit(`example-limo-session-checkout:${session.id}:${action}`, sessionLimit, 60 * 60 * 1000, { failClosed: true }))) return NextResponse.json({ ok: false, error: `This Example Limo voice session has reached its ${action === "select_vehicle" ? "vehicle selection" : "checkout"} limit.` }, { status: 429 })
    if (action === "select_vehicle") {
      try {
        const { intent, token: approvalIntentToken } = await createVehicleSelectionIntent({
          sessionId: session.id,
          tenantId: session.tenantId,
          quoteId: typeof body.quote_id === "string" ? body.quote_id : "",
          vehicleName: body.vehicle_name,
          quoteFingerprint: body.quote_fingerprint,
          quotedTotalUsd: body.quoted_total_usd,
          quoteIssuedAt: body.quote_issued_at,
          selectionUtterance: body.selection_utterance,
        })
        const dollars = intent.quotedTotalUsd.toFixed(2)
        const vehicleLabel = intent.vehicleName === "Luxury Sedan" ? "Sedan" : "SUV"
        return NextResponse.json({
          ok: true,
          action: "vehicle_selected",
          approval_intent_token: approvalIntentToken,
          selectedVehicle: intent.vehicleName,
          quotedTotalUsd: intent.quotedTotalUsd,
          quoteIssuedAt: intent.quoteIssuedAt,
          agent_say_confirmation: `The ${vehicleLabel} total is $${dollars}. Would you like me to send the secure payment link for the ${vehicleLabel} at $${dollars}?`,
          suggested_customer_line: `Yes, please send the secure payment link for the ${vehicleLabel} at $${dollars}.`,
        })
      } catch (error) {
        const code = error instanceof Error ? error.message : "vehicle_selection_failed"
        const messages: Record<string, string> = {
          vehicle_selection_not_explicit: "Please ask the customer to clearly choose Sedan or SUV in English. Vehicle selection is not price approval.",
          selected_quote_not_found: "The selected vehicle quote is unavailable. Request a fresh quote.",
          quote_not_active_for_session: "That quote is not the active quote for this voice session. Request a fresh quote.",
          selected_quote_tuple_mismatch: "The selected vehicle price does not match the active quote. Repeat the current price before asking for approval.",
        }
        return NextResponse.json({ ok: false, error: messages[code] || "The vehicle selection could not be verified safely.", code, requiresReapproval: true }, { status: 409 })
      }
    }
    const result = await sendExampleLimoCheckoutLink({ ...body, tenant_id: session.tenantId } as never, request.url, {
      sessionId: session.id,
      tenantId: session.tenantId,
      approvalIntentToken: body.approval_intent_token,
      lastCustomerUtterance: body.last_customer_utterance,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ExampleLimoCheckoutError) return NextResponse.json({ ok: false, error: error.message, code: error.code, ...error.data }, { status: error.status })
    console.error("[example-limo/checkout-link]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "Example Limo checkout could not be created safely." }, { status: 502 })
  }
}
