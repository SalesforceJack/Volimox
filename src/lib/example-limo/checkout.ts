import crypto from "node:crypto"
import { createSideEffectStore, deriveSideEffectId, executeSideEffect, ProviderRejectedError, SideEffectPreflightError } from "@/lib/side-effect-machine"
import { demoDb, getSideEffectsCollection } from "@/lib/firebase-admin"
import { getExampleLimoProviderMode, getExampleLimoStripeSecretKey, getExampleLimoTenantId, getExampleLimoTwilioAccountSid, getExampleLimoTwilioAuthToken, getExampleLimoTwilioMessagingServiceSid, getExampleLimoTwilioPhoneNumber, isExampleLimoLiveConfigured } from "./config"
import { buildExampleLimoQuote, verifyQuoteFingerprint } from "./engine"
import { recordCheckoutReservation, validateCheckoutApproval } from "./integrity-state"
import { readExampleLimoQuote, readExampleLimoReservation, saveExampleLimoInteraction, saveExampleLimoReservation, saveExampleLimoReviewNotification } from "./store"
import type { ExampleLimoCheckoutRequest, ExampleLimoQuoteResponse, ExampleLimoReservationRecord, ExampleLimoVehicleName } from "./types"
import { ExampleLimoValidationError, normalizePhone, normalizeVehicle, parseTripType, text, validateServiceType } from "./validation"

export class ExampleLimoCheckoutError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400, public readonly data?: Record<string, unknown>) {
    super(message)
    this.name = "ExampleLimoCheckoutError"
  }
}

function transcriptOrFallback(value: unknown) {
  const transcript = text(value, 20_000)
  return transcript || "Customer: Voice transcript was not available.\nDiane: The customer approved the selected vehicle quote."
}

function localCheckoutUrl(requestUrl: string, reservationId: string) {
  return new URL(`/example-limo/checkout/${encodeURIComponent(reservationId)}`, requestUrl).toString()
}

async function ensureReviewNotification(reservation: ExampleLimoReservationRecord) {
  const id = `eln_${crypto.createHash("sha256").update(`${reservation.tenantId}:${reservation.id}:${reservation.quoteFingerprint}`).digest("hex").slice(0, 24)}`
  await saveExampleLimoReviewNotification({
    id,
    tenantId: reservation.tenantId,
    reservationId: reservation.id,
    quoteFingerprint: reservation.quoteFingerprint,
    vehicleName: reservation.vehicleName,
    quotedTotalUsd: reservation.quotedTotalUsd,
    departureTimeIso: reservation.departureTimeIso,
    phoneLastFour: reservation.phone.slice(-4),
    reason: "review_window",
    status: "open",
    createdAt: reservation.createdAt,
  })
  return id
}

async function createStripeCheckout(args: { reservation: ExampleLimoReservationRecord; requestUrl: string }) {
  const secret = getExampleLimoStripeSecretKey()
  if (!secret) throw new SideEffectPreflightError("stripe_not_configured")
  const baseUrl = new URL(args.requestUrl).origin
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(args.reservation.quotedTotalUsd * 100)),
    "line_items[0][price_data][product_data][name]": `Example Limo - ${args.reservation.vehicleName}`,
    success_url: `${baseUrl}/example-limo/checkout/${encodeURIComponent(args.reservation.id)}?status=success`,
    cancel_url: `${baseUrl}/example-limo/checkout/${encodeURIComponent(args.reservation.id)}?status=canceled`,
    "metadata[reservationId]": args.reservation.id,
    "metadata[tenantId]": args.reservation.tenantId,
    "metadata[quoteFingerprint]": args.reservation.quoteFingerprint,
    "metadata[vehicleName]": args.reservation.vehicleName,
  })
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `example-limo-${args.reservation.id}` },
    body: form.toString(),
  })
  const payload = await response.json().catch(() => null) as { id?: string; url?: string; error?: { message?: string } } | null
  if (!response.ok || !payload?.id || !payload.url) throw new ProviderRejectedError(payload?.error?.message || "stripe_checkout_failed")
  return { sessionId: payload.id, url: payload.url }
}

