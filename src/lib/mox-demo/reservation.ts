import crypto from "node:crypto"
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { demoDb, getDemoTenantId, getTenantDocRef } from "@/lib/firebase-admin"
import { normalizeDemoPhone } from "@/lib/volimox-demo"

export const NON_LIMO_AGENT_IDS = ["dental", "law", "orthodontics", "auto-repair", "med-spa", "massage"] as const
export type NonLimoMoxAgentId = typeof NON_LIMO_AGENT_IDS[number]

export type DemoDeliveryStatus = "pending" | "sent" | "not_sent" | "uncertain" | "already_sent"

export type VerticalDemoReservationRecord = {
  id: string
  kind: "vertical_demo_reservation"
  tenantId: string
  sessionId: string
  agentId: NonLimoMoxAgentId
  customer: {
    fullName: string
    email: string
    phone: string
  }
  requestedStartIso: string
  timeZone: string
  serviceSummary: string
  details: string
  consent: {
    sms: true
    email: true
    customerUtterance: string
    agentQuestion: string
  }
  simulation: true
  status: "demo_confirmed" | "demo_confirmed_partial"
  sms: { status: DemoDeliveryStatus }
  email: { status: DemoDeliveryStatus }
  createdAt: string
  updatedAt: string
  expiresAtServer?: FirebaseFirestore.Timestamp | number
  updatedAtServer?: FirebaseFirestore.FieldValue
}

export type VerticalDemoReservationInput = {
  agentId: unknown
  sessionId: string
  tenantId: string
  full_name: unknown
  email: unknown
  phone: unknown
  requested_start_iso: unknown
  time_zone?: unknown
  service_summary: unknown
  details: unknown
  consent_sms: unknown
  consent_email: unknown
  last_customer_utterance: unknown
  last_agent_utterance: unknown
}

export type VerticalDemoReservationValidation =
  | { ok: true; record: VerticalDemoReservationRecord }
  | { ok: false; error: string }

const MAX_RESERVATION_DAYS_AHEAD = 366
const MAX_MEMORY_ENTRIES = 500
const reservationMemory = new Map<string, VerticalDemoReservationRecord>()

function boundedText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength) : ""
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function setBounded(key: string, value: VerticalDemoReservationRecord) {
  reservationMemory.delete(key)
  reservationMemory.set(key, value)
  while (reservationMemory.size > MAX_MEMORY_ENTRIES) reservationMemory.delete(reservationMemory.keys().next().value as string)
}

export function isNonLimoMoxAgentId(value: unknown): value is NonLimoMoxAgentId {
  return typeof value === "string" && (NON_LIMO_AGENT_IDS as readonly string[]).includes(value)
}

