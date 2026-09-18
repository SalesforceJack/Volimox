import { afterEach, describe, expect, it, vi } from "vitest"
import { toSpokenAddress, verifyExampleLimoAddress } from "@/lib/example-limo/address-verification"

const GOOGLE_KEY = `AIzaSy${"x".repeat(30)}`

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("Example Limo address verification", () => {
  it("keeps a recognizable address usable in the local simulated demo", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY", "")

    await expect(verifyExampleLimoAddress("105 Osprey Ct, Secaucus, NJ", "pickup"))
      .resolves.toMatchObject({ ok: true, status: "confirmed", resolved_address: "105 Osprey Ct, Secaucus, NJ" })
  })

  it("returns a spoken address without ZIP or country after Google resolution", async () => {
    vi.stubEnv("EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY", GOOGLE_KEY)
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "OK", results: [{ formatted_address: "105 Osprey Ct, Secaucus, NJ 07094, USA" }] }),
    })) as unknown as typeof fetch

    const result = await verifyExampleLimoAddress("105 Osprey Court, Secaucus, NJ", "pickup", fetcher)
    expect(result).toEqual({ ok: true, status: "confirmed", resolved_address: "105 Osprey Ct, Secaucus, NJ 07094, USA", spoken_address: "105 Osprey Ct, Secaucus, NJ" })
    expect(toSpokenAddress("1 Main St, Newark, NJ 07102-1234, United States")).toBe("1 Main St, Newark, NJ")
  })

  it("keeps a changed street in focus for explicit rider confirmation", async () => {
    vi.stubEnv("EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY", GOOGLE_KEY)
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "OK", results: [{ formatted_address: "105 Oak Ln, Secaucus, NJ 07094, USA" }] }),
    })) as unknown as typeof fetch

    const result = await verifyExampleLimoAddress("105 Oak Street Court, Secaucus", "pickup", fetcher)
    expect(result).toMatchObject({ ok: true, status: "needs_confirmation", spoken_address: "105 Oak Ln, Secaucus, NJ" })
    if (result.status !== "needs_confirmation") throw new Error("Expected the changed street to require confirmation")
    expect(result.agent_say_line).toContain("is that correct")
    expect(result.agent_say_line).not.toContain("07094")
    expect(result.agent_say_line).not.toContain("USA")
  })

  it("fails closed in production when address verification has no provider key", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("EXAMPLE_LIMO_GOOGLE_MAPS_API_KEY", "")

    await expect(verifyExampleLimoAddress("105 Osprey Ct, Secaucus, NJ", "destination"))
      .resolves.toMatchObject({ ok: false, status: "unresolved", original_address: "105 Osprey Ct, Secaucus, NJ" })
  })
})
