import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { getLocalDemoRequestGuard } from "@/lib/local-demo"
import { buildExampleLimoQuote, getSelectedQuote } from "@/lib/example-limo/engine"
import { createVehicleSelectionIntent, getOrCreateActiveQuote } from "@/lib/example-limo/integrity-state"
import { ExampleLimoCheckoutError, sendExampleLimoCheckoutLink } from "@/lib/example-limo/checkout"
import { completeExampleLimoSimulation } from "@/lib/example-limo/simulation"
import { readExampleLimoQuote, readExampleLimoReservation } from "@/lib/example-limo/store"
import { createExampleLimoVoiceSessionToken, verifyExampleLimoVoiceSessionToken } from "@/lib/example-limo/voice-session"
import { ExampleLimoValidationError } from "@/lib/example-limo/validation"
import type { ExampleLimoQuoteRequest, ExampleLimoReservationRecord } from "@/lib/example-limo/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TENANT_ID = "volimox-local-demo"
const MAX_SESSIONS = 100
const MAX_QUOTES_PER_SESSION = 12
type LocalSession = { token: string; quoteId?: string; reservationId?: string; quoteCount: number }
const sessions = new Map<string, LocalSession>()
const checkoutOwners = new Map<string, string>()
// All steps share one route bundle and one queue, including duplicate checkout checks.
let mutationQueue: Promise<unknown> = Promise.resolve()

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function fail(code: string, error: string, status = 409) {
  return json({ ok: false, code, error }, status)
}

function gate(request: Request) {
  const result = getLocalDemoRequestGuard(request)
  return result.ok === false ? fail(result.code, result.error, result.status) : null
}

function reservationSummary(reservation: ExampleLimoReservationRecord) {
  return {
    id: reservation.id,
    status: reservation.status,
    providerMode: reservation.providerMode,
    vehicleName: reservation.vehicleName,
    quotedTotalUsd: reservation.quotedTotalUsd,
  }
}

const denyNetwork: typeof fetch = async () => { throw new Error("Network access is unavailable in local simulation.") }

export async function GET(request: Request) {
  return gate(request) || json({ ok: true, enabled: true, mode: "local-simulation" })
}