export function hasExplicitReservationConsent(customerUtterance: string) {
  const value = customerUtterance.trim().toLocaleLowerCase()
  if (!value) return false
  if (/\b(no|not|don't|do not|never|not now|no quiero|no gracias)\b/i.test(value)) return false
  return /^(yes|yes please|sure|sure thing|absolutely|i agree|i consent|go ahead|please do|okay|ok|that'?s fine|that is fine|si|sí|sí por favor|si por favor|de acuerdo|adelante|claro)(?:[\s,.!?]|$)/i.test(value)
    || /\b(yes|sure|go ahead|please send|i agree|i consent|sí|si|de acuerdo|adelante)\b[\s,]*(please )?(send|enviar|hazlo|do it)?/i.test(value)
}

export function askedForReservationConfirmation(agentQuestion: string) {
  const value = agentQuestion.trim().toLocaleLowerCase()
  if (!value) return false
  const asksToSend = /\b(may|can|could|would you like|permission|consent|send|text|enviar|puedo|puede|permite|autoriz)/i.test(value)
  const mentionsEmail = /\b(email|e-mail|correo)\b/i.test(value)
  const mentionsText = /\b(text|sms|message|mensaje|texto)\b/i.test(value)
  const mentionsConfirmation = /\b(confirm|confirmation|confirmación|confirmacion|simulat|demo|reservation|reserva)\b/i.test(value)
  return asksToSend && mentionsEmail && mentionsText && mentionsConfirmation
}

function reservationId(input: {
  agentId: NonLimoMoxAgentId
  sessionId: string
  email: string
  phone: string
  requestedStartIso: string
  serviceSummary: string
  details: string
}) {
  const stable = [
    input.agentId,
    input.sessionId,
    input.email,
    input.phone,
    input.requestedStartIso,
    input.serviceSummary,
    input.details,
  ].join("|")
  return `vdr_${crypto.createHash("sha256").update(stable).digest("hex").slice(0, 24)}`
}

export function validateAndBuildVerticalDemoReservation(input: VerticalDemoReservationInput, now = Date.now()): VerticalDemoReservationValidation {
  if (!isNonLimoMoxAgentId(input.agentId)) return { ok: false, error: "This demo reservation flow is available only for non-Limo agents." }

  const sessionId = boundedText(input.sessionId, 120)
  const tenantId = boundedText(input.tenantId, 120) || getDemoTenantId()
  const fullName = boundedText(input.full_name, 120)
  const email = boundedText(input.email, 254).toLocaleLowerCase()
  const phone = normalizeDemoPhone(input.phone)
  const requestedStartIso = boundedText(input.requested_start_iso, 80)
  const timeZone = boundedText(input.time_zone, 80) || "America/New_York"
  const serviceSummary = boundedText(input.service_summary, 240)
  const details = boundedText(input.details, 2000)
  const customerUtterance = boundedText(input.last_customer_utterance, 1000)
  const agentQuestion = boundedText(input.last_agent_utterance, 1000)

  if (!sessionId || !fullName || fullName.length < 2) return { ok: false, error: "A valid customer name is required." }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "A valid customer email is required." }
  if (!/^\+1\d{10}$/.test(phone)) return { ok: false, error: "A valid 10-digit US phone number is required." }
  if (!serviceSummary || !details) return { ok: false, error: "The service and request details are required." }
  if (!isValidTimeZone(timeZone)) return { ok: false, error: "A valid time zone is required." }

  const requestedStartMs = Date.parse(requestedStartIso)
  if (!requestedStartIso || !Number.isFinite(requestedStartMs)) return { ok: false, error: "A specific requested date and time is required." }
  if (requestedStartMs <= now) return { ok: false, error: "The requested demo time must be in the future." }
  if (requestedStartMs > now + MAX_RESERVATION_DAYS_AHEAD * 24 * 60 * 60 * 1000) return { ok: false, error: "The requested demo time is too far in the future." }
  if (input.consent_sms !== true || input.consent_email !== true) return { ok: false, error: "Both SMS and email consent are required before sending a demo confirmation." }
  if (!askedForReservationConfirmation(agentQuestion) || !hasExplicitReservationConsent(customerUtterance)) {
    return { ok: false, error: "The customer must explicitly approve the simulated confirmation by text and email." }
  }

  const timestamp = new Date(now).toISOString()
  const id = reservationId({ agentId: input.agentId, sessionId, email, phone, requestedStartIso: new Date(requestedStartMs).toISOString(), serviceSummary, details })
  return {
    ok: true,
    record: {
      id,
      kind: "vertical_demo_reservation",
      tenantId,
      sessionId,
      agentId: input.agentId,
      customer: { fullName, email, phone },
      requestedStartIso: new Date(requestedStartMs).toISOString(),
      timeZone,
      serviceSummary,
      details,
      consent: { sms: true, email: true, customerUtterance, agentQuestion },
      simulation: true,
      status: "demo_confirmed_partial",
      sms: { status: "pending" },
      email: { status: "pending" },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }
}

export function getVerticalDemoReservationsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("verticalDemoReservations")
}

export function getVerticalDemoSideEffectsCollection(db: Firestore, tenantId?: string) {
  return getTenantDocRef(db, tenantId).collection("verticalDemoSideEffects")
}

export async function saveVerticalDemoReservation(record: VerticalDemoReservationRecord) {
  setBounded(record.id, record)
  const db = demoDb()
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new Error("Volimox Firestore is required in production.")
    return record
  }
  await getVerticalDemoReservationsCollection(db, record.tenantId).doc(record.id).set({
    ...record,
    expiresAtServer: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
    updatedAtServer: FieldValue.serverTimestamp(),
  }, { merge: true })
  return record
}

export async function readVerticalDemoReservation(id: string, tenantId?: string) {
  const memory = reservationMemory.get(id)
  if (memory && (!tenantId || memory.tenantId === (tenantId.trim() || getDemoTenantId()))) return memory
  const db = demoDb()
  if (!db) return null
  const snapshot = await getVerticalDemoReservationsCollection(db, tenantId).doc(id).get()
  return snapshot.exists ? snapshot.data() as VerticalDemoReservationRecord : null
}

export function resetVerticalDemoReservationMemoryForTests() {
  reservationMemory.clear()
}
