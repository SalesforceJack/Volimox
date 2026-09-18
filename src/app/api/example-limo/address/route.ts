import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { verifyExampleLimoAddress } from "@/lib/example-limo/address-verification"
import { verifyExampleLimoVoiceSessionToken } from "@/lib/example-limo/voice-session"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const ip = getClientIp(request)
  if (!(await checkDurableRateLimit(`example-limo-address:${ip}`, 40, 60 * 60 * 1000, { failClosed: true }))) {
    return NextResponse.json({ ok: false, error: "Example Limo address checks are temporarily limited." }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const token = request.headers.get("x-example-limo-voice-session") || (typeof body.voiceSessionToken === "string" ? body.voiceSessionToken : "")
    const session = verifyExampleLimoVoiceSessionToken(token, "limo")
    if (!session) return NextResponse.json({ ok: false, error: "A valid Example Limo voice session is required." }, { status: 401 })
    const kind = body.kind === "destination" ? "destination" : "pickup"
    // Keep the provider's unresolved status and repair line so the model can keep the field in focus
    // instead of receiving a generic HTTP error.
    return NextResponse.json(await verifyExampleLimoAddress(body.address, kind))
  } catch (error) {
    console.error("[example-limo/address]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, status: "unresolved", original_address: "", agent_say_line: "Could you please repeat that address with the street number, city, and state?" })
  }
}