async function sendLiveSms(phone: string, url: string) {
  const accountSid = getExampleLimoTwilioAccountSid()
  const authToken = getExampleLimoTwilioAuthToken()
  const messagingServiceSid = getExampleLimoTwilioMessagingServiceSid()
  const from = getExampleLimoTwilioPhoneNumber()
  if (!accountSid || !authToken || (!messagingServiceSid && !from)) throw new SideEffectPreflightError("twilio_not_configured")
  const body = new URLSearchParams({ To: phone, Body: `Example Limo secure checkout: ${url}`, ...(messagingServiceSid ? { MessagingServiceSid: messagingServiceSid } : { From: from! }) })
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const payload = await response.json().catch(() => null) as { sid?: string; message?: string } | null
  if (!response.ok || !payload?.sid) throw new ProviderRejectedError(payload?.message || "twilio_sms_failed")
  return { messageSid: payload.sid }
}

function ensureQuoteInputs(body: ExampleLimoCheckoutRequest) {
  const vehicleName = normalizeVehicle(body.vehicle_name)
  if (!vehicleName) throw new ExampleLimoCheckoutError("Choose Luxury Sedan or Large SUV before checkout.", "vehicle_required")
  if (body.approval !== "yes") throw new ExampleLimoCheckoutError("The customer must explicitly approve the selected vehicle price before checkout.", "approval_required")
  const phone = normalizePhone(body.phone)
  if (!/^\+1\d{10}$/.test(phone)) throw new ExampleLimoCheckoutError("A valid US phone number is required for checkout.", "phone_required")
  const quotedTotalUsd = Number(body.quoted_total_usd)
  if (!Number.isFinite(quotedTotalUsd) || quotedTotalUsd <= 0) throw new ExampleLimoCheckoutError("The selected quote amount is invalid.", "amount_invalid")
  if (!text(body.quote_fingerprint, 200)) throw new ExampleLimoCheckoutError("The selected quote fingerprint is required.", "fingerprint_missing")
  if (!text(body.quote_id, 120)) throw new ExampleLimoCheckoutError("The active quote id is required for checkout.", "quote_id_missing")
  const issuedAt = Date.parse(text(body.quote_issued_at, 80))
  if (!Number.isFinite(issuedAt) || issuedAt > Date.now() + 5 * 60 * 1000 || Date.now() - issuedAt > 2 * 60 * 60 * 1000) throw new ExampleLimoCheckoutError("The selected quote has expired. Please request a fresh quote and approval.", "quote_expired", 409, { requiresReapproval: true })
  const departure = new Date(text(body.departure_time_iso, 80))
  if (Number.isNaN(departure.getTime())) throw new ExampleLimoCheckoutError("The pickup date and time is invalid.", "invalid_departure_time")
  const returnDeparture = body.return_departure_time_iso ? new Date(text(body.return_departure_time_iso, 80)) : null
  if (returnDeparture && Number.isNaN(returnDeparture.getTime())) throw new ExampleLimoCheckoutError("The return pickup date and time is invalid.", "invalid_return_time")
  return { vehicleName, phone, quotedTotalUsd, departureTimeIso: departure.toISOString(), returnDepartureTimeIso: returnDeparture?.toISOString() }
}

type CheckoutIntegrityContext = {
  sessionId: string
  tenantId: string
  approvalIntentToken: unknown
  lastCustomerUtterance: unknown
}

type CheckoutWithRouteDetails = ExampleLimoCheckoutRequest & {
  stops?: string[]
  hours_requested?: number | string
  airline?: string
}

function approvalError(code: string) {
  const messages: Record<string, string> = {
    explicit_price_approval_required: "Checkout requires the customer's latest finalized utterance to be an explicit yes to the repeated selected price.",
    approval_intent_invalid_or_expired: "The vehicle selection approval request is missing or expired. Repeat the exact selected price and ask again.",
    approval_intent_tuple_mismatch: "The checkout vehicle or price does not match the approved selection.",
    approval_selection_state_missing: "The selected quote is no longer active for this voice session. Request a fresh quote.",
    approval_selection_state_mismatch: "The selected quote changed before approval. Repeat the current price and ask again.",
  }
  return new ExampleLimoCheckoutError(messages[code] || "Checkout approval could not be verified safely.", code, 409, { requiresReapproval: true })
}

