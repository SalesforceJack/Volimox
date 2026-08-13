import { NextResponse } from "next/server"
import { logEvent, requestIdFor, withRequestId } from "@/lib/observability"

export const runtime = "nodejs"

export function GET(request: Request) {
  const requestId = requestIdFor(request)
  logEvent("info", "health.checked", { requestId, status: "alive" })
  return withRequestId(
    NextResponse.json({
      ok: true,
      status: "alive",
      service: "volimox",
      version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "unknown",
    }),
    requestId,
  )
}
