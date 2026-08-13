import { NextResponse } from "next/server"
import { demoDb, getDemoTenantId } from "@/lib/firebase-admin"
import { logEvent, requestIdFor, withRequestId } from "@/lib/observability"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestId = requestIdFor(request)
  let firestoreReady = false

  try {
    const db = demoDb()
    if (!db) throw new Error("firestore_not_configured")
    await db.collection("tenants").doc(getDemoTenantId()).get()
    firestoreReady = true
  } catch (error) {
    logEvent("warn", "ready.dependency_degraded", {
      requestId,
      dependency: "firestore",
      error,
    })
  }

  const ready = firestoreReady
  logEvent(ready ? "info" : "warn", "ready.checked", {
    requestId,
    status: ready ? "ready" : "degraded",
    checks: { firestore: firestoreReady ? "ready" : "unavailable" },
  })

  return withRequestId(
    NextResponse.json(
      {
        ok: ready,
        status: ready ? "ready" : "degraded",
        service: "volimox",
        version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "unknown",
        checks: { firestore: firestoreReady ? "ready" : "unavailable" },
      },
      { status: ready ? 200 : 503 },
    ),
    requestId,
  )
}
