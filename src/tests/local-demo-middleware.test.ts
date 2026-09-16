import { NextRequest, type NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { middleware } from "@/middleware"
import { isValidRequestId, REQUEST_ID_HEADER } from "@/lib/request-id"

function request(path: string, requestId?: string) {
  return new NextRequest(`http://127.0.0.1:3002${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-marker": "walkthrough-client",
      ...(requestId === undefined ? {} : { [REQUEST_ID_HEADER]: requestId }),
    },
  })
}

function expectForwarded(response: NextResponse, expectedId?: string) {
  const responseId = response.headers.get(REQUEST_ID_HEADER)
  expect(response.status).toBe(200)
  expect(response.headers.get("x-middleware-next")).toBe("1")
  expect(isValidRequestId(responseId)).toBe(true)
  if (expectedId !== undefined) expect(responseId).toBe(expectedId)
  // These are NextResponse's request override headers, consumed by Next before
  // calling the route. The route and browser must observe the same request ID.
  expect(response.headers.get(`x-middleware-request-${REQUEST_ID_HEADER}`)).toBe(responseId)
  expect(response.headers.get("x-middleware-override-headers")?.split(",")).toContain(REQUEST_ID_HEADER)
  expect(response.headers.get("x-middleware-request-x-client-marker")).toBe("walkthrough-client")
  expect(response.headers.get("x-middleware-request-content-type")).toBe("application/json")
  return responseId
}

describe("local demo API boundary and request IDs", () => {
  const network = vi.fn(async () => { throw new Error("Middleware must not access a provider") })

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("VOLIMOX_LOCAL_DEMO", "true")
    network.mockClear()
    vi.stubGlobal("fetch", network)
  })

  afterEach(() => {
    expect(network).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("keeps ordinary development provider routes available and preserves request IDs", () => {
    vi.stubEnv("VOLIMOX_LOCAL_DEMO", "false")
    expectForwarded(middleware(request("/api/proton/quote", "ordinary.dev:request_123")), "ordinary.dev:request_123")
  })

  it("keeps production provider routes available even if the local flag is set", () => {
    vi.stubEnv("NODE_ENV", "production")
    expectForwarded(middleware(request("/api/proton/quote", "production-request-123")), "production-request-123")
  })

  it("blocks a provider route locally and returns its valid request ID", async () => {
    const response = middleware(request("/api/proton/quote", "local-blocked-request-123"))
    expect(response.status).toBe(503)
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("local-blocked-request-123")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-middleware-next")).toBeNull()
    expect(response.headers.get("x-middleware-override-headers")).toBeNull()
    expect(await response.json()).toMatchObject({ ok: false, code: "local_preview_only" })
  })

  it("passes the local simulation route with the same ID for route and browser", () => {
    expectForwarded(middleware(request("/api/example-limo/simulation", "local-simulation-request-123")), "local-simulation-request-123")
  })

  it.each(["invalid request id", "x".repeat(129)])("replaces invalid incoming ID %s", (invalidId) => {
    const generated = expectForwarded(middleware(request("/api/example-limo/simulation", invalidId)))
    expect(generated).not.toBe(invalidId)
  })

  it("generates and forwards an ID when the request has none", () => {
    expectForwarded(middleware(request("/api/example-limo/simulation")))
  })

  it("also replaces invalid IDs on blocked local requests", async () => {
    const response = middleware(request("/api/proton/quote", "invalid request id"))
    expect(response.status).toBe(503)
    expect(isValidRequestId(response.headers.get(REQUEST_ID_HEADER))).toBe(true)
    expect(response.headers.get(REQUEST_ID_HEADER)).not.toBe("invalid request id")
    expect(response.headers.get("x-middleware-next")).toBeNull()
    expect(await response.json()).toMatchObject({ code: "local_preview_only" })
  })
})
