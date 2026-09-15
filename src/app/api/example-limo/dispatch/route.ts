import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { text, validatePhone } from "@/lib/example-limo/validation"
import { verifyExampleLimoVoiceSessionToken } from "@/lib/example-limo/voice-session"
import { getExampleLimoProviderMode, getExampleLimoTenantId } from "@/lib/example-limo/config"
import { readExampleLimoDispatchRequest, saveExampleLimoDispatchRequest } from "@/lib/example-limo/store"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const token = request.headers.get("x-example-limo-voice-session") || body.voiceSessionToken
    const session = verifyExampleLimoVoiceSessionToken(typeof token === "string" ? token : "", "limo")
    if (!session) return NextResponse.json({ ok: false, error: "A valid Example Limo voice session is required." }, { status: 401 })

    const ip = getClientIp(request)
    if (!(await checkDurableRateLimit(`example-limo-dispatch:${ip}`, 6, 60 * 60 * 1000, { failClosed: true }))) {
      return NextResponse.json({ ok: false, error: "Example Limo dispatch requests are temporarily limited. Please try again later." }, { status: 429 })
    }

    const phone = validatePhone(body.phone)
    const fullName = text(body.full_name, 120)
    const serviceSummary = text(body.service_summary, 1200)
    if (!serviceSummary) return NextResponse.json({ ok: false, error: "A short dispatch request summary is required." }, { status: 400 })

    const tenantId = getExampleLimoTenantId(session.tenantId)
    const id = `eld_${crypto.createHash("sha256").update(`${tenantId}:${session.runId}:${phone}:${serviceSummary}`).digest("hex").slice(0, 24)}`
    const existing = await readExampleLimoDispatchRequest(id, tenantId)
    if (!existing) {
      await saveExampleLimoDispatchRequest({
        id,
        tenantId,
        runId: session.runId,
        voiceSessionId: session.id,
        kind: "dispatch_callback_request",
        ...(fullName ? { fullName } : {}),
        phoneLastFour: phone.slice(-4),
        serviceSummary,
        providerMode: getExampleLimoProviderMode(),
        createdAt: new Date().toISOString(),
      })
    }

    // The client audit trail records this tool request against the voice run.
    // This endpoint deliberately creates no SMS, payment, or external dispatch side effect.
    return NextResponse.json({
      ok: true,
      duplicate: Boolean(existing),
      dispatchRequestId: id,
      dispatchContactCaptured: true,
      message: fullName
        ? `Thank you, ${fullName}. Your dispatch callback request has been captured.`
        : "Thank you. Your dispatch callback request has been captured.",
      phoneLastFour: phone.slice(-4),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Example Limo could not capture the dispatch request."
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
