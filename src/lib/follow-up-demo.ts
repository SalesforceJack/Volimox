import crypto from "node:crypto"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { demoDb, getDemoTenantId, getFollowUpSessionsCollection, isProductionFirebaseRequired } from "@/lib/firebase-admin"
import { normalizeDemoPhone } from "@/lib/volimox-demo"
import type { SideEffectRecord } from "@/lib/side-effect-machine"

export type FollowUpChannel = "system" | "sms" | "email" | "call" | "lead"
export type FollowUpEventStatus = "waiting" | "running" | "completed" | "failed"
export type FollowUpOperationState =
  | "pending"
  | "claiming"
  | "dispatching"
  | "failed_before_dispatch"
  | "failed"
  | "provider_rejected"
  | "uncertain_after_dispatch"
  | "started"
  | "sent"
  | "completed"
  | "uncertain"
export type FollowUpWorkflowStatus =
  | "started"
  | "partially_started"
  | "configuration_error"
  | "temporarily_unavailable"
  | "reconciliation_required"
export type ScheduledMessageStatus = "scheduled" | "scheduling_uncertain" | "cancellation_uncertain" | "canceled"

export type FollowUpDemoEvent = {
  id: string
  type: string
  label: string
  detail: string
  channel: FollowUpChannel
  status: FollowUpEventStatus
  createdAt: string
}

export type FollowUpDemoMessage = {
  id: string
  direction: "inbound" | "outbound"
  body: string
  status: string
  sid?: string
  createdAt: string
}

