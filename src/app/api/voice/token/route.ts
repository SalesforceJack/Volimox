import { GoogleGenAI, Modality } from "@google/genai"
import { NextResponse } from "next/server"
import { getClientIp, withinDemoRateLimit } from "@/lib/demo-rate-limit"
import { getMoxAgent } from "@/lib/mox-agents"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!withinDemoRateLimit(`voice:${getClientIp(request)}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Voice demo limit reached. Please try again later." }, { status: 429 })
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: "Voice is not configured yet." }, { status: 503 })
  }

  try {
    const body = await request.json().catch(() => ({})) as { agentId?: string }
    const agent = getMoxAgent(body.agentId)
    const model = "gemini-3.1-flash-live-preview"
    const maxSessionMinutes = Math.max(1, Math.min(10, Number(process.env.VOICE_DEMO_MAX_SESSION_MINUTES || 10)))
    const client = new GoogleGenAI({ apiKey })
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + maxSessionMinutes * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: agent.systemInstruction,
            tools: agent.tools,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
      },
    })

    return NextResponse.json({ token: token.name, model, maxSessionMinutes, agent: { id: agent.id, name: agent.name, greeting: agent.greeting, stages: agent.stages } })
  } catch (error) {
    console.error("[volimox/voice/token]", error)
    return NextResponse.json({ error: "Voice session could not start." }, { status: 502 })
  }
}
