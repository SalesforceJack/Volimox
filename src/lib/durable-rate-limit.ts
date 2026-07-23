/**
 * Volimox — Durable Firestore-backed rate limiter
 *
 * Supplements the existing in-memory rate limiter for serverless production
 * environments where per-instance memory is not shared.
 *
 * Design:
 *   - Collection: tenants/{tenantId}/rateLimits/{hashedKey}
 *   - Uses Firestore transactions for atomicity
 *   - Stores HMAC-SHA256 hashed keys (never raw IPs or phones)
 *   - Includes expiresAtServer for TTL policy auto-deletion
 *   - Fast-path: in-memory check first, Firestore only if in-memory passes
 *
 * NOTE: Firebase TTL policies must be enabled on the `rateLimits` collection
 * group for automatic document cleanup. Adding expiresAtServer alone does not
 * activate deletion.
 */

import crypto from "node:crypto"
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { demoDb, getDemoTenantId, isProductionFirebaseRequired } from "./firebase-admin"
import { withinDemoRateLimit as inMemoryRateLimit } from "./demo-rate-limit"

// ---------------------------------------------------------------------------
// Key hashing
// ---------------------------------------------------------------------------

function rateLimitHashSecret(): string {
  const secret = process.env.VOLIMOX_RATE_LIMIT_SECRET?.trim()
    || process.env.VOLIMOX_DEMO_LINK_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error("VOLIMOX_RATE_LIMIT_SECRET is required in production.")
  }
  return "volimox-development-rate-limit-key"
}

export function hashRateLimitKey(key: string): string {
  return crypto.createHmac("sha256", rateLimitHashSecret()).update(key).digest("hex").slice(0, 40)
}

// ---------------------------------------------------------------------------
// Durable rate limit check
// ---------------------------------------------------------------------------

interface RateLimitDoc {
  count: number
  windowStart: number
  windowMs: number
  expiresAtServer: FirebaseFirestore.Timestamp
  updatedAtServer: FirebaseFirestore.FieldValue
}

/**
 * Check a durable rate limit backed by Firestore.
 *
 * In production, if Firestore is unavailable, this REJECTS the request
 * (fail closed) for cost-bearing endpoints.
 *
 * @param key - The rate limit key (will be HMAC-hashed for storage)
 * @param limit - Maximum requests in the window
 * @param windowMs - Window duration in milliseconds
 * @param options - Optional configuration
 * @returns true if the request is within limits, false if rate limited
 */
export async function checkDurableRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options?: {
    /** If true, fail closed (reject) when Firestore is unavailable in production */
    failClosed?: boolean
  },
): Promise<boolean> {
  // Fast-path: in-memory check
  if (!inMemoryRateLimit(key, limit, windowMs)) {
    return false
  }

  const db = demoDb()
  if (!db) {
    if (options?.failClosed && isProductionFirebaseRequired()) {
      return false
    }
    // In development without Firestore, in-memory limiter is sufficient
    return true
  }

  const tenantId = getDemoTenantId()
  const hashedKey = hashRateLimitKey(key)
  const docRef = db.collection("tenants").doc(tenantId).collection("rateLimits").doc(hashedKey)

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef)
      const now = Date.now()

      if (snap.exists) {
        const data = snap.data() as RateLimitDoc
        // Window expired — reset
        if (now - data.windowStart >= windowMs) {
          tx.update(docRef, {
            count: 1,
            windowStart: now,
            windowMs,
            expiresAtServer: Timestamp.fromDate(new Date(now + windowMs + 60_000)),
            updatedAtServer: FieldValue.serverTimestamp(),
          })
          return true
        }
        // Within window — check limit
        if (data.count >= limit) {
          return false
        }
        tx.update(docRef, {
          count: FieldValue.increment(1),
          updatedAtServer: FieldValue.serverTimestamp(),
        })
        return true
      }

      // New entry
      tx.set(docRef, {
        count: 1,
        windowStart: now,
        windowMs,
        expiresAtServer: Timestamp.fromDate(new Date(now + windowMs + 60_000)),
        updatedAtServer: FieldValue.serverTimestamp(),
      })
      return true
    })
  } catch (error) {
    console.error("[durable-rate-limit] Transaction failed:", error instanceof Error ? error.message : "unknown")
    if (options?.failClosed && isProductionFirebaseRequired()) {
      return false
    }
    // In non-production or non-fail-closed mode, fall through to in-memory result
    return true
  }
}

/**
 * Multi-dimensional rate limit check.
 * All dimensions must pass for the request to be allowed.
 */
export async function checkMultiDimensionRateLimit(
  dimensions: Array<{ key: string; limit: number; windowMs: number }>,
  options?: { failClosed?: boolean },
): Promise<boolean> {
  for (const dim of dimensions) {
    const allowed = await checkDurableRateLimit(dim.key, dim.limit, dim.windowMs, options)
    if (!allowed) return false
  }
  return true
}