export type FollowUpDemoSession = {
  id: string
  idempotencyKey?: string
  fullName: string
  email: string
  phone: string
  companyName: string
  businessType: string
  consentSms: boolean
  consentEmail: boolean
  consentCall: boolean
  status: "active" | "engaged" | "completed" | "expired"
  events: FollowUpDemoEvent[]
  messages: FollowUpDemoMessage[]
  initialCallState?: FollowUpOperationState
  initialEmailState?: FollowUpOperationState
  callbackCallState?: FollowUpOperationState
  recoverySmsState?: FollowUpOperationState
  leadNotificationState?: FollowUpOperationState
  initialCallClaimedAt?: number
  initialEmailClaimedAt?: number
  callbackCallClaimedAt?: number
  leadNotificationClaimedAt?: number
  twilioNumber?: string
  twilioCallSid?: string
  callbackCallSid?: string
  scheduledMessageSid?: string
  scheduledMessageStatus?: ScheduledMessageStatus
  requestHash?: string
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export type FollowUpSideEffectOperation = "initial-call" | "initial-email" | "callback-call" | "lead-notification" | "scheduled-follow-up-sms"

type RecoverySideEffectOperation = FollowUpSideEffectOperation | "recovery-sms"

const OPERATION_STATE_RANK: Record<FollowUpOperationState, number> = {
  pending: 0,
  claiming: 1,
  dispatching: 2,
  failed_before_dispatch: 3,
  failed: 3,
  provider_rejected: 4,
  uncertain: 5,
  uncertain_after_dispatch: 5,
  started: 6,
  sent: 6,
  completed: 7,
}

function isAcceptedOperationState(state: FollowUpOperationState) {
  return state === "started" || state === "sent" || state === "completed"
}

function isUncertainOperationState(state: FollowUpOperationState) {
  return state === "uncertain" || state === "uncertain_after_dispatch"
}

/**
 * Merge operation snapshots without allowing stale progress to hide a
 * definitive failure, provider uncertainty, or an accepted provider result.
 * A failed_before_dispatch record remains retryable, so a later dispatching
 * snapshot may legitimately advance it after a new claim.
 */
export function mergeOperationState<T extends FollowUpOperationState | undefined>(existing: T, incoming: T): T {
  if (!existing) return incoming
  if (!incoming) return existing
  if (existing === incoming) return existing
  if (existing === "provider_rejected") return existing
  if (existing === "completed") return existing
  if (incoming === "completed") return incoming
  if (isUncertainOperationState(existing)) return isAcceptedOperationState(incoming) ? incoming : existing
  if (isUncertainOperationState(incoming)) return isAcceptedOperationState(existing) ? existing : incoming
  if (isAcceptedOperationState(existing)) return existing
  if (isAcceptedOperationState(incoming)) return incoming
  if (incoming === "provider_rejected") return incoming
  if (existing === "failed_before_dispatch" && incoming === "dispatching") return incoming
  return OPERATION_STATE_RANK[incoming] >= OPERATION_STATE_RANK[existing] ? incoming : existing
}

export function mergeSessionStatus(existing: FollowUpDemoSession["status"], incoming: FollowUpDemoSession["status"]): FollowUpDemoSession["status"] {
  if (existing === "completed") return existing
  if (existing === "expired") return existing
  if (incoming === "completed") return incoming
  if (incoming === "expired") return incoming
  if (existing === "engaged" && incoming === "active") return existing
  return incoming
}

function mergeScheduledMessageStatus(existing: ScheduledMessageStatus | undefined, incoming: ScheduledMessageStatus | undefined) {
  if (existing === "canceled" || incoming === "canceled") return "canceled" as const
  if (existing === "cancellation_uncertain") return existing
  if (incoming === "cancellation_uncertain") return incoming
  return incoming || existing
}

function mergeEventStatus(existing: FollowUpEventStatus, incoming: FollowUpEventStatus) {
  if (existing === "completed") return existing
  if (incoming === "completed") return incoming
  if (existing === "failed" || incoming === "failed") return "failed" as const
  if (existing === "running" || incoming === "running") return "running" as const
  return "waiting" as const
}

function mergeMessageStatus(existing: string, incoming: string) {
  const terminalStatuses = new Set(["delivered", "failed", "undelivered", "completed"])
  if (terminalStatuses.has(existing)) return existing
  if (terminalStatuses.has(incoming)) return incoming
  const ranks: Record<string, number> = {
    queued: 1,
    accepted: 2,
    sent: 3,
    received: 3,
  }
  return (ranks[incoming] ?? 2) >= (ranks[existing] ?? 2) ? incoming : existing
}

export function upsertEvent(session: FollowUpDemoSession, next: FollowUpDemoEvent) {
  const index = session.events.findIndex((item) => item.id === next.id)
  if (index < 0) {
    session.events.push(next)
    return next
  }
  const merged = {
    ...session.events[index],
    ...next,
    status: mergeEventStatus(session.events[index].status, next.status),
  }
  session.events[index] = merged
  return merged
}

export function upsertMessageBySid(session: FollowUpDemoSession, body: string, status: string, sid: string) {
  const index = session.messages.findIndex((item) => item.sid === sid)
  if (index >= 0) {
    session.messages[index] = {
      ...session.messages[index],
      body: session.messages[index].body || body,
      status: mergeMessageStatus(session.messages[index].status, status),
    }
    return session.messages[index]
  }
  const next = { ...message("outbound", body, status, sid), id: `sms-${sid}` }
  session.messages.push(next)
  return next
}

export function recoverySmsBody(session: Pick<FollowUpDemoSession, "fullName" | "businessType">) {
  const firstName = session.fullName.split(" ")[0]
  return `Hi ${firstName}, this is Example ${session.businessType}. Sorry we missed your call. What can we help you with today? Reply STOP to opt out.`
}

export function scheduledFollowUpSmsBody(session: Pick<FollowUpDemoSession, "businessType">) {
  return `Just checking in from Example ${session.businessType}. Do you still need help? Reply here and we will capture the details for the team.`
}

export function deterministicEvent(id: string, type: string, label: string, detail: string, channel: FollowUpChannel, status: FollowUpEventStatus): FollowUpDemoEvent {
  return { id, type, label, detail, channel, status, createdAt: new Date().toISOString() }
}

export function projectSideEffectRecord(session: FollowUpDemoSession, operation: RecoverySideEffectOperation, record: SideEffectRecord) {
  const state = record.state

  if (operation === "initial-call") {
    if (record.providerId) session.twilioCallSid = record.providerId
    if (record.providerMetadata?.from) session.twilioNumber = record.providerMetadata.from
    if (state === "started" || state === "sent") session.initialCallState = mergeOperationState(session.initialCallState, "started")
    else if (state === "completed") session.initialCallState = mergeOperationState(session.initialCallState, "completed")
    else if (state === "claiming" || state === "dispatching") session.initialCallState = mergeOperationState(session.initialCallState, state)
    else if (state === "uncertain_after_dispatch") session.initialCallState = mergeOperationState(session.initialCallState, "uncertain_after_dispatch")
    else session.initialCallState = mergeOperationState(session.initialCallState, state === "provider_rejected" ? "provider_rejected" : "failed")
    return session
  }

  if (operation === "initial-email") {
    if (state === "sent") session.initialEmailState = mergeOperationState(session.initialEmailState, "sent")
    else if (state === "completed") session.initialEmailState = mergeOperationState(session.initialEmailState, "completed")
    else if (state === "claiming" || state === "dispatching") session.initialEmailState = mergeOperationState(session.initialEmailState, state)
    else if (state === "uncertain_after_dispatch") session.initialEmailState = mergeOperationState(session.initialEmailState, "uncertain_after_dispatch")
    else session.initialEmailState = mergeOperationState(session.initialEmailState, state === "provider_rejected" ? "provider_rejected" : "failed")
    return session
  }

  if (operation === "callback-call") {
    if (record.providerId) session.callbackCallSid = record.providerId
    if (state === "started" || state === "sent") session.callbackCallState = mergeOperationState(session.callbackCallState, "started")
    else if (state === "completed") session.callbackCallState = mergeOperationState(session.callbackCallState, "completed")
    else if (state === "claiming" || state === "dispatching") session.callbackCallState = mergeOperationState(session.callbackCallState, state)
    else if (state === "uncertain_after_dispatch") session.callbackCallState = mergeOperationState(session.callbackCallState, "uncertain_after_dispatch")
    else session.callbackCallState = mergeOperationState(session.callbackCallState, state === "provider_rejected" ? "provider_rejected" : "failed")
    return session
  }

  if (operation === "lead-notification") {
    if (state === "sent" || state === "completed") session.leadNotificationState = mergeOperationState(session.leadNotificationState, "sent")
    else if (state === "claiming" || state === "dispatching") session.leadNotificationState = mergeOperationState(session.leadNotificationState, "dispatching")
    else if (state === "uncertain_after_dispatch") session.leadNotificationState = mergeOperationState(session.leadNotificationState, "uncertain_after_dispatch")
    else session.leadNotificationState = mergeOperationState(session.leadNotificationState, state === "provider_rejected" ? "provider_rejected" : "failed")
    return session
  }

  if (operation === "recovery-sms") {
    if (record.providerMetadata?.from) session.twilioNumber = record.providerMetadata.from
    if (record.providerId) upsertMessageBySid(session, recoverySmsBody(session), record.providerMetadata?.status || "queued", record.providerId)
    if (state === "sent") session.recoverySmsState = mergeOperationState(session.recoverySmsState, "sent")
    else if (state === "completed") session.recoverySmsState = mergeOperationState(session.recoverySmsState, "completed")
    else if (state === "claiming" || state === "dispatching") session.recoverySmsState = mergeOperationState(session.recoverySmsState, state)
    else if (state === "uncertain_after_dispatch") session.recoverySmsState = mergeOperationState(session.recoverySmsState, "uncertain_after_dispatch")
    else session.recoverySmsState = mergeOperationState(session.recoverySmsState, state === "provider_rejected" ? "provider_rejected" : "failed")
    return session
  }

  if (record.providerId && session.scheduledMessageStatus !== "canceled") {
    session.scheduledMessageSid = record.providerId
    session.scheduledMessageStatus = state === "uncertain_after_dispatch" ? "scheduling_uncertain" : "scheduled"
  }
  return session
}

export interface PublicFollowUpDemoSession {
  id: string
  fullName?: string
  phoneMasked?: string
  emailMasked?: string
  companyName?: string
  businessType?: string
  status: string
  events: PublicDemoEvent[]
  messages: PublicDemoMessage[]
  initialCallState?: string
  initialEmailState?: string
  callbackCallState?: string
  recoverySmsState?: string
  leadNotificationState?: string
  workflowStatus: FollowUpWorkflowStatus
  createdAt: string
  expiresAt?: string
}

export interface PublicDemoEvent {
  type: string
  title: string
  detail: string
  channel: string
  state: string
  timestamp: string
}

export interface PublicDemoMessage {
  id: string
  direction: string
  preview: string
  timestamp: string
}

declare global {
  // eslint-disable-next-line no-var
  var __volimoxFollowUpSessions: Map<string, FollowUpDemoSession> | undefined
}

const memorySessions = globalThis.__volimoxFollowUpSessions ?? new Map<string, FollowUpDemoSession>()
globalThis.__volimoxFollowUpSessions = memorySessions

function signingSecret() {
  const value = process.env.VOLIMOX_DEMO_LINK_SECRET?.trim() || process.env.VOICE_DEMO_SESSION_SECRET?.trim()
  if (!value) throw new Error("Demo session signing is not configured.")
  return value
}

export function createSessionToken(session: FollowUpDemoSession) {
  const expires = new Date(session.expiresAt).getTime()
  const payload = `${session.id}.${expires}`
  const signature = crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function readSessionToken(token: unknown) {
  if (typeof token !== "string") return null
  const [id, expiresValue, signature] = token.split(".")
  const expires = Number(expiresValue)
  if (!id || !signature || !Number.isFinite(expires) || expires < Date.now()) return null
  const expected = crypto.createHmac("sha256", signingSecret()).update(`${id}.${expires}`).digest("base64url")
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  return { id, expires }
}

export function cleanDemoText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max) : ""
}

