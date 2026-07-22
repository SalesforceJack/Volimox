import crypto from "node:crypto"
import { FieldValue, Timestamp, type Firestore, type CollectionReference } from "firebase-admin/firestore"

export type SideEffectState =
  | "pending" | "claiming" | "dispatching"
  | "sent" | "started" | "completed"
  | "failed_before_dispatch" | "uncertain_after_dispatch" | "provider_rejected"

export interface SideEffectRecord {
  id: string
  state: SideEffectState
  operationType: string
  sessionId?: string
  claimedAt?: number
  claimOwnerId?: string
  dispatchedAt?: number
  completedAt?: number
  providerId?: string
  providerType?: string
  errorCategory?: string
  expiresAtServer?: FirebaseFirestore.Timestamp | number
  updatedAtServer?: FirebaseFirestore.FieldValue
}

export interface SideEffectClaimOptions {
  sessionId?: string
  claimTimeoutMs?: number
  dispatchTimeoutMs?: number
  ttlHours?: number
}

export interface ClaimResult {
  claimed: boolean
  ownerId?: string
  record?: SideEffectRecord
  reason?: "terminal" | "active_lock" | "not_found"
}

export interface SideEffectStore {
  claim(id: string, operationType: string, opts?: SideEffectClaimOptions): Promise<ClaimResult>
  markDispatching(id: string, ownerId: string): Promise<void>
  markCompleted(id: string, ownerId: string, completedState: "sent" | "started" | "completed", providerId?: string): Promise<void>
  markProviderRejected(id: string, ownerId: string, errorCategory: string): Promise<void>
  markFailedBeforeDispatch(id: string, ownerId: string, errorCategory: string): Promise<void>
  markUncertain(id: string, ownerId: string, errorCategory: string, providerId?: string): Promise<void>
  get(id: string): Promise<SideEffectRecord | null>
}

export class ProviderRejectedError extends Error {
  constructor(public readonly reasonCode: string) {
    super(`Provider rejected: ${reasonCode}`)
    this.name = 'ProviderRejectedError'
  }
}

export class SideEffectPreflightError extends Error {
  constructor(public readonly reasonCode: string) {
    super(`Side-effect preflight failed: ${reasonCode}`)
    this.name = "SideEffectPreflightError"
  }
}

export class SideEffectOwnershipError extends Error {
  constructor() {
    super("Side-effect claim ownership was lost.")
    this.name = "SideEffectOwnershipError"
  }
}

export class SideEffectPersistenceUnavailableError extends Error {
  constructor() {
    super("Durable side-effect persistence is required but unavailable.")
    this.name = "SideEffectPersistenceUnavailableError"
  }
}

const DEFAULT_CLAIM_TIMEOUT_MS = 60_000
const DEFAULT_DISPATCH_TIMEOUT_MS = 120_000
const DEFAULT_TTL_HOURS = 24

const TERMINAL_STATES: SideEffectState[] = [
  "sent",
  "started",
  "completed",
  "uncertain_after_dispatch",
  "provider_rejected"
]

export function deriveSideEffectId(...parts: string[]): string {
  const joined = parts.filter(Boolean).join(":")
  return crypto.createHash("sha256").update(joined).digest("hex").slice(0, 32)
}

export function categorizeError(error?: string | unknown): string {
  if (!error) return "unknown"
  const msg = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error))
  const lower = msg.toLowerCase()
  if (lower.includes("timeout") || lower.includes("timed out")) return "timeout"
  if (lower.includes("network") || lower.includes("econnrefused") || lower.includes("fetch failed")) return "network"
  if (lower.includes("rate") || lower.includes("throttl") || lower.includes("429")) return "rate_limited"
  if (lower.includes("auth") || lower.includes("credential") || lower.includes("401") || lower.includes("403")) return "auth"
  if (lower.includes("not configured") || lower.includes("not set")) return "not_configured"
  return "provider_error"
}

export function isTransientProviderHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599)
}

function timestampMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const millis = (value as { toMillis: () => number }).toMillis()
    return Number.isFinite(millis) ? millis : undefined
  }
  return undefined
}

function isExpired(record: SideEffectRecord, now: number): boolean {
  const expiresAt = timestampMillis(record.expiresAtServer)
  return expiresAt !== undefined && expiresAt <= now
}

function isStaleDispatch(record: SideEffectRecord, now: number, timeoutMs: number): boolean {
  if (record.state !== "dispatching") return false
  const dispatchStartedAt = record.dispatchedAt ?? record.claimedAt
  return dispatchStartedAt !== undefined && now - dispatchStartedAt >= timeoutMs
}

