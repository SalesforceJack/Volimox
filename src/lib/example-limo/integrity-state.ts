import crypto from "node:crypto"
import { demoDb, getTenantDocRef } from "@/lib/firebase-admin"
import { getExampleLimoHmacSecret } from "./config"
import { readExampleLimoQuote } from "./store"
import type { ExampleLimoQuoteRecord, ExampleLimoQuoteRequest, ExampleLimoQuoteResponse, ExampleLimoVehicleName } from "./types"
import { normalizePhone, normalizeVehicle, text } from "./validation"
import { isClearAffirmative } from "./client-state"

const INTENT_TTL_MS = 10 * 60 * 1000

type SelectedQuoteTuple = {
  quoteId: string
  vehicleName: ExampleLimoVehicleName
  quoteFingerprint: string
  quotedTotalUsd: number
  quoteIssuedAt: string
}

type VoiceIntegrityState = {
  sessionId: string
  tenantId: string
  bookingHash?: string
  activeQuoteId?: string
  selected?: SelectedQuoteTuple & { selectedAt: string; selectionUtteranceHash: string }
  checkoutReservationId?: string
  updatedAt: string
}

export type SelectionIntent = SelectedQuoteTuple & {
  version: 1
  sessionId: string
  tenantId: string
  selectionUtteranceHash: string
  expiresAt: number
}

const stateMemory = new Map<string, VoiceIntegrityState>()
const locks = new Map<string, Promise<void>>()

function stateKey(tenantId: string, sessionId: string) {
  return `${tenantId}:${sessionId}`
}

function stateDocumentId(sessionId: string) {
  return crypto.createHash("sha256").update(sessionId).digest("hex")
}

function stateCollection(tenantId: string) {
  const db = demoDb()
  return db ? getTenantDocRef(db, tenantId).collection("exampleLimoVoiceIntegrity") : null
}

async function readState(tenantId: string, sessionId: string): Promise<VoiceIntegrityState | null> {
  const key = stateKey(tenantId, sessionId)
  const memory = stateMemory.get(key)
  if (memory) return memory
  const collection = stateCollection(tenantId)
  if (!collection) return null
  const snapshot = await collection.doc(stateDocumentId(sessionId)).get()
  if (!snapshot.exists) return null
  const state = snapshot.data() as VoiceIntegrityState
  if (state.sessionId !== sessionId || state.tenantId !== tenantId) return null
  stateMemory.set(key, state)
  return state
}

async function writeState(state: VoiceIntegrityState) {
  const key = stateKey(state.tenantId, state.sessionId)
  stateMemory.set(key, state)
  const collection = stateCollection(state.tenantId)
  if (!collection) {
    if (process.env.NODE_ENV === "production") throw new Error("Volimox Firestore is required for voice integrity state in production.")
    return
  }
  await collection.doc(stateDocumentId(state.sessionId)).set(state)
}

async function withSessionLock<T>(tenantId: string, sessionId: string, task: () => Promise<T>): Promise<T> {
  const key = stateKey(tenantId, sessionId)
  const previous = locks.get(key) || Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.then(() => current)
  locks.set(key, queued)
  await previous
  try {
    return await task()
  } finally {
    release()
    if (locks.get(key) === queued) locks.delete(key)
  }
}

function normalizeTime(value: unknown) {
  const raw = text(value, 80)
  const parsed = new Date(raw)
  return raw && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : raw
}