export function deriveSessionId(idempotencyKey?: string): string {
  if (!idempotencyKey) return crypto.randomUUID()
  const cleanKey = idempotencyKey.trim()
  const hash = crypto.createHash("sha256").update(cleanKey).digest("hex").slice(0, 32)
  return `session-${hash}`
}

export function createFollowUpSession(input: {
  fullName: string
  email: string
  phone: string
  companyName: string
  businessType: string
  consentSms: boolean
  consentEmail: boolean
  consentCall: boolean
  idempotencyKey?: string
  sessionId?: string
}) {
  const now = new Date()
  const idempotencyKey = input.idempotencyKey?.trim() || deriveDefaultIdempotencyKey(input)
  const id = input.sessionId || deriveSessionId(idempotencyKey)
  const session: FollowUpDemoSession = {
    id,
    idempotencyKey,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    companyName: input.companyName,
    businessType: input.businessType,
    consentSms: input.consentSms,
    consentEmail: input.consentEmail,
    consentCall: input.consentCall,
    status: "active",
    initialCallState: "pending",
    initialEmailState: "pending",
    callbackCallState: "pending",
    leadNotificationState: "pending",
    events: [event("session.started", "Demo session secured", `${input.businessType} missed-call workflow`, "system", "completed")],
    messages: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
  }
  return session
}