export class FirestoreSideEffectStore implements SideEffectStore {
  constructor(private db: Firestore, private collectionRef: CollectionReference) {}

  async claim(id: string, operationType: string, opts?: SideEffectClaimOptions): Promise<ClaimResult> {
    const timeoutMs = opts?.claimTimeoutMs ?? DEFAULT_CLAIM_TIMEOUT_MS
    const dispatchTimeoutMs = opts?.dispatchTimeoutMs ?? DEFAULT_DISPATCH_TIMEOUT_MS
    const ttlHours = opts?.ttlHours ?? DEFAULT_TTL_HOURS

    return this.db.runTransaction(async (tx) => {
      const docRef = this.collectionRef.doc(id)
      const snap = await tx.get(docRef)
      const now = Date.now()
      const ownerId = crypto.randomUUID()

      if (snap.exists) {
        const data = snap.data() as SideEffectRecord
        if (data.state === "dispatching") {
          if (isStaleDispatch(data, now, dispatchTimeoutMs)) {
            const uncertainRecord: SideEffectRecord = {
              ...data,
              state: "uncertain_after_dispatch",
              errorCategory: "dispatch_timeout",
              completedAt: now,
            }
            tx.update(docRef, {
              state: "uncertain_after_dispatch",
              errorCategory: "dispatch_timeout",
              completedAt: now,
              updatedAtServer: FieldValue.serverTimestamp(),
            })
            return { claimed: false, record: uncertainRecord, reason: "terminal" }
          }
          return { claimed: false, record: data, reason: "active_lock" }
        }
        const expired = isExpired(data, now)
        if (data.state === "uncertain_after_dispatch" || (TERMINAL_STATES.includes(data.state) && !expired)) {
          return { claimed: false, record: data, reason: "terminal" }
        }
        if (data.state === "claiming" && data.claimedAt && now - data.claimedAt < timeoutMs) {
          return { claimed: false, record: data, reason: "active_lock" }
        }

        // Expired claim lock or failed_before_dispatch — re-claim
        tx.update(docRef, {
          state: "claiming",
          operationType,
          ...(opts?.sessionId ? { sessionId: opts.sessionId } : {}),
          claimedAt: now,
          claimOwnerId: ownerId,
          dispatchedAt: FieldValue.delete(),
          completedAt: FieldValue.delete(),
          providerId: FieldValue.delete(),
          errorCategory: FieldValue.delete(),
          expiresAtServer: Timestamp.fromDate(new Date(now + ttlHours * 60 * 60 * 1000)),
          updatedAtServer: FieldValue.serverTimestamp(),
        })
        const updated: SideEffectRecord = {
          ...data,
          state: "claiming",
          operationType,
          ...(opts?.sessionId ? { sessionId: opts.sessionId } : {}),
          claimedAt: now,
          claimOwnerId: ownerId,
          dispatchedAt: undefined,
          completedAt: undefined,
          providerId: undefined,
          errorCategory: undefined,
        }
        return { claimed: true, ownerId, record: updated }
      }

      const record: SideEffectRecord = {
        id,
        state: "claiming",
        operationType,
        ...(opts?.sessionId ? { sessionId: opts.sessionId } : {}),
        claimedAt: now,
        claimOwnerId: ownerId,
        expiresAtServer: Timestamp.fromDate(new Date(now + ttlHours * 60 * 60 * 1000)),
        updatedAtServer: FieldValue.serverTimestamp() as any,
      }
      tx.set(docRef, record)
      return { claimed: true, ownerId, record }
    })
  }

  private async transition(id: string, ownerId: string, allowedState: SideEffectState, updates: Record<string, unknown>): Promise<void> {
    await this.db.runTransaction(async (tx) => {
      const docRef = this.collectionRef.doc(id)
      const snap = await tx.get(docRef)
      const record = snap.exists ? snap.data() as SideEffectRecord : null
      if (!record || record.state !== allowedState || record.claimOwnerId !== ownerId) {
        throw new SideEffectOwnershipError()
      }
      tx.update(docRef, {
        ...updates,
        updatedAtServer: FieldValue.serverTimestamp(),
      })
    })
  }

  async markDispatching(id: string, ownerId: string): Promise<void> {
    await this.transition(id, ownerId, "claiming", {
      state: "dispatching",
      dispatchedAt: Date.now(),
    })
  }

  async markCompleted(id: string, ownerId: string, completedState: "sent" | "started" | "completed", providerId?: string): Promise<void> {
    await this.transition(id, ownerId, "dispatching", {
      state: completedState,
      completedAt: Date.now(),
      ...(providerId ? { providerId } : {}),
    })
  }

