import { GoogleGenAI, Modality } from "@google/genai"
import { NextResponse } from "next/server"
import { getClientIp } from "@/lib/demo-rate-limit"
import { checkDurableRateLimit } from "@/lib/durable-rate-limit"
import { getMoxAgent } from "@/lib/mox-agents"
import { buildExampleLimoWebVoiceInstruction } from "@/lib/example-limo/proton-web-voice-policy"
import { getDemoTenantId } from "@/lib/firebase-admin"
import { EXAMPLE_LIMO_PRICING_VERSION, getExampleLimoProviderMode, getExampleLimoTenantId } from "@/lib/example-limo/config"
import { createExampleLimoRunId, createExampleLimoVoiceRun, readExampleLimoInteraction } from "@/lib/example-limo/store"
import { createExampleLimoVoiceSessionToken, verifyExampleLimoVoiceSessionToken } from "@/lib/example-limo/voice-session"
import { createMoxDemoVoiceSessionToken } from "@/lib/mox-demo/voice-session"

export const runtime = "nodejs"

type VoiceTokenRequest = {
  agentId?: string
  fallback?: boolean
  avoidKeySlot?: number
  /** A resumable connection may reuse only the run asserted by a valid prior voice session token. */
  runId?: string
  resumeHandle?: string
  voiceSessionToken?: string
  demoVoiceSessionToken?: string
}

const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview"
const DEFAULT_FALLBACK_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
const DEFAULT_XAI_VOICE_MODEL = "grok-voice-think-fast-2.0"
const DEFAULT_XAI_VOICE_NAME = "carina"
const DEFAULT_XAI_VOICE_SPEED = 1.2

type VoiceProvider = "xai" | "gemini"

function errorText(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; status?: unknown; code?: unknown }
    return [value.message, value.status, value.code].filter(Boolean).join(" ")
  }
  return "unknown error"
}

function isCapacityError(error: unknown) {
  return /429|quota|resource[_ -]?exhausted|rate.?limit|too many|overload|capacity|temporarily unavailable|prepayment|credit/i.test(errorText(error))
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

async function createVoiceToken({
  apiKey,
  model,
  agent,
  maxSessionMinutes,
  resumeHandle,
}: {
  apiKey: string
  model: string
  agent: ReturnType<typeof getMoxAgent>
  maxSessionMinutes: number
  resumeHandle?: string
}) {
  const client = new GoogleGenAI({ apiKey })
  const now = new Date()
  const currentTimeNewYork = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "full",
    timeStyle: "long",
  }).format(now)
  return client.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + maxSessionMinutes * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: agent.id === "limo"
            ? buildExampleLimoWebVoiceInstruction(now)
            : `${agent.systemInstruction}\n\nCURRENT TIME\n- The current date/time in New York (America/New_York) is: ${currentTimeNewYork}\n- Resolve today, tomorrow, tonight, and weekdays from this exact value.`,
          tools: agent.tools,
          sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
    },
  })
}

async function createXaiVoiceToken(apiKey: string) {
  const response = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expires_after: { seconds: 300 } }),
    signal: AbortSignal.timeout(15000),
  })
  const payload = await response.json().catch(() => null) as { value?: unknown; expires_at?: unknown; error?: { message?: unknown } } | null
  if (!response.ok || typeof payload?.value !== "string" || !payload.value) {
    const providerMessage = typeof payload?.error?.message === "string" ? payload.error.message : ""
    throw new Error(providerMessage || `xAI realtime token request failed with status ${response.status}.`)
  }
  return { name: payload.value, expiresAt: payload.expires_at }
}

function configuredVoiceProvider(): VoiceProvider {
  const configured = process.env.VOICE_PROVIDER?.trim().toLowerCase()
  if (configured === "gemini") return "gemini"
  if (configured === "xai") return "xai"
  return process.env.XAI_API_KEY?.trim() ? "xai" : "gemini"
}

function providerOrder(fallback: boolean): VoiceProvider[] {
  const primary = configuredVoiceProvider()
  const secondary: VoiceProvider = primary === "xai" ? "gemini" : "xai"
  return fallback ? [secondary, primary] : [primary, secondary]
}