type FollowUpInput = {
  fullName: string
  email: string
  phone: string
  companyName: string
  businessType: string
  consentSms: boolean
  consentEmail: boolean
  consentCall: boolean
}

function canonicalSessionValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
}

export function canonicalizeFollowUpPayload(input: FollowUpInput) {
  return {
    fullName: canonicalSessionValue(input.fullName),
    email: canonicalSessionValue(input.email),
    phone: normalizeDemoPhone(input.phone),
    companyName: canonicalSessionValue(input.companyName),
    businessType: canonicalSessionValue(input.businessType),
    consentSms: Boolean(input.consentSms),
    consentEmail: Boolean(input.consentEmail),
    consentCall: Boolean(input.consentCall),
  }
}

export function deriveFollowUpRequestHash(input: FollowUpInput) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalizeFollowUpPayload(input))).digest("hex")
}

export function deriveDefaultIdempotencyKey(input: FollowUpInput) {
  return `key-${deriveFollowUpRequestHash(input)}`
}

export async function getOrCreateFollowUpSession(input: {
  fullName: string
  email: string
  phone: string
  companyName: string
  businessType: string
  consentSms: boolean
  consentEmail: boolean
  consentCall: boolean
  idempotencyKey?: string
}): Promise<{ session: FollowUpDemoSession; isNew: boolean }> {
  const idempotencyKey = input.idempotencyKey?.trim() || deriveDefaultIdempotencyKey(input)
  const sessionId = deriveSessionId(idempotencyKey)
  const requestHash = deriveFollowUpRequestHash(input)

  const db = demoDb()
  if (!db) {
    let cached = memorySessions.get(sessionId)
    if (!cached) {
      cached = createFollowUpSession({ ...input, idempotencyKey, sessionId })
      cached.requestHash = requestHash
      memorySessions.set(sessionId, cached)
      return { session: structuredClone(cached), isNew: true }
    }
    const cachedRequestHash = cached.requestHash || deriveFollowUpRequestHash(cached)
    if (cachedRequestHash !== requestHash) {
      throw new Error("idempotency_key_payload_mismatch")
    }
    if (new Date(cached.expiresAt).getTime() < Date.now()) {
      throw new Error("idempotency_key_expired")
    }
    return { session: structuredClone(cached), isNew: false }
  }

  const tenantId = getDemoTenantId()
  const docRef = getFollowUpSessionsCollection(db, tenantId).doc(sessionId)

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef)
    if (snap.exists) {
      const existing = snap.data() as FollowUpDemoSession & { requestHash?: string }
      const existingRequestHash = existing.requestHash || deriveFollowUpRequestHash(existing)
      if (existingRequestHash !== requestHash) {
        throw new Error("idempotency_key_payload_mismatch")
      }
      if (new Date(existing.expiresAt).getTime() < Date.now()) {
        throw new Error("idempotency_key_expired")
      }
      memorySessions.set(sessionId, existing)
      return { session: existing, isNew: false }
    }

    const newSession = createFollowUpSession({ ...input, idempotencyKey, sessionId })
    newSession.requestHash = requestHash
    const firestoreSession = JSON.parse(JSON.stringify(newSession)) as FollowUpDemoSession
    transaction.set(docRef, {
      ...firestoreSession,
      tenantId,
      source: "volimox_followup_demo",
      status: newSession.status,
      schemaVersion: 1,
      requestHash,
      expiresAtServer: Timestamp.fromDate(new Date(newSession.expiresAt)),
      updatedAtServer: FieldValue.serverTimestamp(),
    })
    memorySessions.set(sessionId, newSession)
    return { session: newSession, isNew: true }
  })
}

