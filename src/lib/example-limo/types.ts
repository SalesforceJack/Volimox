export type ExampleLimoServiceType =
  | "point_to_point"
  | "airport_arrival"
  | "airport_departure"
  | "special_event"
  | "hourly"

export type ExampleLimoTripType = "one_way" | "round_trip"
export type ExampleLimoVehicleName = "Luxury Sedan" | "Large SUV"

export type ExampleLimoProviderMode = "simulate" | "live" | "disabled"

export type ExampleLimoQuoteRequest = {
  pickup_address: string
  destination_address: string
  departure_time_iso: string
  return_departure_time_iso?: string
  passenger_count: number
  luggage_count: number
  phone: string
  service_type: ExampleLimoServiceType
  trip_type?: ExampleLimoTripType
  stops?: string[]
  hours_requested?: number | string
  airline?: string
  vehicle_name?: string
  tenant_id?: string
}

export type ExampleLimoRouteMetrics = {
  distanceMiles: number
  durationMinutes: number
  staticDurationMinutes: number
  trafficRatio: number
  tollAmount: number
}

export type ExampleLimoRouteLeg = ExampleLimoRouteMetrics & {
  pickupAddress: string
  destinationAddress: string
  departureTimeIso?: string
  stops: string[]
}

export type ExampleLimoVehicleQuote = {
  vehicleName: ExampleLimoVehicleName
  serviceType: ExampleLimoServiceType
  pickupAddress: string
  destinationAddress: string
  miles: number
  durationMinutes: number
  trafficMultiplier: number
  tollAmount: number
  baseRoutePrice: number
  vehicleRoutePrice: number
  subtotal: number
  gratuityAmount: number
  taxAmount: number
  totalPrice: number
  quotedTotalUsd: number
  quoteFingerprint: string
  quoteIssuedAt: string
  currency: "USD"
  routeLegs: ExampleLimoRouteLeg[]
  pricingVersion: string
  requiresAdminApproval: boolean
}

export type ExampleLimoQuoteResponse = {
  ok: true
  quoteId: string
  dual_quote: boolean
  quote: ExampleLimoVehicleQuote | null
  quotes_by_vehicle: Partial<Record<ExampleLimoVehicleName, ExampleLimoVehicleQuote>>
  quoteFingerprint: string
  quoteIssuedAt: string
  quotedTotalUsd: number | null
  agent_say_price: string
  requiresAdminApproval: boolean
  pickupAddress: string
  destinationAddress: string
  departureTimeIso: string
  serviceType: ExampleLimoServiceType
  tripType?: ExampleLimoTripType
  passengerCount: number
  luggageCount: number
  phone: string
  stops: string[]
  hoursRequested?: number
  airline?: string
  returnDepartureTimeIso?: string
  pricingVersion: string
  routeLegs: ExampleLimoRouteLeg[]
}

export type ExampleLimoQuoteRecord = ExampleLimoQuoteResponse & {
  id: string
  tenantId: string
  createdAt: string
  expiresAt: string
}

export type ExampleLimoCheckoutRequest = {
  phone: string
  pickup_address: string
  destination_address: string
  departure_time_iso: string
  return_departure_time_iso?: string
  passenger_count: number
  luggage_count: number
  service_type: ExampleLimoServiceType
  trip_type?: ExampleLimoTripType
  vehicle_name: string
  quote_fingerprint: string
  quote_id?: string
  quoted_total_usd: number
  quote_issued_at: string
  conversation_transcript: string
  approval: "yes" | "no"
  tenant_id?: string
}

export type ExampleLimoReservationStatus =
  | "pending_review"
  | "pending_payment"
  | "paid"
  | "simulation_ready"
  | "canceled"

export type ExampleLimoReservationRecord = {
  id: string
  tenantId: string
  quoteId: string
  status: ExampleLimoReservationStatus
  providerMode: ExampleLimoProviderMode
  vehicleName: ExampleLimoVehicleName
  quotedTotalUsd: number
  quoteFingerprint: string
  quoteIssuedAt: string
  phone: string
  pickupAddress: string
  destinationAddress: string
  departureTimeIso: string
  returnDepartureTimeIso?: string
  passengerCount: number
  luggageCount: number
  serviceType: ExampleLimoServiceType
  tripType?: ExampleLimoTripType
  stops?: string[]
  hoursRequested?: number
  airline?: string
  checkoutUrl?: string
  stripeSessionId?: string
  simulationCompletedAt?: string
  createdAt: string
  updatedAt: string
}

export type ExampleLimoDispatchRequestRecord = {
  id: string
  tenantId: string
  runId: string
  voiceSessionId: string
  kind: "dispatch_callback_request"
  fullName?: string
  phoneLastFour: string
  serviceSummary: string
  providerMode: ExampleLimoProviderMode
  createdAt: string
}

export type ExampleLimoReviewNotificationRecord = {
  id: string
  tenantId: string
  reservationId: string
  quoteFingerprint: string
  vehicleName: ExampleLimoVehicleName
  quotedTotalUsd: number
  departureTimeIso: string
  phoneLastFour: string
  reason: "review_window"
  status: "open"
  createdAt: string
}

export type ExampleLimoInteractionRecord = {
  id: string
  tenantId: string
  /** Legacy checkout interactions retain a transcript on the parent document. Voice runs use the events subcollection instead. */
  kind?: "voice_run" | "checkout_interaction"
  status?: "active" | "closed" | "failed"
  reservationId?: string
  quoteId?: string
  transcript?: string
  metadata?: ExampleLimoVoiceRunMetadata
  lastEventSequence?: number
  eventCount?: number
  createdAt: string
  updatedAt?: string
}

export type ExampleLimoVoiceRunMetadata = {
  agentId: string
  model: string
  provider: "gemini_live" | "xai_grok_live"
  providerMode: ExampleLimoProviderMode
  pricingVersion: string
  sessionExpiresAt: string
}

export type ExampleLimoInteractionEventType =
  | "transcript_draft"
  | "transcript_final"
  | "lifecycle_connected"
  | "lifecycle_goaway"
  | "lifecycle_resume_started"
  | "lifecycle_resume_succeeded"
  | "lifecycle_resume_failed"
  | "lifecycle_closed"
  | "tool_requested"
  | "tool_completed"
  | "tool_failed"
  | "error"

export type ExampleLimoInteractionEvent = {
  id: string
  runId: string
  tenantId: string
  sequence: number
  type: ExampleLimoInteractionEventType
  /** Client events are audit evidence only; server events are emitted by trusted backend code. */
  source: "client_observed" | "server"
  occurredAt: string
  receivedAt: string
  payload?: Record<string, unknown>
}