async function perform(request: Request, body: Record<string, unknown>) {
  // Recheck after waiting for another mutation; do not capture an earlier mode.
  const blocked = gate(request)
  if (blocked) return blocked
  if (body.action === "start") {
    if (sessions.size >= MAX_SESSIONS) return fail("local_demo_session_limit", "Restart the local demo to begin more walkthroughs.", 429)
    const id = crypto.randomUUID()
    const sessionToken = createExampleLimoVoiceSessionToken("limo", TENANT_ID, 30 * 60, { sessionId: id, runId: `elv_${crypto.randomBytes(12).toString("hex")}` })
    sessions.set(id, { token: sessionToken, quoteCount: 0 })
    return json({ ok: true, sessionToken })
  }
  const session = verifyExampleLimoVoiceSessionToken(body.sessionToken, "limo")
  const state = session && sessions.get(session.id)
  if (!session || session.tenantId !== TENANT_ID || !state || state.token !== body.sessionToken) {
    return fail("local_demo_session_required", "Start a new local walkthrough to continue.", 401)
  }
  if (body.action === "quote") {
    if (state.reservationId) return fail("local_demo_checkout_exists", "Start a new walkthrough for another ride.")
    // A rejected replacement request must not leave an older checkout available.
    state.quoteId = undefined
    if (!body.trip || typeof body.trip !== "object" || Array.isArray(body.trip)) return fail("invalid_trip", "Provide the trip details.", 400)
    if (state.quoteCount >= MAX_QUOTES_PER_SESSION) return fail("local_demo_quote_limit", "Start a new walkthrough to request more quotes.", 429)
    const trip = { ...body.trip, tenant_id: TENANT_ID } as ExampleLimoQuoteRequest
    const { quote, reused } = await getOrCreateActiveQuote({
      sessionId: session.id,
      tenantId: TENANT_ID,
      input: trip,
      build: () => buildExampleLimoQuote(trip, { allowSimulation: true, fetcher: denyNetwork }),
    })
    state.quoteId = quote.quoteId
    if (!reused) state.quoteCount += 1
    return json({ ok: true, quote, activeQuoteReused: reused })
  }
  if (body.action === "select_vehicle" || body.action === "create_checkout") {
    if (typeof body.quoteId !== "string" || body.quoteId !== state.quoteId) return fail("quote_not_active_for_session", "Request a quote in this walkthrough before choosing a vehicle.")
    const quote = await readExampleLimoQuote(body.quoteId, TENANT_ID)
    if (!quote || Date.parse(quote.expiresAt) <= Date.now()) return fail("quote_expired", "Request a fresh quote before continuing.")
    const selected = getSelectedQuote(quote, body.vehicleName)
    if (body.action === "select_vehicle") {
      if (state.reservationId) return fail("local_demo_checkout_exists", "This walkthrough already has a checkout.")
      const { intent, token } = await createVehicleSelectionIntent({
        sessionId: session.id, tenantId: TENANT_ID, quoteId: quote.quoteId,
        vehicleName: selected.vehicleName, quoteFingerprint: selected.quoteFingerprint,
        quotedTotalUsd: selected.quotedTotalUsd, quoteIssuedAt: selected.quoteIssuedAt,
        selectionUtterance: `I choose the ${selected.vehicleName}.`,
      })
      return json({ ok: true, approvalIntentToken: token, selectedVehicle: intent.vehicleName, quotedTotalUsd: intent.quotedTotalUsd })
    }
    if (body.approved !== true) return fail("explicit_price_approval_required", "Approve the displayed vehicle and exact total before creating a simulated checkout.")
    const owner = checkoutOwners.get(selected.quoteFingerprint)
    if (owner && owner !== session.id) return fail("local_demo_checkout_owned", "This exact ride already belongs to another local walkthrough. Choose another pickup time.")
    // The UI sends an explicit approval action. Pricing and booking fields always
    // come from the stored quote; client-supplied totals or routes are ignored.
    const approval = `I approve the displayed price of $${selected.quotedTotalUsd.toFixed(2)}.`
    const result = await sendExampleLimoCheckoutLink({
      tenant_id: TENANT_ID, quote_id: quote.quoteId, vehicle_name: selected.vehicleName,
      quote_fingerprint: selected.quoteFingerprint, quoted_total_usd: selected.quotedTotalUsd,
      quote_issued_at: selected.quoteIssuedAt, phone: quote.phone,
      pickup_address: quote.pickupAddress, destination_address: quote.destinationAddress,
      departure_time_iso: quote.departureTimeIso, return_departure_time_iso: quote.returnDepartureTimeIso,
      passenger_count: quote.passengerCount, luggage_count: quote.luggageCount,
      service_type: quote.serviceType, trip_type: quote.tripType, stops: quote.stops,
      hours_requested: quote.hoursRequested, airline: quote.airline, approval: "yes",
      conversation_transcript: `Local browser simulation.\nCustomer selected ${selected.vehicleName}.\nDisplayed total: $${selected.quotedTotalUsd.toFixed(2)}.\nCustomer clicked the explicit price approval control.`,
    }, request.url, { sessionId: session.id, tenantId: TENANT_ID, approvalIntentToken: body.approvalIntentToken, lastCustomerUtterance: approval })
    const reservation = await readExampleLimoReservation(result.reservationId, TENANT_ID)
    if (!reservation || reservation.tenantId !== TENANT_ID || reservation.quoteId !== quote.quoteId || reservation.providerMode !== "simulate") return fail("local_demo_reservation_unavailable", "The simulated checkout could not be read safely.")
    state.reservationId = reservation.id
    checkoutOwners.set(selected.quoteFingerprint, session.id)
    return json({ ok: true, reservation: reservationSummary(reservation), reviewRequired: reservation.status === "pending_review" })
  }
  if (body.action === "complete") {
    if (typeof body.reservationId !== "string" || body.reservationId !== state.reservationId) return fail("local_demo_reservation_not_owned", "This checkout does not belong to this walkthrough.", 403)
    const reservation = await readExampleLimoReservation(body.reservationId, TENANT_ID)
    if (!reservation || reservation.tenantId !== TENANT_ID || reservation.quoteId !== state.quoteId || checkoutOwners.get(reservation.quoteFingerprint) !== session.id || reservation.providerMode !== "simulate") {
      return fail("local_demo_reservation_not_owned", "This checkout does not belong to this walkthrough.", 403)
    }
    if (reservation.status === "pending_review") return fail("human_review_required", "This short-notice ride needs human approval. Simulation cannot complete it.")
    if (reservation.status !== "simulation_ready" && reservation.status !== "paid") return fail("simulation_not_ready", "This simulation is not ready to complete.")
    const result = await completeExampleLimoSimulation(reservation.id)
    return json({ ok: true, reservation: reservationSummary(result.reservation), idempotent: result.idempotent })
  }
  return fail("unknown_action", "Choose a supported local walkthrough action.", 400)
}

export async function POST(request: Request) {
  const blocked = gate(request)
  if (blocked) return blocked
  try {
    const raw = await request.text()
    if (raw.length > 20_000) return fail("request_too_large", "The simulation request is too large.", 413)
    let body: unknown
    try { body = JSON.parse(raw) } catch { return fail("invalid_json", "Provide a valid simulation request.", 400) }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("invalid_request", "Provide a valid simulation request.", 400)
    const task = mutationQueue.then(() => perform(request, body as Record<string, unknown>))
    mutationQueue = task.catch(() => undefined)
    return await task
  } catch (error) {
    if (error instanceof ExampleLimoValidationError) return fail(error.code, error.message, 400)
    if (error instanceof ExampleLimoCheckoutError) return fail(error.code, error.message, error.status)
    return fail("local_demo_action_failed", "The local walkthrough could not finish this step. Request a fresh quote.", 409)
  }
}
