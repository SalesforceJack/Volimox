import crypto from "node:crypto"
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { demoDb, getDemoTenantId, getTenantDocRef } from "@/lib/firebase-admin"
import { DEFAULT_EXAMPLE_LIMO_SETTINGS, EXAMPLE_LIMO_PRICING_VERSION, getExampleLimoTenantId, normalizeExampleLimoSettings, type ExampleLimoSettings } from "./config"
import type { ExampleLimoDispatchRequestRecord, ExampleLimoInteractionEvent, ExampleLimoInteractionRecord, ExampleLimoQuoteRecord, ExampleLimoReservationRecord, ExampleLimoReviewNotificationRecord, ExampleLimoVoiceRunMetadata } from "./types"

const MAX_MEMORY_ENTRIES = 500
const quoteMemory = new Map<string, ExampleLimoQuoteRecord>()
const reservationMemory = new Map<string, ExampleLimoReservationRecord>()
const interactionMemory = new Map<string, ExampleLimoInteractionRecord>()
const interactionEventMemory = new Map<string, Map<string, ExampleLimoInteractionEvent>>()
const dispatchMemory = new Map<string, ExampleLimoDispatchRequestRecord>()
const reviewNotificationMemory = new Map<string, ExampleLimoReviewNotificationRecord>()

function setBounded<T>(memory: Map<string, T>, key: string, value: T) {
  memory.delete(key)
  memory.set(key, value)
  while (memory.size > MAX_MEMORY_ENTRIES) memory.delete(memory.keys().next().value as string)
}

function pruneExpiredQuotes() {
  const now = Date.now()
  for (const [key, quote] of quoteMemory) if (Date.parse(quote.expiresAt) <= now) quoteMemory.delete(key)
}

export function getExampleLimoCollections(db: Firestore, tenantId?: string) {
  const tenant = getTenantDocRef(db, getExampleLimoTenantId(tenantId))
  return {
    settings: tenant.collection("exampleLimoSettings"),
    quotes: tenant.collection("exampleLimoQuotes"),
    reservations: tenant.collection("exampleLimoReservations"),
    interactions: tenant.collection("exampleLimoInteractions"),
    dispatchRequests: tenant.collection("exampleLimoDispatchRequests"),
    reviewNotifications: tenant.collection("exampleLimoReviewNotifications"),
  }
}

export async function readExampleLimoSettings(tenantId?: string): Promise<ExampleLimoSettings> {
  const db = demoDb()
  if (!db) return normalizeExampleLimoSettings({ pricingVersion: EXAMPLE_LIMO_PRICING_VERSION })
  try {
    const ref = getExampleLimoCollections(db, tenantId).settings.doc(EXAMPLE_LIMO_PRICING_VERSION)
    const doc = await ref.get()
    if (!doc.exists) {
      const defaults = normalizeExampleLimoSettings(DEFAULT_EXAMPLE_LIMO_SETTINGS as unknown as Record<string, unknown>)
      await ref.set({ ...defaults, seededAt: new Date().toISOString(), seedSource: "volimox-code-defaults" }, { merge: true })
      return defaults
    }
    return normalizeExampleLimoSettings(doc.data() as Record<string, unknown>)
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error
    console.warn("[example-limo/settings] Firestore unavailable; using code defaults")
    return normalizeExampleLimoSettings({ pricingVersion: EXAMPLE_LIMO_PRICING_VERSION })
  }
}

export async function saveExampleLimoQuote(record: ExampleLimoQuoteRecord) {
  pruneExpiredQuotes()
  setBounded(quoteMemory, record.id, record)
  const db = demoDb()
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new Error("Volimox Firestore is required in production.")
    return record
  }
  await getExampleLimoCollections(db, record.tenantId).quotes.doc(record.id).set({ ...record, createdAt: record.createdAt, expiresAt: Timestamp.fromDate(new Date(record.expiresAt)), updatedAtServer: FieldValue.serverTimestamp() }, { merge: true })
  return record
}

export async function readExampleLimoQuote(id: string, tenantId?: string) {
  const memory = quoteMemory.get(id)
  if (memory && (!tenantId || memory.tenantId === getExampleLimoTenantId(tenantId))) return memory
  const db = demoDb()
  if (!db) return null
  const snap = await getExampleLimoCollections(db, tenantId).quotes.doc(id).get()
  return snap.exists ? snap.data() as ExampleLimoQuoteRecord : null
}

export async function saveExampleLimoReservation(record: ExampleLimoReservationRecord) {
  setBounded(reservationMemory, record.id, record)
  const db = demoDb()
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new Error("Volimox Firestore is required in production.")
    return record
  }
  await getExampleLimoCollections(db, record.tenantId).reservations.doc(record.id).set({ ...record, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true })
  return record
}

