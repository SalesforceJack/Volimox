import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { buildExampleLimoQuote } from "@/lib/example-limo/engine"
import { getOrCreateActiveQuote, readReusableActiveQuote } from "@/lib/example-limo/integrity-state"
import type { ExampleLimoQuoteRequest } from "@/lib/example-limo/types"
import { ExampleLimoValidationError } from "@/lib/example-limo/validation"
import { verifyExampleLimoVoiceSessionToken } from "@/lib/example-limo/voice-session"

export const runtime = "nodejs"

function sessionFor(request: Request, body: Record<string, unknown>) {
  const token = request.headers.get("x-example-limo-voice-session") || (typeof body.voiceSessionToken === "string" ? body.voiceSessionToken : "")
  return verifyExampleLimoVoiceSessionToken(token, "limo")
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const session = sessionFor(request, body)
    if (!session) return NextResponse.json({ ok: false, error: "A valid Example Limo voice session is required.", code: "voice_session_required" }, { status: 401 })
    const scopedBody = { ...body, tenant_id: session.tenantId } as ExampleLimoQuoteRequest
    const reusable = await readReusableActiveQuote(session.id, session.tenantId, scopedBody)
    if (reusable) return NextResponse.json({ ...reusable, activeQuoteReused: true })
    if (!(await checkDurableRateLimit(`example-limo-quote:${ip}`, 24, 60 * 60 * 1000, { failClosed: true }))) return NextResponse.json({ ok: false, error: "Example Limo quote limit reached. Please try again later." }, { status: 429 })
    if (!(await checkDurableRateLimit(`example-limo-session:${session.id}`, 12, 60 * 60 * 1000, { failClosed: true }))) return NextResponse.json({ ok: false, error: "This Example Limo voice session has reached its quote limit." }, { status: 429 })
    const { quote, reused } = await getOrCreateActiveQuote({
      sessionId: session.id,
      tenantId: session.tenantId,
      input: scopedBody,
      build: () => buildExampleLimoQuote(scopedBody),
    })
    return NextResponse.json({ ...quote, activeQuoteReused: reused })
  } catch (error) {
    if (error instanceof ExampleLimoValidationError) return NextResponse.json({ ok: false, error: error.message, code: error.code, details: error.details }, { status: 400 })
    console.error("[example-limo/quote]", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ ok: false, error: "Example Limo could not calculate this quote." }, { status: 502 })
  }
}
