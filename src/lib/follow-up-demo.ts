import crypto from "node:crypto"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { demoDb, getDemoTenantId, getFollowUpSessionsCollection, isProductionFirebaseRequired } from "@/lib/firebase-admin"
import { normalizeDemoPhone } from "@/lib/volimox-demo"
import type { SideEffectRecord } from "@/lib/side-effect-machine"

export type FollowUpChannel = "system" | "sms" | "email" | "call" | "lead"
export type FollowUpEventStatus = "waiting" | "running" | "completed" | "failed"

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
  initialCallState?: "pending" | "claiming" | "dispatching" | "started" | "failed" | "completed" | "uncertain_after_dispatch"
  initialEmailState?: "pending" | "claiming" | "dispatching" | "sent" | "failed" | "completed" | "uncertain_after_dispatch"
  callbackCallState?: "pending" | "claiming" | "dispatching" | "started" | "failed" | "completed" | "uncertain_after_dispatch"
  leadNotificationState?: "pending" | "claiming" | "dispatching" | "sent" | "failed" | "uncertain"
  initialCallClaimedAt?: number
  initialEmailClaimedAt?: number
  callbackCallClaimedAt?: number
  leadNotificationClaimedAt?: number
  twilioNumber?: string
  twilioCallSid?: string
  scheduledMessageSid?: string
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export type FollowUpSideEffectOperation = "initial-call" | "initial-email" | "callback-call" | "lead-notification" | "scheduled-follow-up-sms"

export function projectSideEffectRecord(session: FollowUpDemoSession, operation: FollowUpSideEffectOperation, record: SideEffectRecord) {
  const state = record.state

  if (operation === "initial-call") {
    if (record.providerId) session.twilioCallSid = record.providerId
    if (state === "started" || state === "sent") session.initialCallState = "started"
    else if (state === "completed") session.initialCallState = "completed"
    else if (state === "claiming" || state === "dispatching") session.initialCallState = state
    else if (state === "uncertain_after_dispatch") session.initialCallState = "uncertain_after_dispatch"
    else session.initialCallState = "failed"
    return session
  }

  if (operation === "initial-email") {
    if (state === "sent") session.initialEmailState = "sent"
    else if (state === "completed") session.initialEmailState = "completed"
    else if (state === "claiming" || state === "dispatching") session.initialEmailState = state
    else if (state === "uncertain_after_dispatch") session.initialEmailState = "uncertain_after_dispatch"
    else session.initialEmailState = "failed"
    return session
  }

  if (operation === "callback-call") {
    if (state === "started" || state === "sent") session.callbackCallState = "started"
    else if (state === "completed") session.callbackCallState = "completed"
    else if (state === "claiming" || state === "dispatching") session.callbackCallState = state
    else if (state === "uncertain_after_dispatch") session.callbackCallState = "uncertain_after_dispatch"
    else session.callbackCallState = "failed"
    return session
  }

  if (operation === "lead-notification") {
    if (state === "sent" || state === "completed") session.leadNotificationState = "sent"
    else if (state === "claiming" || state === "dispatching") session.leadNotificationState = "dispatching"
    else if (state === "uncertain_after_dispatch") session.leadNotificationState = "uncertain"
    else session.leadNotificationState = "failed"
    return session
  }

  if (record.providerId) session.scheduledMessageSid = record.providerId
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
  const idempotencyKey = input.idempotencyKey?.trim() || `key-${input.phone}:${input.email}:${input.businessType}`
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
  const idempotencyKey = input.idempotencyKey?.trim() || `key-${input.phone}:${input.email}:${input.businessType}`
  const sessionId = deriveSessionId(idempotencyKey)

  const requestHash = crypto.createHash("sha256").update(`${input.phone}:${input.email}:${input.businessType}`).digest("hex")

  const db = demoDb()
  if (!db) {
    let cached = memorySessions.get(sessionId)
    if (!cached) {
      cached = createFollowUpSession({ ...input, idempotencyKey, sessionId })
      // store request hash loosely on cached object (not strictly typed but works in memory)
      ;(cached as any)._requestHash = requestHash
      memorySessions.set(sessionId, cached)
      return { session: structuredClone(cached), isNew: true }
    }
    if ((cached as any)._requestHash && (cached as any)._requestHash !== requestHash) {
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
      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new Error("idempotency_key_payload_mismatch")
      }
      if (new Date(existing.expiresAt).getTime() < Date.now()) {
        throw new Error("idempotency_key_expired")
      }
      memorySessions.set(sessionId, existing)
      return { session: existing, isNew: false }
    }

    const newSession = createFollowUpSession({ ...input, idempotencyKey, sessionId })
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

export async function saveFollowUpSession(session: FollowUpDemoSession) {
  session.updatedAt = new Date().toISOString()
  if (session.events.length > 50) session.events = session.events.slice(-50)
  if (session.messages.length > 50) session.messages = session.messages.slice(-50)

  memorySessions.set(session.id, structuredClone(session))
  const db = demoDb()
  if (!db) {
    if (isProductionFirebaseRequired()) {
      throw new Error("Persistence required in production but Firestore is unavailable.")
    }
    return session
  }

  const tenantId = getDemoTenantId()
  const docRef = getFollowUpSessionsCollection(db, tenantId).doc(session.id)

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef)
    const firestoreSession = JSON.parse(JSON.stringify(session)) as FollowUpDemoSession

    if (snap.exists) {
      const existing = snap.data() as FollowUpDemoSession

      // Monotonic operation state preservation: never overwrite terminal/started states back to pending or claiming
      if (existing.initialCallState === "started" || existing.initialCallState === "completed" || existing.initialCallState === "dispatching" || existing.initialCallState === "uncertain_after_dispatch") {
        session.initialCallState = existing.initialCallState
        firestoreSession.initialCallState = existing.initialCallState
        if (existing.twilioCallSid) {
          session.twilioCallSid = existing.twilioCallSid
          firestoreSession.twilioCallSid = existing.twilioCallSid
        }
        if (existing.twilioNumber) {
          session.twilioNumber = existing.twilioNumber
          firestoreSession.twilioNumber = existing.twilioNumber
        }
      }
      if (existing.initialEmailState === "sent" || existing.initialEmailState === "completed" || existing.initialEmailState === "dispatching" || existing.initialEmailState === "uncertain_after_dispatch") {
        session.initialEmailState = existing.initialEmailState
        firestoreSession.initialEmailState = existing.initialEmailState
      }
      if (existing.callbackCallState === "started" || existing.callbackCallState === "completed" || existing.callbackCallState === "dispatching" || existing.callbackCallState === "uncertain_after_dispatch") {
        session.callbackCallState = existing.callbackCallState
        firestoreSession.callbackCallState = existing.callbackCallState
      }
      if (existing.leadNotificationState === "sent" || existing.leadNotificationState === "uncertain" || existing.leadNotificationState === "dispatching") {
        session.leadNotificationState = existing.leadNotificationState
        firestoreSession.leadNotificationState = existing.leadNotificationState
      }

      // Merge events by id preserving order
      const eventMap = new Map<string, FollowUpDemoEvent>()
      for (const e of existing.events || []) eventMap.set(e.id, e)
      for (const e of session.events || []) eventMap.set(e.id, e)
      const mergedEvents = Array.from(eventMap.values())
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-50)

      // Merge messages by id or sid
      const msgMap = new Map<string, FollowUpDemoMessage>()
      for (const m of existing.messages || []) msgMap.set(m.id || m.sid || m.body, m)
      for (const m of session.messages || []) msgMap.set(m.id || m.sid || m.body, m)
      const mergedMessages = Array.from(msgMap.values())
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(-50)

      session.events = mergedEvents
      session.messages = mergedMessages
      firestoreSession.events = mergedEvents
      firestoreSession.messages = mergedMessages
    }

    transaction.set(docRef, {
      ...firestoreSession,
      tenantId,
      source: "volimox_followup_demo",
      status: session.status,
      schemaVersion: 1,
      scheduledMessageSid: session.scheduledMessageSid ?? FieldValue.delete(),
      expiresAtServer: Timestamp.fromDate(new Date(session.expiresAt)),
      updatedAtServer: FieldValue.serverTimestamp(),
    }, { merge: true })
  })

  memorySessions.set(session.id, structuredClone(session))
  return session
}