export function createBookingHash(input: Partial<ExampleLimoQuoteRequest>, tenantId: string) {
  const canonical = {
    tenantId,
    pickupAddress: text(input.pickup_address, 240).toLowerCase().replace(/\s+/g, " "),
    destinationAddress: text(input.destination_address, 240).toLowerCase().replace(/\s+/g, " "),
    departureTimeIso: normalizeTime(input.departure_time_iso),
    returnDepartureTimeIso: normalizeTime(input.return_departure_time_iso) || null,
    passengerCount: Number(input.passenger_count),
    luggageCount: Number(input.luggage_count),
    phone: normalizePhone(input.phone),
    serviceType: text(input.service_type, 40).toLowerCase().replace(/[\s-]+/g, "_"),
    tripType: text(input.trip_type, 40).toLowerCase().replace(/[\s-]+/g, "_") || null,
    stops: Array.isArray(input.stops) ? input.stops.map((stop) => text(stop, 240).toLowerCase().replace(/\s+/g, " ")) : [],
    hoursRequested: Number(input.hours_requested || 0),
    airline: text(input.airline, 120).toLowerCase(),
    vehicleName: normalizeVehicle(input.vehicle_name) || null,
  }
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

function isUnexpiredQuote(quote: ExampleLimoQuoteRecord) {
  return Number.isFinite(Date.parse(quote.expiresAt)) && Date.parse(quote.expiresAt) > Date.now()
}

export async function readReusableActiveQuote(sessionId: string, tenantId: string, input: ExampleLimoQuoteRequest) {
  const bookingHash = createBookingHash(input, tenantId)
  const state = await readState(tenantId, sessionId)
  if (state?.bookingHash !== bookingHash || !state.activeQuoteId) return null
  const quote = await readExampleLimoQuote(state.activeQuoteId, tenantId)
  return quote && isUnexpiredQuote(quote) ? quote : null
}

export async function getOrCreateActiveQuote(args: {
  sessionId: string
  tenantId: string
  input: ExampleLimoQuoteRequest
  build: () => Promise<ExampleLimoQuoteResponse>
}) {
  return withSessionLock(args.tenantId, args.sessionId, async () => {
    const bookingHash = createBookingHash(args.input, args.tenantId)
    const existing = await readReusableActiveQuote(args.sessionId, args.tenantId, args.input)
    if (existing) return { quote: existing, reused: true }
    const quote = await args.build()
    await writeState({
      sessionId: args.sessionId,
      tenantId: args.tenantId,
      bookingHash,
      activeQuoteId: quote.quoteId,
      selected: undefined,
      checkoutReservationId: undefined,
      updatedAt: new Date().toISOString(),
    })
    return { quote, reused: false }
  })
}

function normalizedVehicleUtterance(value: unknown) {
  const raw = text(value, 240)
  if (!raw) return ""
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function normalizedApprovalUtterance(value: unknown) {
  const raw = text(value, 240)
  if (!raw) return ""
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function explicitVehicleSelection(value: unknown): ExampleLimoVehicleName | null {
  const utterance = normalizedVehicleUtterance(value)
  if (!utterance) return null
  const sedan = /\b(?:luxury )?sedan\b|\b(?:coche|vehiculo) (?:estandar|pequeno)\b|\bopcion mas barata\b/.test(utterance)
  const suv = /\b(?:large |luxury |premium )?suv\b|\b(?:coche|vehiculo) (?:mas )?(?:grande|espacioso)\b|\bopcion mas grande\b|\bmas espacio\b/.test(utterance)
  if (sedan === suv) return null
  return sedan ? "Luxury Sedan" : "Large SUV"
}

export function isExplicitPriceApproval(value: unknown) {
  const raw = text(value, 240)
  const utterance = normalizedApprovalUtterance(value)
  if (!utterance) return false
  if (/[?]/.test(raw)) return false
  if (/\b(?:no|not|but|instead|change|cancel|stop|wait|maybe|later|different|switch|how much|what about|too much|pero|cambiar|cambio|cancelar|espera|tal vez|despues|diferente)\b/.test(utterance)) return false
  if (/\b(?:sedan|suv|coche|vehiculo|carro|automovil)\b/.test(utterance)) return false
  return /^(?:yes|yeah|yep|okay|ok|sure|go ahead|please send|i approve|i confirm|confirmed|that is correct|thats correct|that works|works for me|adelante|de acuerdo|correcto|si|apruebo|confirmo|por favor envia|por favor envie)(?:\b|\s)/.test(utterance)
}

function utteranceHash(value: unknown) {
  return crypto.createHash("sha256").update(normalizedVehicleUtterance(value)).digest("hex")
}

function signIntent(intent: SelectionIntent) {
  const encoded = Buffer.from(JSON.stringify(intent)).toString("base64url")
  const signature = crypto.createHmac("sha256", getExampleLimoHmacSecret()).update(encoded).digest("base64url")
  return `${encoded}.${signature}`
}

export function verifySelectionIntent(value: unknown, expected: { sessionId: string; tenantId: string }) {
  if (typeof value !== "string") return null
  const [encoded, signature] = value.split(".")
  if (!encoded || !signature) return null
  const expectedSignature = crypto.createHmac("sha256", getExampleLimoHmacSecret()).update(encoded).digest("base64url")
  if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null
  try {
    const intent = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SelectionIntent
    if (intent.version !== 1 || intent.sessionId !== expected.sessionId || intent.tenantId !== expected.tenantId || intent.expiresAt <= Date.now()) return null
    if (!normalizeVehicle(intent.vehicleName) || !Number.isFinite(intent.quotedTotalUsd) || intent.quotedTotalUsd <= 0) return null
    return intent
  } catch {
    return null
  }
}

export async function createVehicleSelectionIntent(args: {
  sessionId: string
  tenantId: string
  quoteId: string
  vehicleName: unknown
  quoteFingerprint: unknown
  quotedTotalUsd: unknown
  quoteIssuedAt: unknown
  selectionUtterance: unknown
}) {
  const requestedVehicle = normalizeVehicle(args.vehicleName)
  const quote = await readExampleLimoQuote(text(args.quoteId, 120), args.tenantId)
  const availableVehicles = quote ? (["Luxury Sedan", "Large SUV"] as const).filter((candidate) => Boolean(quote.quotes_by_vehicle[candidate])) : []
  const spokenVehicle = explicitVehicleSelection(args.selectionUtterance)
  const singleAvailableAffirmation = !spokenVehicle && availableVehicles.length === 1 && isClearAffirmative(args.selectionUtterance) && requestedVehicle === availableVehicles[0]
  if ((!spokenVehicle && !singleAvailableAffirmation) || !requestedVehicle || (spokenVehicle && spokenVehicle !== requestedVehicle)) {
    throw new Error("vehicle_selection_not_explicit")
  }
  const selected = quote?.quotes_by_vehicle[requestedVehicle]
  if (!quote || !selected) throw new Error("selected_quote_not_found")
  const state = await readState(args.tenantId, args.sessionId)
  if (!state || state.activeQuoteId !== quote.quoteId) throw new Error("quote_not_active_for_session")
  const amount = Number(args.quotedTotalUsd)
  const fingerprint = text(args.quoteFingerprint, 1000)
  const issuedAt = text(args.quoteIssuedAt, 80)
  if (fingerprint !== selected.quoteFingerprint || Math.abs(amount - selected.quotedTotalUsd) > 0.001 || issuedAt !== selected.quoteIssuedAt) {
    throw new Error("selected_quote_tuple_mismatch")
  }
  const selectionUtteranceHash = utteranceHash(args.selectionUtterance)
  const intent: SelectionIntent = {
    version: 1,
    sessionId: args.sessionId,
    tenantId: args.tenantId,
    quoteId: quote.quoteId,
    vehicleName: requestedVehicle,
    quoteFingerprint: selected.quoteFingerprint,
    quotedTotalUsd: selected.quotedTotalUsd,
    quoteIssuedAt: selected.quoteIssuedAt,
    selectionUtteranceHash,
    expiresAt: Date.now() + INTENT_TTL_MS,
  }
  await writeState({
    ...state,
    selected: { ...intent, selectedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  })
  return { intent, token: signIntent(intent) }
}

export async function validateCheckoutApproval(args: {
  sessionId: string
  tenantId: string
  approvalIntentToken: unknown
  lastCustomerUtterance: unknown
  vehicleName: unknown
  quoteId: unknown
  quoteFingerprint: unknown
  quotedTotalUsd: unknown
  quoteIssuedAt: unknown
}) {
  if (!isExplicitPriceApproval(args.lastCustomerUtterance)) throw new Error("explicit_price_approval_required")
  const intent = verifySelectionIntent(args.approvalIntentToken, args)
  if (!intent) throw new Error("approval_intent_invalid_or_expired")
  const vehicleName = normalizeVehicle(args.vehicleName)
  if (
    intent.vehicleName !== vehicleName ||
    intent.quoteId !== text(args.quoteId, 120) ||
    intent.quoteFingerprint !== text(args.quoteFingerprint, 1000) ||
    Math.abs(intent.quotedTotalUsd - Number(args.quotedTotalUsd)) > 0.001 ||
    intent.quoteIssuedAt !== text(args.quoteIssuedAt, 80)
  ) throw new Error("approval_intent_tuple_mismatch")
  const state = await readState(args.tenantId, args.sessionId)
  if (!state?.selected || state.activeQuoteId !== intent.quoteId) throw new Error("approval_selection_state_missing")
  if (
    state.selected.vehicleName !== intent.vehicleName ||
    state.selected.quoteFingerprint !== intent.quoteFingerprint ||
    state.selected.quoteIssuedAt !== intent.quoteIssuedAt ||
    Math.abs(state.selected.quotedTotalUsd - intent.quotedTotalUsd) > 0.001
  ) throw new Error("approval_selection_state_mismatch")
  return intent
}

export async function recordCheckoutReservation(tenantId: string, sessionId: string, reservationId: string) {
  const state = await readState(tenantId, sessionId)
  if (!state) return
  await writeState({ ...state, checkoutReservationId: reservationId, updatedAt: new Date().toISOString() })
}

export function clearExampleLimoIntegrityMemoryForTests() {
  stateMemory.clear()
  locks.clear()
}