function xaiVoiceSpeed() {
  const configured = Number(process.env.XAI_VOICE_SPEED)
  return Number.isFinite(configured) && configured >= 0.7 && configured <= 1.5 ? configured : DEFAULT_XAI_VOICE_SPEED
}

function cleanRunId(value: unknown) {
  return typeof value === "string" && /^elv_[a-z0-9]{12,64}$/.test(value) ? value : ""
}

function cleanResumeHandle(value: unknown) {
  if (typeof value !== "string") return ""
  const handle = value.trim()
  return handle && handle.length <= 4096 ? handle : ""
}

export async function POST(request: Request) {
  const configuredLimit = Math.max(1, Number(process.env.VOICE_DEMO_MAX_SESSIONS_PER_IP_PER_HOUR || 3))
  const hostname = new URL(request.url).hostname
  const isLocalDemo = hostname === "localhost" || hostname === "127.0.0.1"
  const limit = isLocalDemo ? Math.max(configuredLimit, 50) : configuredLimit
  const ip = getClientIp(request)
  const durableAllowed = await checkDurableRateLimit(`voice:${ip}`, limit, 60 * 60 * 1000, { failClosed: !isLocalDemo })
  if (!durableAllowed) {
    return NextResponse.json({ error: "Voice demo limit reached. Please try again later." }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({})) as VoiceTokenRequest
    const agent = getMoxAgent(body.agentId)
    const existingVoiceSession = agent.id === "limo"
      ? verifyExampleLimoVoiceSessionToken(request.headers.get("x-example-limo-voice-session") || body.voiceSessionToken, agent.id)
      : null
    const requestedRunId = cleanRunId(body.runId)
    const resumeHandle = cleanResumeHandle(body.resumeHandle)
    if (agent.id === "limo" && (requestedRunId || resumeHandle) && (!existingVoiceSession || requestedRunId !== existingVoiceSession.runId)) {
      return NextResponse.json({ error: "A valid current Example Limo voice session is required to resume this run." }, { status: 401 })
    }
    const runId = agent.id === "limo" ? (existingVoiceSession?.runId || createExampleLimoRunId()) : ""
    const tenantId = existingVoiceSession?.tenantId || (agent.id === "limo" ? getExampleLimoTenantId() : getDemoTenantId())
    if (agent.id === "limo" && existingVoiceSession) {
      const existingRun = await readExampleLimoInteraction(runId, tenantId)
      if (!existingRun || existingRun.kind !== "voice_run") {
        return NextResponse.json({ error: "This Example Limo run is no longer available to resume." }, { status: 409 })
      }
    }
    const apiKeys = uniqueValues([
      process.env.GEMINI_API_KEY?.trim() || "",
      process.env.GEMINI_VOICE_API_KEY?.trim() || "",
    ])
    const xaiApiKey = process.env.XAI_API_KEY?.trim() || ""
    const xaiModel = process.env.XAI_VOICE_MODEL?.trim() || DEFAULT_XAI_VOICE_MODEL
    const xaiVoice = process.env.XAI_VOICE_NAME?.trim() || DEFAULT_XAI_VOICE_NAME
    const xaiSpeed = xaiVoiceSpeed()
    if (process.env.VOICE_PROVIDER?.trim().toLowerCase() === "xai" && !xaiApiKey) {
      return NextResponse.json({ error: "xAI voice is not configured yet." }, { status: 503 })
    }
    const primaryModel = process.env.GEMINI_LIVE_MODEL?.trim() || DEFAULT_LIVE_MODEL
    const fallbackModel = process.env.GEMINI_LIVE_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK_LIVE_MODEL
    const maxSessionMinutes = Math.max(1, Math.min(10, Number(process.env.VOICE_DEMO_MAX_SESSION_MINUTES || 10)))
    const keyEntries = apiKeys.map((apiKey, keySlot) => ({ apiKey, keySlot }))
    const avoidKeySlot = Number.isInteger(body.avoidKeySlot) ? body.avoidKeySlot : undefined
    const keys = avoidKeySlot === undefined
      ? (body.fallback ? [...keyEntries.slice(1), ...keyEntries.slice(0, 1)] : keyEntries)
      : [...keyEntries.filter((entry) => entry.keySlot !== avoidKeySlot), ...keyEntries.filter((entry) => entry.keySlot === avoidKeySlot)]
    let lastError: unknown = null

    for (const provider of providerOrder(Boolean(body.fallback))) {
      if (provider === "xai") {
        if (!xaiApiKey) {
          lastError = new Error("xAI voice is not configured yet.")
          continue
        }
        try {
          const token = await createXaiVoiceToken(xaiApiKey)
          const sessionExpiresAt = new Date(Date.now() + maxSessionMinutes * 60 * 1000).toISOString()
          if (agent.id === "limo" && !existingVoiceSession) {
            await createExampleLimoVoiceRun({
              id: runId,
              tenantId,
              metadata: {
                agentId: agent.id,
                model: xaiModel,
                provider: "xai_grok_live",
                providerMode: getExampleLimoProviderMode(),
                pricingVersion: EXAMPLE_LIMO_PRICING_VERSION,
                sessionExpiresAt,
              },
            })
          }
          return NextResponse.json({
            token: token.name,
            provider: "xai",
            model: xaiModel,
            voice: xaiVoice,
            speed: xaiSpeed,
            maxSessionMinutes,
            providerMode: getExampleLimoProviderMode(),
            runId: agent.id === "limo" ? runId : undefined,
            voiceSessionToken: agent.id === "limo" ? createExampleLimoVoiceSessionToken(agent.id, tenantId, 15 * 60, { runId, sessionId: existingVoiceSession?.id }) : undefined,
            demoVoiceSessionToken: agent.id !== "limo" ? createMoxDemoVoiceSessionToken(agent.id, tenantId) : undefined,
            agent: { id: agent.id, name: agent.name, greeting: agent.greeting, stages: agent.stages },
          })
        } catch (error) {
          lastError = error
          if (!isCapacityError(error)) throw error
          console.warn("[volimox/voice/token] xAI voice capacity; trying the next configured voice connection")
        }
        continue
      }

      const models = body.fallback ? uniqueValues([fallbackModel, primaryModel]) : uniqueValues([primaryModel, fallbackModel])
      for (const model of models) {
        for (const { apiKey, keySlot } of keys) {
          try {
            const token = await createVoiceToken({ apiKey, model, agent, maxSessionMinutes, resumeHandle: existingVoiceSession ? resumeHandle : undefined })
            const sessionExpiresAt = new Date(Date.now() + maxSessionMinutes * 60 * 1000).toISOString()
            if (agent.id === "limo" && !existingVoiceSession) {
              await createExampleLimoVoiceRun({
                id: runId,
                tenantId,
                metadata: {
                  agentId: agent.id,
                  model,
                  provider: "gemini_live",
                  providerMode: getExampleLimoProviderMode(),
                  pricingVersion: EXAMPLE_LIMO_PRICING_VERSION,
                  sessionExpiresAt,
                },
              })
            }
            return NextResponse.json({
              token: token.name,
              provider: "gemini",
              model,
              keySlot,
              maxSessionMinutes,
              providerMode: getExampleLimoProviderMode(),
              runId: agent.id === "limo" ? runId : undefined,
              voiceSessionToken: agent.id === "limo" ? createExampleLimoVoiceSessionToken(agent.id, tenantId, 15 * 60, { runId, sessionId: existingVoiceSession?.id }) : undefined,
              demoVoiceSessionToken: agent.id !== "limo" ? createMoxDemoVoiceSessionToken(agent.id, tenantId) : undefined,
              agent: { id: agent.id, name: agent.name, greeting: agent.greeting, stages: agent.stages },
            })
          } catch (error) {
            lastError = error
            if (!isCapacityError(error)) throw error
            console.warn(`[volimox/voice/token] capacity on ${model}; trying the next configured voice connection`)
          }
        }
      }
    }

    throw lastError || new Error("No voice connection was available.")
  } catch (error) {
    console.error("[volimox/voice/token]", errorText(error).slice(0, 300))
    return NextResponse.json({
      error: isCapacityError(error) ? "Live voice is temporarily at capacity. Please try again shortly." : "Voice session could not start.",
    }, { status: isCapacityError(error) ? 503 : 502 })
  }
}
