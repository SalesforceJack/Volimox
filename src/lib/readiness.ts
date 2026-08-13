import { NextResponse } from "next/server"
import { isPromiseTimeoutError, withTimeout } from "@/lib/promise-timeout"
import { logEvent, requestIdFor, withRequestId } from "@/lib/observability"

export const FIRESTORE_READINESS_TIMEOUT_MS = 2500

export type ReadinessDb = {
  collection: (collectionPath: string) => {
    doc: (documentPath: string) => {
      get: () => Promise<unknown>;
    };
  };
}

type ReadinessDbFactory = () => ReadinessDb | null

type ReadinessResult = {
  ready: true
  reason?: undefined
  error?: undefined
} | {
  ready: false
  reason: "not_configured" | "timeout" | "error"
  error?: unknown
}

export function createReadinessHandler({
  service,
  getDb,
  timeoutMs = FIRESTORE_READINESS_TIMEOUT_MS,
}: {
  service: string
  getDb: ReadinessDbFactory
  timeoutMs?: number
}) {
  return async function readinessHandler(request: Request) {
    const requestId = requestIdFor(request)
    let result: ReadinessResult

    try {
      const db = getDb()
      if (!db) {
        result = { ready: false, reason: "not_configured" }
      } else {
        await withTimeout(
          db.collection("tenants").doc("__readiness_probe__").get(),
          timeoutMs,
          `Firestore readiness probe timed out after ${timeoutMs}ms`,
        )
        result = { ready: true }
      }
    } catch (error) {
      result = {
        ready: false,
        reason: isPromiseTimeoutError(error) ? "timeout" : "error",
        error,
      }
    }

    if (!result.ready) {
      logEvent("warn", "ready.dependency_degraded", {
        requestId,
        dependency: "firestore",
        reason: result.reason,
        ...(result.error ? { error: result.error } : {}),
      })
    }

    logEvent(result.ready ? "info" : "warn", "ready.checked", {
      requestId,
      status: result.ready ? "ready" : "degraded",
      checks: { firestore: result.ready ? "ready" : "unavailable" },
    })

    return withRequestId(
      NextResponse.json(
        {
          ok: result.ready,
          status: result.ready ? "ready" : "degraded",
          service,
          version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "unknown",
          checks: { firestore: result.ready ? "ready" : "unavailable" },
        },
        { status: result.ready ? 200 : 503 },
      ),
      requestId,
    )
  }
}
