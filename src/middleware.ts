import { NextResponse, type NextRequest } from "next/server"
import { createRequestId, isValidRequestId, REQUEST_ID_HEADER } from "@/lib/request-id"

const localApiPaths = new Set(["/api/health", "/api/ready", "/api/example-limo/simulation"])

export function middleware(request: NextRequest) {
  const incoming = request.headers.get(REQUEST_ID_HEADER)
  const requestId = isValidRequestId(incoming) ? incoming : createRequestId()
  const localPreview = process.env.NODE_ENV !== "production" && process.env.VOLIMOX_LOCAL_DEMO === "true"
  if (localPreview && !localApiPaths.has(request.nextUrl.pathname)) {
    return NextResponse.json({
      ok: false,
      code: "local_preview_only",
      error: "This local preview uses the Example Limo walkthrough. Connected calls, messages and payments are unavailable here.",
    }, { status: 503, headers: { "Cache-Control": "no-store", [REQUEST_ID_HEADER]: requestId } })
  }
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

export const config = { matcher: ["/api/:path*"] }