export async function sendExampleLimoCheckoutLink(body: CheckoutWithRouteDetails, requestUrl: string, integrity?: CheckoutIntegrityContext) {
  const { vehicleName, phone, quotedTotalUsd, departureTimeIso, returnDepartureTimeIso } = ensureQuoteInputs(body)
  const tenantId = getExampleLimoTenantId(body.tenant_id)
  let serviceType
  try {
    serviceType = validateServiceType(body.service_type)
  } catch (error) {
    if (error instanceof ExampleLimoValidationError) throw new ExampleLimoCheckoutError(error.message, error.code, 400, { details: error.details })
    throw error
  }
  const tripType = parseTripType(body.trip_type)
  if (!integrity || integrity.tenantId !== tenantId) throw approvalError("approval_intent_invalid_or_expired")
  try {
    await validateCheckoutApproval({
      sessionId: integrity.sessionId,
      tenantId,
      approvalIntentToken: integrity.approvalIntentToken,
      lastCustomerUtterance: integrity.lastCustomerUtterance,
      vehicleName,
      quoteId: body.quote_id,
      quoteFingerprint: body.quote_fingerprint,
      quotedTotalUsd,
      quoteIssuedAt: body.quote_issued_at,
    })
  } catch (error) {
    throw approvalError(error instanceof Error ? error.message : "approval_intent_invalid_or_expired")
  }
  const mode = getExampleLimoProviderMode()
  const storedQuote = await readExampleLimoQuote(body.quote_id!, tenantId)
  let quote: ExampleLimoQuoteResponse | null = storedQuote
  if (!quote) {
    try {
      quote = await buildExampleLimoQuote({
        pickup_address: body.pickup_address,
        destination_address: body.destination_address,
        departure_time_iso: body.departure_time_iso,
        return_departure_time_iso: body.return_departure_time_iso,
        passenger_count: Number(body.passenger_count),
        luggage_count: Number(body.luggage_count),
        phone,
        service_type: serviceType,
        trip_type: tripType,
        stops: body.stops,
        hours_requested: body.hours_requested,
        airline: body.airline,
        vehicle_name: vehicleName,
        tenant_id: tenantId,
      })
    } catch (error) {
      if (error instanceof ExampleLimoValidationError) throw new ExampleLimoCheckoutError(error.message, error.code, 400, { details: error.details })
      throw error
    }
  }
  const selected = quote.quotes_by_vehicle[vehicleName]
  if (!selected) throw new ExampleLimoCheckoutError("The selected vehicle is no longer available for this party.", "vehicle_unavailable")
  const authoritativeDepartureTimeIso = selected.routeLegs[0]?.departureTimeIso || departureTimeIso
  const authoritativeReturnTimeIso = quote.returnDepartureTimeIso || returnDepartureTimeIso
  const submittedFingerprintIsAuthentic = verifyQuoteFingerprint(body.quote_fingerprint, {
    tenantId,
    pickupAddress: selected.pickupAddress,
    destinationAddress: selected.destinationAddress,
    departureTimeIso: authoritativeDepartureTimeIso,
    returnDepartureTimeIso: authoritativeReturnTimeIso,
    serviceType,
    tripType,
    vehicleName,
    passengerCount: Number(body.passenger_count),
    luggageCount: Number(body.luggage_count),
    amount: quotedTotalUsd,
    stops: selected.routeLegs[0]?.stops || [],
    hoursRequested: serviceType === "hourly" ? selected.durationMinutes / 60 : undefined,
    ...(storedQuote ? {} : {
      airline: text(body.airline, 120) || undefined,
    }),
  })
  const storedTupleMatches = !storedQuote || (
    body.quote_fingerprint === selected.quoteFingerprint &&
    Math.abs(Date.parse(selected.quoteIssuedAt) - Date.parse(body.quote_issued_at)) <= 1000
  )
  if (!submittedFingerprintIsAuthentic || !storedTupleMatches || Math.abs(selected.quotedTotalUsd - quotedTotalUsd) > 0.03) {
    throw new ExampleLimoCheckoutError("The quote changed before checkout. Please repeat the selected vehicle price and ask for a new yes or no approval.", "quote_changed", 409, { requiresReapproval: true, quote })
  }
  if (mode === "disabled") throw new ExampleLimoCheckoutError("Secure checkout is not enabled for this Example Limo environment yet.", "provider_disabled", 503)
  if (mode === "live" && !isExampleLimoLiveConfigured()) throw new ExampleLimoCheckoutError("Example Limo live Stripe/Twilio credentials are incomplete.", "provider_not_configured", 503)
  const reservationId = `elr_${crypto.createHash("sha256").update(`${tenantId}:${selected.quoteFingerprint}:${vehicleName}`).digest("hex").slice(0, 24)}`
  const existingReservation = await readExampleLimoReservation(reservationId, tenantId)
  if (existingReservation && existingReservation.providerMode === mode && existingReservation.quoteFingerprint === selected.quoteFingerprint) {
    if (existingReservation.status === "pending_review") await ensureReviewNotification(existingReservation)
    if (integrity) await recordCheckoutReservation(tenantId, integrity.sessionId, existingReservation.id)
    return {
      ok: true,
      reservationId: existingReservation.id,
      status: existingReservation.status,
      checkoutUrl: existingReservation.checkoutUrl,
      reviewRequired: existingReservation.status === "pending_review",
      smsSent: existingReservation.providerMode === "live" && Boolean(existingReservation.checkoutUrl),
      message: existingReservation.status === "pending_review" ? "This ride is awaiting human review." : "The secure checkout is already ready.",
    }
  }
  const now = new Date().toISOString()
  const reviewRequired = Boolean(selected.requiresAdminApproval)
  const reservation: ExampleLimoReservationRecord = {
    id: reservationId,
    tenantId,
    quoteId: quote.quoteId,
    status: reviewRequired ? "pending_review" : mode === "simulate" ? "simulation_ready" : "pending_payment",
    providerMode: mode,
    vehicleName: vehicleName as ExampleLimoVehicleName,
    quotedTotalUsd: selected.quotedTotalUsd,
    quoteFingerprint: selected.quoteFingerprint,
    quoteIssuedAt: selected.quoteIssuedAt,
    phone,
    pickupAddress: selected.pickupAddress,
    destinationAddress: selected.destinationAddress,
    departureTimeIso: authoritativeDepartureTimeIso,
    returnDepartureTimeIso: authoritativeReturnTimeIso,
    passengerCount: Number(body.passenger_count),
    luggageCount: Number(body.luggage_count),
    serviceType,
    tripType,
    stops: quote.stops,
    hoursRequested: quote.hoursRequested,
    airline: quote.airline,
    createdAt: now,
    updatedAt: now,
  }
  await saveExampleLimoReservation(reservation)
  const interactionId = `eli_${crypto.createHash("sha256").update(`${reservationId}:${quote.quoteId}`).digest("hex").slice(0, 24)}`
  await saveExampleLimoInteraction({ id: interactionId, tenantId, reservationId, quoteId: quote.quoteId, transcript: transcriptOrFallback(body.conversation_transcript), createdAt: now })
  if (reviewRequired) {
    const reviewNotificationId = await ensureReviewNotification(reservation)
    if (integrity) await recordCheckoutReservation(tenantId, integrity.sessionId, reservationId)
    return { ok: true, reservationId, status: reservation.status, reviewRequired: true, reviewNotificationId, message: "This ride is within the review window. A human must approve it before payment can begin." }
  }

  const checkout = mode === "simulate" ? { url: localCheckoutUrl(requestUrl, reservationId), sessionId: undefined } : null
  if (mode === "live") {
    const db = demoDb()
    const store = createSideEffectStore(db, db ? getSideEffectsCollection(db, tenantId) : null)
    const stripeEffectId = deriveSideEffectId("example-limo", reservationId, selected.quoteFingerprint, vehicleName, "stripe")
    const stripeOutcome = await executeSideEffect(store, stripeEffectId, "example-limo-stripe", () => createStripeCheckout({ reservation, requestUrl }).then((value) => ({ value, providerId: value.sessionId })), { sessionId: reservationId, completedState: "completed", preflight: () => { if (!getExampleLimoStripeSecretKey()) throw new SideEffectPreflightError("stripe_not_configured") } })
    if (stripeOutcome.kind === "executed" || stripeOutcome.kind === "reconciliation_required") {
      const value = stripeOutcome.kind === "executed" ? stripeOutcome.value : stripeOutcome.value
      if (value) {
        reservation.checkoutUrl = value.url
        reservation.stripeSessionId = value.sessionId
      }
    } else if (stripeOutcome.kind === "already_completed") {
      reservation.status = "pending_payment"
      throw new ExampleLimoCheckoutError("Stripe checkout was already created; refresh the reservation to retrieve its secure link.", "checkout_reconciliation_required", 503)
    } else {
      throw new ExampleLimoCheckoutError("Secure checkout could not be created safely.", "stripe_checkout_failed", 503)
    }
    const smsEffectId = deriveSideEffectId("example-limo", reservationId, selected.quoteFingerprint, vehicleName, "twilio")
    const smsOutcome = await executeSideEffect(store, smsEffectId, "example-limo-sms", () => sendLiveSms(phone, reservation.checkoutUrl!).then((value) => ({ value, providerId: value.messageSid })), { sessionId: reservationId, completedState: "sent", preflight: () => { if (!getExampleLimoTwilioAccountSid()) throw new SideEffectPreflightError("twilio_not_configured") } })
    if (smsOutcome.kind === "provider_rejected" || smsOutcome.kind === "uncertain" || smsOutcome.kind === "persistence_unavailable") throw new ExampleLimoCheckoutError("Checkout was created, but SMS delivery needs reconciliation.", "sms_reconciliation_required", 503, { checkoutUrl: reservation.checkoutUrl })
  }
  reservation.updatedAt = new Date().toISOString()
  await saveExampleLimoReservation(reservation)
  if (integrity) await recordCheckoutReservation(tenantId, integrity.sessionId, reservationId)
  return { ok: true, reservationId, status: reservation.status, checkoutUrl: reservation.checkoutUrl || checkout?.url, smsSent: mode === "live", message: mode === "simulate" ? "Simulation checkout is ready." : "Secure checkout is ready and the link was sent by SMS." }
}