export function event(type: string, label: string, detail: string, channel: FollowUpChannel, status: FollowUpEventStatus): FollowUpDemoEvent {
  return { id: crypto.randomUUID(), type, label, detail, channel, status, createdAt: new Date().toISOString() }
}

export function message(direction: FollowUpDemoMessage["direction"], body: string, status: string, sid?: string): FollowUpDemoMessage {
  return { id: crypto.randomUUID(), direction, body, status, sid, createdAt: new Date().toISOString() }
}

export function mergeFollowUpSession(existing: FollowUpDemoSession, incoming: FollowUpDemoSession): FollowUpDemoSession {
  const merged = structuredClone(incoming)
  merged.createdAt = existing.createdAt || incoming.createdAt
  merged.status = mergeSessionStatus(existing.status, incoming.status)
  merged.initialCallState = mergeOperationState(existing.initialCallState, incoming.initialCallState)
  merged.initialEmailState = mergeOperationState(existing.initialEmailState, incoming.initialEmailState)
  merged.callbackCallState = mergeOperationState(existing.callbackCallState, incoming.callbackCallState)
  merged.recoverySmsState = mergeOperationState(existing.recoverySmsState, incoming.recoverySmsState)
  merged.leadNotificationState = mergeOperationState(existing.leadNotificationState, incoming.leadNotificationState)

  merged.twilioCallSid = existing.twilioCallSid || incoming.twilioCallSid
  merged.callbackCallSid = existing.callbackCallSid || incoming.callbackCallSid
  merged.twilioNumber = existing.twilioNumber || incoming.twilioNumber
  merged.requestHash = existing.requestHash || incoming.requestHash

  if (existing.scheduledMessageStatus === "canceled" || incoming.scheduledMessageStatus === "canceled") {
    merged.scheduledMessageStatus = "canceled"
    delete merged.scheduledMessageSid
  } else {
    merged.scheduledMessageSid = incoming.scheduledMessageSid || existing.scheduledMessageSid
    merged.scheduledMessageStatus = mergeScheduledMessageStatus(existing.scheduledMessageStatus, incoming.scheduledMessageStatus)
    if (merged.scheduledMessageSid && !merged.scheduledMessageStatus) merged.scheduledMessageStatus = "scheduled"
  }

  const eventMap = new Map<string, FollowUpDemoEvent>()
  for (const item of existing.events || []) eventMap.set(item.id, item)
  for (const item of incoming.events || []) {
    const previous = eventMap.get(item.id)
    eventMap.set(item.id, previous ? {
      ...previous,
      ...item,
      status: mergeEventStatus(previous.status, item.status),
    } : item)
  }
  merged.events = Array.from(eventMap.values())
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-50)

  const messageMap = new Map<string, FollowUpDemoMessage>()
  for (const item of existing.messages || []) messageMap.set(item.sid ? `sid:${item.sid}` : `id:${item.id}`, item)
  for (const item of incoming.messages || []) {
    const key = item.sid ? `sid:${item.sid}` : `id:${item.id}`
    const previous = messageMap.get(key)
    messageMap.set(key, previous ? {
      ...previous,
      ...item,
      body: previous.body || item.body,
      status: mergeMessageStatus(previous.status, item.status),
      createdAt: previous.createdAt < item.createdAt ? previous.createdAt : item.createdAt,
    } : item)
  }
  merged.messages = Array.from(messageMap.values())
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-50)
  return merged
}