export async function readExampleLimoReservation(id: string, tenantId?: string) {
  const memory = reservationMemory.get(id)
  if (memory && (!tenantId || memory.tenantId === getExampleLimoTenantId(tenantId))) return memory
  const db = demoDb()
  if (!db) return null
  const snap = await getExampleLimoCollections(db, tenantId).reservations.doc(id).get()
  return snap.exists ? snap.data() as ExampleLimoReservationRecord : null
}

export async function saveExampleLimoInteraction(record: ExampleLimoInteractionRecord) {
  setBounded(interactionMemory, record.id, record)
  const db = demoDb()
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new Error("Volimox Firestore is required in production.")
    return record
  }
  await getExampleLimoCollections(db, record.tenantId).interactions.doc(record.id).set({ ...record, createdAt: record.createdAt, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true })
  return record
}

export function createExampleLimoRunId() {
  return `elv_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
}

export async function createExampleLimoVoiceRun(input: {
  id?: string
  tenantId: string
  metadata: ExampleLimoVoiceRunMetadata
  createdAt?: string
}) {
  const createdAt = input.createdAt || new Date().toISOString()
  const record: ExampleLimoInteractionRecord = {
    id: input.id || createExampleLimoRunId(),
    tenantId: input.tenantId,
    kind: "voice_run",
    status: "active",
    metadata: input.metadata,
    lastEventSequence: 0,
    eventCount: 0,
    createdAt,
    updatedAt: createdAt,
  }
  await saveExampleLimoInteraction(record)
  return record
}

export async function readExampleLimoInteraction(id: string, tenantId?: string) {
  const memory = interactionMemory.get(id)
  if (memory && (!tenantId || memory.tenantId === getExampleLimoTenantId(tenantId))) return memory
  const db = demoDb()
  if (!db) return null
  const snap = await getExampleLimoCollections(db, tenantId).interactions.doc(id).get()
  return snap.exists ? snap.data() as ExampleLimoInteractionRecord : null
}

function equivalentReplay(existing: ExampleLimoInteractionEvent, event: ExampleLimoInteractionEvent) {
  return existing.runId === event.runId
    && existing.tenantId === event.tenantId
    && existing.sequence === event.sequence
    && existing.type === event.type
}

function orderedSequence(record: ExampleLimoInteractionRecord, event: ExampleLimoInteractionEvent) {
  const expected = (record.lastEventSequence || 0) + 1
  if (event.sequence !== expected) {
    throw new Error(`Example Limo run event sequence must be ${expected}; received ${event.sequence}.`)
  }
}

/**
 * Persist one bounded audit event. The parent run document only tracks sequence metadata;
 * transcript/tool details stay in its events subcollection to avoid unbounded document growth.
 */
export async function appendExampleLimoInteractionEvent(event: ExampleLimoInteractionEvent) {
  const memoryEvents = interactionEventMemory.get(event.runId) || new Map<string, ExampleLimoInteractionEvent>()
  const replay = memoryEvents.get(event.id)
  if (replay) {
    if (!equivalentReplay(replay, event)) throw new Error("Example Limo run event ID was reused with different metadata.")
    return { event: replay, idempotent: true }
  }
  const memoryRun = interactionMemory.get(event.runId)
  if (memoryRun) {
    if (memoryRun.tenantId !== event.tenantId || memoryRun.kind !== "voice_run") throw new Error("Example Limo voice run was not found for this tenant.")
    orderedSequence(memoryRun, event)
  }

  const db = demoDb()
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new Error("Volimox Firestore is required in production.")
    if (!memoryRun) throw new Error("Example Limo voice run was not found.")
    setBounded(memoryEvents, event.id, event)
    setBounded(interactionEventMemory, event.runId, memoryEvents)
    setBounded(interactionMemory, event.runId, { ...memoryRun, lastEventSequence: event.sequence, eventCount: (memoryRun.eventCount || 0) + 1, updatedAt: event.receivedAt })
    return { event, idempotent: false }
  }

  const collections = getExampleLimoCollections(db, event.tenantId)
  const runRef = collections.interactions.doc(event.runId)
  const eventRef = runRef.collection("events").doc(event.id)
  try {
    const result = await db.runTransaction(async (transaction) => {
      const [runSnapshot, eventSnapshot] = await Promise.all([transaction.get(runRef), transaction.get(eventRef)])
      if (!runSnapshot.exists) throw new Error("Example Limo voice run was not found.")
      const run = runSnapshot.data() as ExampleLimoInteractionRecord
      if (run.tenantId !== event.tenantId || run.kind !== "voice_run") throw new Error("Example Limo voice run was not found for this tenant.")
      if (eventSnapshot.exists) {
        const existing = eventSnapshot.data() as ExampleLimoInteractionEvent
        if (!equivalentReplay(existing, event)) throw new Error("Example Limo run event ID was reused with different metadata.")
        return { event: existing, idempotent: true }
      }
      orderedSequence(run, event)
      transaction.set(eventRef, { ...event, persistedAtServer: FieldValue.serverTimestamp() })
      transaction.update(runRef, {
        lastEventSequence: event.sequence,
        eventCount: FieldValue.increment(1),
        updatedAt: event.receivedAt,
        updatedAtServer: FieldValue.serverTimestamp(),
      })
      return { event, idempotent: false }
    })
    setBounded(memoryEvents, result.event.id, result.event)
    setBounded(interactionEventMemory, event.runId, memoryEvents)
    const current = memoryRun || await readExampleLimoInteraction(event.runId, event.tenantId)
    if (current && !result.idempotent) setBounded(interactionMemory, event.runId, { ...current, lastEventSequence: event.sequence, eventCount: (current.eventCount || 0) + 1, updatedAt: event.receivedAt })
    return result
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error
    if (!memoryRun) throw error
    console.warn("[example-limo/audit] Firestore unavailable; using development memory audit store")
    setBounded(memoryEvents, event.id, event)
    setBounded(interactionEventMemory, event.runId, memoryEvents)
    setBounded(interactionMemory, event.runId, { ...memoryRun, lastEventSequence: event.sequence, eventCount: (memoryRun.eventCount || 0) + 1, updatedAt: event.receivedAt })
    return { event, idempotent: false }
  }
}

export async function readExampleLimoInteractionEvent(runId: string, eventId: string, tenantId?: string) {
  const memory = interactionEventMemory.get(runId)?.get(eventId)
  if (memory && (!tenantId || memory.tenantId === getExampleLimoTenantId(tenantId))) return memory
  const db = demoDb()
  if (!db) return null
  const snap = await getExampleLimoCollections(db, tenantId).interactions.doc(runId).collection("events").doc(eventId).get()
  return snap.exists ? snap.data() as ExampleLimoInteractionEvent : null
}

export function resetExampleLimoAuditMemoryForTests() {
  interactionMemory.clear()
  interactionEventMemory.clear()
}

export async function saveExampleLimoDispatchRequest(record: ExampleLimoDispatchRequestRecord) {
  setBounded(dispatchMemory, record.id, record)
  const db = demoDb()
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new Error("Volimox Firestore is required in production.")
    return record
  }
  await getExampleLimoCollections(db, record.tenantId).dispatchRequests.doc(record.id).set({ ...record, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true })
  return record
}

export async function readExampleLimoDispatchRequest(id: string, tenantId?: string) {
  const memory = dispatchMemory.get(id)
  if (memory && (!tenantId || memory.tenantId === getExampleLimoTenantId(tenantId))) return memory
  const db = demoDb()
  if (!db) return null
  const snap = await getExampleLimoCollections(db, tenantId).dispatchRequests.doc(id).get()
  return snap.exists ? snap.data() as ExampleLimoDispatchRequestRecord : null
}

export async function saveExampleLimoReviewNotification(record: ExampleLimoReviewNotificationRecord) {
  setBounded(reviewNotificationMemory, record.id, record)
  const db = demoDb()
  if (!db) {
    if (process.env.NODE_ENV === "production") throw new Error("Volimox Firestore is required in production.")
    return record
  }
  await getExampleLimoCollections(db, record.tenantId).reviewNotifications.doc(record.id).set({ ...record, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true })
  return record
}

export async function readExampleLimoReviewNotification(id: string, tenantId?: string) {
  const memory = reviewNotificationMemory.get(id)
  if (memory && (!tenantId || memory.tenantId === getExampleLimoTenantId(tenantId))) return memory
  const db = demoDb()
  if (!db) return null
  const snap = await getExampleLimoCollections(db, tenantId).reviewNotifications.doc(id).get()
  return snap.exists ? snap.data() as ExampleLimoReviewNotificationRecord : null
}

export function resetExampleLimoStoreMemoryForTests() {
  quoteMemory.clear()
  reservationMemory.clear()
  interactionMemory.clear()
  interactionEventMemory.clear()
  dispatchMemory.clear()
  reviewNotificationMemory.clear()
}

export function exampleLimoMemoryStatsForTests() {
  return {
    quotes: quoteMemory.size,
    reservations: reservationMemory.size,
    interactions: interactionMemory.size,
    runs: interactionEventMemory.size,
    dispatchRequests: dispatchMemory.size,
    reviewNotifications: reviewNotificationMemory.size,
  }
}

export function createQuoteId() {
  return `elq_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
}

export function createReservationId() {
  return `elr_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
}

export function createInteractionId() {
  return `eli_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`
}