export async function markExampleLimoReservationPaid(args: {
  tenantId: string
  reservationId: string
  sessionId: string
  amountTotalCents: number
  currency: string
}) {
  const reservation = await readExampleLimoReservation(args.reservationId, args.tenantId)
  if (!reservation || reservation.tenantId !== args.tenantId) return { reservation: null, processed: false, reason: "reservation_not_found" as const }
  if (reservation.providerMode !== "live") return { reservation: null, processed: false, reason: "provider_mode_mismatch" as const }
  if (args.currency.toLowerCase() !== "usd") return { reservation: null, processed: false, reason: "currency_mismatch" as const }
  if (!Number.isInteger(args.amountTotalCents) || Math.abs(args.amountTotalCents / 100 - reservation.quotedTotalUsd) > 0.005) return { reservation: null, processed: false, reason: "amount_mismatch" as const }
  if (!reservation.stripeSessionId || reservation.stripeSessionId !== args.sessionId) return { reservation: null, processed: false, reason: "session_mismatch" as const }
  if (reservation.status === "paid") return { reservation, processed: false, idempotent: true as const }
  if (reservation.status !== "pending_payment") return { reservation: null, processed: false, reason: "invalid_status" as const }
  const updated = { ...reservation, status: "paid" as const, updatedAt: new Date().toISOString() }
  await saveExampleLimoReservation(updated)
  return { reservation: updated, processed: true }
}
