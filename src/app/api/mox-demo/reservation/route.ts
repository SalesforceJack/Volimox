import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { demoDb } from "@/lib/firebase-admin"
import { sendVerticalDemoReservationEmail, validateSmtpConfig } from "@/lib/mail"
import { getMoxAgent } from "@/lib/mox-agents"
import { verifyMoxDemoVoiceSessionToken } from "@/lib/mox-demo/voice-session"
import {
  getVerticalDemoSideEffectsCollection,
  saveVerticalDemoReservation,
  validateAndBuildVerticalDemoReservation,
  type DemoDeliveryStatus,
  type VerticalDemoReservationInput,
} from "@/lib/mox-demo/reservation"
import { createSideEffectStore, deriveSideEffectId, executeSideEffect, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { sendVerticalDemoReservationSms, validateDemoSmsConfig } from "@/lib/volimox-demo"

export const runtime = "nodejs"

function deliveryStatus(outcome: { kind: string; value?: { sent?: boolean } }): DemoDeliveryStatus {
  if (outcome.kind === "executed") return outcome.value?.sent === true ? "sent" : "not_sent"
  if (outcome.kind === "already_completed") return "already_sent"
  if (outcome.kind === "preflight_failed" || outcome.kind === "provider_rejected") return "not_sent"
  return "uncertain"
}

function publicMessage(sms: DemoDeliveryStatus, email: DemoDeliveryStatus) {
  const channel = (label: string, status: DemoDeliveryStatus) => `${label} ${status.replace(/_/g, " ")}`
  return `Simulated reservation created. ${channel("SMS:", sms)}; ${channel("email:", email)}. No real appointment was booked.`
}

export async function POST(request: Request) {
  const allowed = await checkDurableRateLimit(`mox-reservation:${getClientIp(request)}`, 12, 60 * 60 * 1000, { failClosed: true })
  if (!allowed) return NextResponse.json({ ok: false, error: "Demo reservation limit reached. Please try again later." }, { status: 429 })

  try {
    const body = await request.json().catch(() => ({})) as { agentId?: string; args?: Record<string, unknown> }
    const agent = getMoxAgent(body.agentId)
    if (agent.id === "limo") return NextResponse.json({ ok: false, error: "Example Limo uses its existing quote and checkout flow." }, { status: 400 })

    const session = verifyMoxDemoVoiceSessionToken(request.headers.get("x-volimox-demo-voice-session"), agent.id)
    if (!session) return NextResponse.json({ ok: false, error: "A valid current demo voice session is required." }, { status: 401 })

    const rawArgs = body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {}
    const validated = validateAndBuildVerticalDemoReservation({
      ...rawArgs,
      agentId: agent.id,
      sessionId: session.id,
      tenantId: session.tenantId,
      last_customer_utterance: rawArgs.last_customer_utterance,
      last_agent_utterance: rawArgs.last_agent_utterance,
    } as VerticalDemoReservationInput)
    if (validated.ok === false) return NextResponse.json({ ok: false, error: validated.error }, { status: 400 })

    const reservation = validated.record
    const db = demoDb()
    const store = createSideEffectStore(db, db ? getVerticalDemoSideEffectsCollection(db, reservation.tenantId) : null)
    await saveVerticalDemoReservation(reservation)

    const smsOutcome = await executeSideEffect(
      store,
      deriveSideEffectId(reservation.tenantId, reservation.id, "sms"),
      "vertical-demo-reservation-sms",
      async () => {
        const result = await sendVerticalDemoReservationSms({
          phone: reservation.customer.phone,
          agentName: agent.name,
          reservationId: reservation.id,
          requestedStartIso: reservation.requestedStartIso,
          serviceSummary: reservation.serviceSummary,
        })
        if (result.sent === false) throw new ProviderRejectedError(result.reasonCode)
        return { value: result, providerId: result.messageSid }
      },
      {
        sessionId: reservation.sessionId,
        preflight: () => {
          const config = validateDemoSmsConfig()
          if (!config.configured) throw new SideEffectPreflightError(config.reasonCode || "not_configured")
        },
      },
    )

    const emailOutcome = await executeSideEffect(
      store,
      deriveSideEffectId(reservation.tenantId, reservation.id, "email"),
      "vertical-demo-reservation-email",
      async () => {
        const result = await sendVerticalDemoReservationEmail({
          fullName: reservation.customer.fullName,
          email: reservation.customer.email,
          agentName: agent.name,
          reservationId: reservation.id,
          requestedStartIso: reservation.requestedStartIso,
          timeZone: reservation.timeZone,
          serviceSummary: reservation.serviceSummary,
          details: reservation.details,
        })
        if (result.sent === false) throw new ProviderRejectedError(result.reasonCode)
        return { value: result, providerId: result.providerId }
      },
      {
        sessionId: reservation.sessionId,
        preflight: () => {
          if (!validateSmtpConfig().configured) throw new SideEffectPreflightError("not_configured")
        },
      },
    )

    const smsStatus = deliveryStatus(smsOutcome)
    const emailStatus = deliveryStatus(emailOutcome)
    reservation.sms = { status: smsStatus }
    reservation.email = { status: emailStatus }
    reservation.status = [smsStatus, emailStatus].every((status) => status === "sent" || status === "already_sent")
      ? "demo_confirmed"
      : "demo_confirmed_partial"
    reservation.updatedAt = new Date().toISOString()
    await saveVerticalDemoReservation(reservation)

    return NextResponse.json({
      ok: true,
      tool: "create_demo_reservation",
      result: {
        reservationId: reservation.id,
        simulation: true,
        status: reservation.status,
        sms: reservation.sms,
        email: reservation.email,
        message: publicMessage(smsStatus, emailStatus),
      },
    })
  } catch (error) {
    console.error("[volimox/mox-demo/reservation]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "The simulated reservation could not be completed safely." }, { status: 502 })
  }
}
