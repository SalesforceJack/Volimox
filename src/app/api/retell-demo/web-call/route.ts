import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  const apiKey = process.env.RETELL_API_KEY?.trim()
  const agentId = process.env.RETELL_DEMO_VOICE_AGENT_ID?.trim()
  if (!apiKey || !agentId) return NextResponse.json({ error: "Retell demo agent is not configured." }, { status: 503 })
  const response = await fetch("https://api.retellai.com/v2/create-web-call", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: agentId, metadata: { source: "volimox-website", demo: true } }),
    cache: "no-store",
  })
  const data = await response.json().catch(() => null)
  return NextResponse.json(data || { error: "Retell did not return a session." }, { status: response.status })
}
