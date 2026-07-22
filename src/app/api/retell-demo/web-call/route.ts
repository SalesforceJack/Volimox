import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { createSideEffectStore, executeSideEffect, deriveSideEffectId, ProviderRejectedError } from "@/lib/side-effect-machine"
import { demoDb, getSideEffectsCollection, isProductionFirebaseRequired } from "@/lib/firebase-admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const allowed = await checkDurableRateLimit(`retell-web-call:${ip}`, 3, 60 * 60 * 1000, { failClosed: true })
  if (!allowed) {
    return NextResponse.json({ error: "Voice demo limit reached. Please try again later." }, { status: 429 })
  }

  const apiKey = process.env.RETELL_API_KEY?.trim()
  const agentId = process.env.RETELL_DEMO_VOICE_AGENT_ID?.trim()
  if (!apiKey || !agentId) return NextResponse.json({ error: "Retell demo agent is not configured." }, { status: 503 })

  const effectId = deriveSideEffectId("retell-web-call", ip, String(Date.now()).slice(0, -4))
  const db = demoDb()
  if (!db && isProductionFirebaseRequired()) {
    return NextResponse.json({ error: "Voice demo persistence is unavailable." }, { status: 503 })
  }
  const collection = db ? getSideEffectsCollection(db) : null
  const store = createSideEffectStore(db, collection)

  const outcome = await executeSideEffect(
    store,
    effectId,
    "retell-web-call",
    async () => {
      const response = await fetch("https://api.retellai.com/v2/create-web-call", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, metadata: { source: "volimox-website", demo: true } }),
        cache: "no-store",
      })
      const data = await response.json().catch(() => null)
      if (!response.ok && response.status >= 400 && response.status < 500) {
        throw new ProviderRejectedError(`retell_${response.status}`)
      }
      if (!response.ok) throw new Error(data?.message || "Retell did not return a session.")
      return { value: data, providerId: data.call_id }
    },
    { completedState: "started" },
  )

  if (outcome.kind === "already_completed" || outcome.kind === "already_dispatching") {
    return NextResponse.json({ error: "Duplicate request." }, { status: 409 })
  }

  if (outcome.kind !== "executed") {
    return NextResponse.json({ error: "Voice demo could not start safely." }, { status: 503 })
  }

  return NextResponse.json(outcome.value || { error: "Retell did not return a session." }, { status: 200 })
}
