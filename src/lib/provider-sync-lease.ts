/**
 * Volimox — Provider Sync Lease
 *
 * Provides an atomic, short-lived Firestore lease that prevents two concurrent
 * /events GET requests from simultaneously calling external providers (Twilio
 * listInboundSms, getDemoCallStatus) for the same session.
 *
 * Design:
 *  - Lease document: tenants/{tenantId}/providerSyncLeases/{sessionId}
 *  - State field: providerSyncState ("idle" | "syncing")
 *  - On acquire: transaction reads and writes atomically; rejected if already syncing
 *    and the lease was claimed within the lease window
 *  - Owner-verified release: only the owner that acquired the lease may release it
 *  - Fails closed in production when Firestore is unavailable
 *  - Uses a fresh Firestore read inside every transaction — never a module cache
 */

import crypto from "node:crypto"
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { demoDb, getDemoTenantId, isProductionFirebaseRequired } from "@/lib/firebase-admin"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncLeaseRecord {
  sessionId: string
  providerSyncState: "idle" | "syncing"
  providerSyncOwnerId?: string
  providerSyncClaimedAt?: number
  lastProviderSyncAt?: number
  expiresAtServer?: FirebaseFirestore.Timestamp
  updatedAtServer?: FirebaseFirestore.FieldValue
}

export interface AcquireLeaseResult {
  acquired: boolean
  ownerId?: string
  reason?: "busy" | "recent" | "unavailable"
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEASE_TTL_MS = 60_000 // Provider reads are bounded below this window.
const MIN_SYNC_INTERVAL_MS = 1_500
const LEASE_DOC_TTL_HOURS = 2

export function providerSyncBlockReason(record: SyncLeaseRecord | null, now: number): "busy" | "recent" | null {
  if (!record) return null
  if (record.lastProviderSyncAt !== undefined && now - record.lastProviderSyncAt < MIN_SYNC_INTERVAL_MS) {
    return "recent"
  }
  if (
    record.providerSyncState === "syncing"
    && record.providerSyncClaimedAt !== undefined
    && now - record.providerSyncClaimedAt < LEASE_TTL_MS
  ) {
    return "busy"
  }
  return null
}

export function canReleaseProviderSyncLease(record: SyncLeaseRecord | null, ownerId: string): boolean {
  return Boolean(record && record.providerSyncState === "syncing" && record.providerSyncOwnerId === ownerId)
}

function getProviderSyncLeasesCollection(db: Firestore, tenantId?: string) {
  const id = tenantId?.trim() || getDemoTenantId()
  return db.collection("tenants").doc(id).collection("providerSyncLeases")
}

// ---------------------------------------------------------------------------
// Acquire
// ---------------------------------------------------------------------------

/**
 * Attempt to acquire a sync lease for the given session.
 *
 * Returns { acquired: true, ownerId } on success.
 * Returns { acquired: false } if another request already holds the lease.
 * Development without Firestore uses a no-op lease; production fails closed.
 */
export async function acquireProviderSyncLease(sessionId: string): Promise<AcquireLeaseResult> {
  const db = demoDb()
  if (!db) {
    if (isProductionFirebaseRequired()) return { acquired: false, reason: "unavailable" }
    return { acquired: true, ownerId: undefined }
  }

  const tenantId = getDemoTenantId()
  const collection = getProviderSyncLeasesCollection(db, tenantId)
  const docRef = collection.doc(sessionId)
  const ownerId = crypto.randomBytes(16).toString("hex")
  const now = Date.now()

  try {
    const result = await db.runTransaction(async (tx) => {
      // Always use a fresh read inside the transaction.
      const snap = await tx.get(docRef)
      if (snap.exists) {
        const data = snap.data() as SyncLeaseRecord
        const blockReason = providerSyncBlockReason(data, now)
        if (blockReason) return blockReason
      }

      const record: Partial<SyncLeaseRecord> = {
        sessionId,
        providerSyncState: "syncing",
        providerSyncOwnerId: ownerId,
        providerSyncClaimedAt: now,
        expiresAtServer: Timestamp.fromDate(new Date(now + LEASE_DOC_TTL_HOURS * 60 * 60 * 1000)),
        updatedAtServer: FieldValue.serverTimestamp() as any,
      }
      tx.set(docRef, record, { merge: true })
      return "acquired" as const
    })

    if (result === "acquired") return { acquired: true, ownerId }
    return { acquired: false, reason: result }
  } catch {
    if (isProductionFirebaseRequired()) return { acquired: false, reason: "unavailable" }
    return { acquired: true, ownerId: undefined }
  }
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

/**
 * Release a previously acquired sync lease.
 *
 * Only releases if the ownerId matches the current record's owner, preventing
 * a stale release from clobbering a newly acquired lease.
 */
export async function releaseProviderSyncLease(sessionId: string, ownerId: string | undefined): Promise<void> {
  if (!ownerId) return // No-op lease: nothing to release.

  const db = demoDb()
  if (!db) return

  const tenantId = getDemoTenantId()
  const collection = getProviderSyncLeasesCollection(db, tenantId)
  const docRef = collection.doc(sessionId)

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef)
      if (!snap.exists) return
      const data = snap.data() as SyncLeaseRecord
      if (!canReleaseProviderSyncLease(data, ownerId)) return
      tx.update(docRef, {
        providerSyncState: "idle",
        providerSyncOwnerId: FieldValue.delete(),
        providerSyncClaimedAt: FieldValue.delete(),
        lastProviderSyncAt: Date.now(),
        updatedAtServer: FieldValue.serverTimestamp(),
      })
    })
  } catch {
    // Release failure is non-fatal: the lease will expire via LEASE_TTL_MS.
  }
}
