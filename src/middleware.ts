import { NextRequest, NextResponse } from "next/server"
import { createRequestId, isValidRequestId, REQUEST_ID_HEADER } from "@/lib/request-id"

export function middleware(request: NextRequest) {
  const incoming = request.headers.get(REQUEST_ID_HEADER)
  const requestId = isValidRequestId(incoming) ? incoming : createRequestId()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

export const config = {
  matcher: ["/api/:path*"],
}