  async markProviderRejected(id: string, ownerId: string, errorCategory: string): Promise<void> {
    await this.transition(id, ownerId, "dispatching", {
      state: "provider_rejected",
      errorCategory,
      completedAt: Date.now(),
    })
  }

  async markFailedBeforeDispatch(id: string, ownerId: string, errorCategory: string): Promise<void> {
    await this.transition(id, ownerId, "claiming", {
      state: "failed_before_dispatch",
      errorCategory,
      completedAt: Date.now(),
    })
  }

  async markUncertain(id: string, ownerId: string, errorCategory: string, providerId?: string): Promise<void> {
    await this.transition(id, ownerId, "dispatching", {
      state: "uncertain_after_dispatch",
      errorCategory,
      ...(providerId ? { providerId } : {}),
      completedAt: Date.now(),
    })
  }

  async get(id: string): Promise<SideEffectRecord | null> {
    const snap = await this.collectionRef.doc(id).get()
    return snap.exists ? (snap.data() as SideEffectRecord) : null
  }
}

export function createFirestoreSideEffectStore(db: Firestore, collectionRef: CollectionReference): FirestoreSideEffectStore {
  return new FirestoreSideEffectStore(db, collectionRef)
}

export class InMemorySideEffectStore implements SideEffectStore {
  private effects = new Map<string, SideEffectRecord>()

  async claim(id: string, operationType: string, opts?: SideEffectClaimOptions): Promise<ClaimResult> {
    const timeoutMs = opts?.claimTimeoutMs ?? DEFAULT_CLAIM_TIMEOUT_MS
    const dispatchTimeoutMs = opts?.dispatchTimeoutMs ?? DEFAULT_DISPATCH_TIMEOUT_MS
    const ttlHours = opts?.ttlHours ?? DEFAULT_TTL_HOURS
    const now = Date.now()
    const ownerId = crypto.randomUUID()
    const existing = this.effects.get(id)

    if (existing) {
      if (existing.state === "dispatching") {
        if (isStaleDispatch(existing, now, dispatchTimeoutMs)) {
          const uncertain = { ...existing, state: "uncertain_after_dispatch" as const, errorCategory: "dispatch_timeout", completedAt: now }
          this.effects.set(id, uncertain)
          return { claimed: false, record: uncertain, reason: "terminal" }
        }
        return { claimed: false, record: existing, reason: "active_lock" }
      }
      const expired = isExpired(existing, now)
      if (existing.state === "uncertain_after_dispatch" || (TERMINAL_STATES.includes(existing.state) && !expired)) {
        return { claimed: false, record: existing, reason: "terminal" }
      }
      if (existing.state === "claiming" && existing.claimedAt && now - existing.claimedAt < timeoutMs) {
        return { claimed: false, record: existing, reason: "active_lock" }
      }

      const updated = {
        ...existing,
        state: "claiming" as const,
        operationType,
        ...(opts?.sessionId ? { sessionId: opts.sessionId } : {}),
        claimedAt: now,
        claimOwnerId: ownerId,
        dispatchedAt: undefined,
        completedAt: undefined,
        providerId: undefined,
        errorCategory: undefined,
        expiresAtServer: now + ttlHours * 60 * 60 * 1000,
      }
      this.effects.set(id, updated)
      return { claimed: true, ownerId, record: updated }
    }

    const record: SideEffectRecord = {
      id,
      state: "claiming",
      operationType,
      sessionId: opts?.sessionId,
      claimedAt: now,
      claimOwnerId: ownerId,
      expiresAtServer: now + ttlHours * 60 * 60 * 1000,
    }
    this.effects.set(id, record)
    return { claimed: true, ownerId, record }
  }

  private ownedRecord(id: string, ownerId: string, allowedState: SideEffectState): SideEffectRecord {
    const record = this.effects.get(id)
    if (!record || record.state !== allowedState || record.claimOwnerId !== ownerId) {
      throw new SideEffectOwnershipError()
    }
    return record
  }

  async markDispatching(id: string, ownerId: string): Promise<void> {
    const record = this.ownedRecord(id, ownerId, "claiming")
    record.state = "dispatching"
    record.dispatchedAt = Date.now()
  }

  async markCompleted(id: string, ownerId: string, completedState: "sent" | "started" | "completed", providerId?: string): Promise<void> {
    const record = this.ownedRecord(id, ownerId, "dispatching")
    record.state = completedState
    record.completedAt = Date.now()
    if (providerId) record.providerId = providerId
  }