export async function getFollowUpSession(id: string) {
  const cached = memorySessions.get(id)
  if (cached) return structuredClone(cached)
  const db = demoDb()
  if (!db) {
    if (isProductionFirebaseRequired()) {
      throw new Error("Persistence required in production but Firestore is unavailable.")
    }
    return null
  }
  const snapshot = await getFollowUpSessionsCollection(db).doc(id).get()
  if (!snapshot.exists) return null
  const session = snapshot.data() as FollowUpDemoSession
  memorySessions.set(id, session)
  return structuredClone(session)
}

export async function findSessionByIdempotencyKey(key: string) {
  if (!key) return null
  const sessionId = deriveSessionId(key)
  const cached = memorySessions.get(sessionId) || [...memorySessions.values()].find((s) => s.idempotencyKey === key && new Date(s.expiresAt).getTime() > Date.now())
  if (cached) return structuredClone(cached)
  const db = demoDb()
  if (!db) {
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

export async function findLatestSessionByPhone(value: unknown) {
  const phone = normalizeDemoPhone(value)
  if (!phone) return null
  const cached = [...memorySessions.values()]
    .filter((session) => session.phone === phone && new Date(session.expiresAt).getTime() > Date.now())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (cached) return structuredClone(cached)
  const db = demoDb()
  if (!db) {
    if (isProductionFirebaseRequired()) {
      throw new Error("Persistence required in production but Firestore is unavailable.")
    }
    return null
  }
  const snapshot = await getFollowUpSessionsCollection(db).where("phone", "==", phone).limit(10).get()
  const sessions = snapshot.docs.map((document) => document.data() as FollowUpDemoSession)
    .filter((session) => new Date(session.expiresAt).getTime() > Date.now())
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