export async function saveFollowUpSession(session: FollowUpDemoSession) {
  session.updatedAt = new Date().toISOString()
  if (session.events.length > 50) session.events = session.events.slice(-50)
  if (session.messages.length > 50) session.messages = session.messages.slice(-50)

  const db = demoDb()
  if (!db) {
    if (isProductionFirebaseRequired()) {
      throw new Error("Persistence required in production but Firestore is unavailable.")
    }
    memorySessions.set(session.id, structuredClone(session))
    return session
  }

  const tenantId = getDemoTenantId()
  const docRef = getFollowUpSessionsCollection(db, tenantId).doc(session.id)
  let savedSession = structuredClone(session)

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef)
    savedSession = snap.exists
      ? mergeFollowUpSession(snap.data() as FollowUpDemoSession, session)
      : structuredClone(session)

    const firestoreSession = JSON.parse(JSON.stringify(savedSession)) as Record<string, unknown>
    if (savedSession.scheduledMessageStatus === "canceled") firestoreSession.scheduledMessageSid = FieldValue.delete()
    transaction.set(docRef, {
      ...firestoreSession,
      tenantId,
      source: "volimox_followup_demo",
      status: savedSession.status,
      schemaVersion: 1,
      expiresAtServer: Timestamp.fromDate(new Date(savedSession.expiresAt)),
      updatedAtServer: FieldValue.serverTimestamp(),
    }, { merge: true })
  })

  Object.assign(session, savedSession)
  memorySessions.set(session.id, structuredClone(savedSession))
  return session
}

export async function getFollowUpSession(id: string) {
  const db = demoDb()
  if (!db) {
    const cached = memorySessions.get(id)
    if (cached) return structuredClone(cached)
    if (isProductionFirebaseRequired()) {
      throw new Error("Persistence required in production but Firestore is unavailable.")
    }
    return null
  }
  const snapshot = await getFollowUpSessionsCollection(db, getDemoTenantId()).doc(id).get()
  if (!snapshot.exists) return null
  const session = snapshot.data() as FollowUpDemoSession
  memorySessions.set(id, session)
  return structuredClone(session)
}

export async function findSessionByIdempotencyKey(key: string) {
  if (!key) return null
  const sessionId = deriveSessionId(key)
  const db = demoDb()
  if (!db) {
    const cached = memorySessions.get(sessionId) || [...memorySessions.values()].find((s) => s.idempotencyKey === key && new Date(s.expiresAt).getTime() > Date.now())
    if (cached) return structuredClone(cached)
    if (isProductionFirebaseRequired()) {
      throw new Error("Persistence required in production but Firestore is unavailable.")
    }
    return null
  }
  const snapshot = await getFollowUpSessionsCollection(db).where("idempotencyKey", "==", key).limit(1).get()
  if (snapshot.empty) return null
  const session = snapshot.docs[0].data() as FollowUpDemoSession
  memorySessions.set(session.id, session)
  return structuredClone(session)
}

export async function findLatestSessionByPhone(value: unknown, twilioNumber?: unknown) {
  const phone = normalizeDemoPhone(value)
  if (!phone) return null
  const normalizedTwilioNumber = twilioNumber ? normalizeDemoPhone(twilioNumber) : ""
  const db = demoDb()
  if (!db) {
    const cached = [...memorySessions.values()]
      .filter((session) => session.phone === phone && (!normalizedTwilioNumber || session.twilioNumber === normalizedTwilioNumber) && new Date(session.expiresAt).getTime() > Date.now())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (cached) return structuredClone(cached)
    if (isProductionFirebaseRequired()) {
      throw new Error("Persistence required in production but Firestore is unavailable.")
    }
    return null
  }
  const snapshot = await getFollowUpSessionsCollection(db).where("phone", "==", phone).limit(10).get()
  const sessions = snapshot.docs.map((document) => document.data() as FollowUpDemoSession)
    .filter((session) => (!normalizedTwilioNumber || session.twilioNumber === normalizedTwilioNumber) && new Date(session.expiresAt).getTime() > Date.now())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return sessions[0] || null
}