  async markProviderRejected(id: string, ownerId: string, errorCategory: string): Promise<void> {
    const record = this.ownedRecord(id, ownerId, "dispatching")
    record.state = "provider_rejected"
    record.errorCategory = errorCategory
    record.completedAt = Date.now()
  }

  async markFailedBeforeDispatch(id: string, ownerId: string, errorCategory: string): Promise<void> {
    const record = this.ownedRecord(id, ownerId, "claiming")
    record.state = "failed_before_dispatch"
    record.errorCategory = errorCategory
    record.completedAt = Date.now()
  }

  async markUncertain(id: string, ownerId: string, errorCategory: string, providerId?: string): Promise<void> {
    const record = this.ownedRecord(id, ownerId, "dispatching")
    record.state = "uncertain_after_dispatch"
    record.errorCategory = errorCategory
    if (providerId) record.providerId = providerId
    record.completedAt = Date.now()
  }

  async get(id: string): Promise<SideEffectRecord | null> {
    return this.effects.get(id) || null
  }
}

export type SideEffectOutcome<T> =
  | { kind: "executed"; value: T; providerId?: string }
  | { kind: "already_completed"; record: SideEffectRecord }
  | { kind: "already_dispatching"; record: SideEffectRecord }
  | { kind: "persistence_unavailable" }
  | { kind: "reconciliation_required"; value?: T; providerId?: string }
  | { kind: "preflight_failed"; errorCategory: string }
  | { kind: "provider_rejected"; errorCategory: string }
  | { kind: "uncertain" }

export async function executeSideEffect<T>(
  store: SideEffectStore,
  effectId: string,
  operationType: string,
  dispatch: () => Promise<{ value: T; providerId?: string }>,
  options?: {
    sessionId?: string
    claimTimeoutMs?: number
    dispatchTimeoutMs?: number
    ttlHours?: number
    completedState?: "sent" | "started" | "completed"
    preflight?: () => Promise<void> | void
  }
): Promise<SideEffectOutcome<T>> {
  let claimRes: ClaimResult
  try {
    claimRes = await store.claim(effectId, operationType, options)
  } catch {
    return { kind: "persistence_unavailable" }
  }

  if (!claimRes.claimed) {
    if (claimRes.reason === "terminal") {
      if (claimRes.record?.state === "provider_rejected") {
        return { kind: "provider_rejected", errorCategory: claimRes.record.errorCategory || "provider_error" }
      }
      if (claimRes.record?.state === "uncertain_after_dispatch") {
        return { kind: "uncertain" }
      }
      return { kind: "already_completed", record: claimRes.record! }
    }
    return { kind: "already_dispatching", record: claimRes.record! }
  }

  const ownerId = claimRes.ownerId
  if (!ownerId) return { kind: "persistence_unavailable" }

  try {
    await options?.preflight?.()
  } catch (error) {
    const errorCategory = error instanceof SideEffectPreflightError ? error.reasonCode : categorizeError(error)
    try {
      await store.markFailedBeforeDispatch(effectId, ownerId, errorCategory)
    } catch {
      return { kind: "persistence_unavailable" }
    }
    return { kind: "preflight_failed", errorCategory }
  }

  try {
    await store.markDispatching(effectId, ownerId)
  } catch (err) {
    return { kind: "persistence_unavailable" }
  }

  let result: { value: T; providerId?: string }
  try {
    result = await dispatch()
  } catch (error) {
    if (error instanceof ProviderRejectedError) {
      try {
        await store.markProviderRejected(effectId, ownerId, error.reasonCode)
      } catch {
        return { kind: "reconciliation_required" }
      }
      return { kind: "provider_rejected", errorCategory: error.reasonCode }
    }

    // Any other synchronous error is uncertain
    try {
      await store.markUncertain(effectId, ownerId, categorizeError(error))
    } catch {
      // Ignored
    }
    return { kind: "uncertain" }
  }

  try {
    await store.markCompleted(effectId, ownerId, options?.completedState ?? "sent", result.providerId)
  } catch (err) {
    return { kind: "reconciliation_required", value: result.value, providerId: result.providerId }
  }

  return { kind: "executed", value: result.value, providerId: result.providerId }
}

export function createSideEffectStore(
  db: Firestore | null,
  collectionRef: CollectionReference | null,
): SideEffectStore {
  if (db && collectionRef) return createFirestoreSideEffectStore(db, collectionRef)
  if (process.env.NODE_ENV === "production") throw new SideEffectPersistenceUnavailableError()
  return new InMemorySideEffectStore()
}