function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return "***"
  return `(***) ***-${digits.slice(-4)}`
}

function maskEmail(email?: string): string | undefined {
  if (!email) return undefined
  const parts = email.split("@")
  if (parts.length !== 2) return "***@***"
  return `***@${parts[1]}`
}

function sanitizeEventDetail(detail: string): string {
  if (!detail) return ""
  if (/error:|exception|twilio_|smtp|nodemailer|firebase|firestore|failed/i.test(detail) || detail.includes("Error:") || detail.includes("Exception")) {
    return "Service temporarily unavailable."
  }
  return detail
}

function isFailedOperationState(state?: FollowUpOperationState) {
  return state === "failed" || state === "failed_before_dispatch" || state === "provider_rejected"
}

function hasUncertainState(session: FollowUpDemoSession) {
  return [session.initialCallState, session.initialEmailState, session.callbackCallState, session.recoverySmsState, session.leadNotificationState]
    .some((state) => state === "uncertain" || state === "uncertain_after_dispatch")
}

export function getWorkflowStatus(session: FollowUpDemoSession): FollowUpWorkflowStatus {
  if (hasUncertainState(session) || session.scheduledMessageStatus === "cancellation_uncertain" || session.scheduledMessageStatus === "scheduling_uncertain") return "reconciliation_required"
  const states = [session.initialCallState, session.initialEmailState, session.leadNotificationState]
  const failed = states.filter((state) => isFailedOperationState(state)).length
  const accepted = states.filter((state) => state === "started" || state === "sent" || state === "completed").length
  if (failed === states.length) return "configuration_error"
  if (failed > 0 && accepted > 0) return "partially_started"
  if (failed > 0) return "temporarily_unavailable"
  return accepted > 0 || session.status !== "active" ? "started" : "temporarily_unavailable"
}

export function publicSession(session: FollowUpDemoSession): PublicFollowUpDemoSession {
  return {
    id: session.id,
    fullName: session.fullName,
    phoneMasked: maskPhone(session.phone),
    emailMasked: maskEmail(session.email),
    companyName: session.companyName,
    businessType: session.businessType,
    status: session.status,
    events: (session.events || []).map(e => ({
      type: e.type,
      title: e.label,
      detail: sanitizeEventDetail(e.detail),
      channel: e.channel,
      state: e.status,
      timestamp: e.createdAt,
    })),
    messages: (session.messages || []).map(m => ({
      id: m.id,
      direction: m.direction,
      preview: m.body.slice(0, 120),
      timestamp: m.createdAt,
    })),
    initialCallState: session.initialCallState,
    initialEmailState: session.initialEmailState,
    callbackCallState: session.callbackCallState,
    recoverySmsState: session.recoverySmsState,
    leadNotificationState: session.leadNotificationState,
    workflowStatus: getWorkflowStatus(session),
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  }
}

export function publicBaseUrl(request: Request) {
  const configured = process.env.VOLIMOX_DEMO_PUBLIC_URL?.trim() || process.env.SITE_URL?.trim() || process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return (configured || new URL(request.url).origin).replace(/\/$/, "")
}

export function validateNewSession(body: Record<string, unknown>) {
  const fullName = cleanDemoText(body.fullName, 120)
  const email = cleanDemoText(body.email, 254).toLowerCase()
  const phone = normalizeDemoPhone(body.phone)
  const companyName = cleanDemoText(body.companyName, 160) || "Independent operator"
  const businessType = cleanDemoText(body.businessType, 60) || "Home services"
  const consentSms = body.consentSms === true
  const consentEmail = body.consentEmail === true
  const consentCall = body.consentCall === true
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || !phone || !consentSms || !consentEmail || !consentCall) return null
  return { fullName, email, phone, companyName, businessType, consentSms, consentEmail, consentCall }
}
