"use client"

import { useEffect, useRef, useState } from "react"
import { GoogleGenAI } from "@google/genai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRight, Check, CheckCircle, MapPin, Microphone, Phone, Radio, SpinnerGap, Stop, UsersThree, WarningCircle } from "@phosphor-icons/react"
import { getMoxAgent, type MoxAgentId } from "@/lib/mox-agents"
import { trackDemoEvent } from "@/lib/client-analytics"

type Line = { role: "agent" | "user"; content: string }
type AgentState = "idle" | "connecting" | "live" | "error"
type ToolRunStatus = "running" | "completed" | "failed"
type ToolRun = { id: string; name: string; label: string; status: ToolRunStatus; detail: string }
type SessionSummary = { agentName: string; messageCount: number; tools: ToolRun[] }

function base64ToPcm(value: string) {
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
  const pcm = new Int16Array(bytes.buffer)
  return pcm
}

function pcmToBase64(input: Float32Array) {
  const pcm = new Int16Array(input.length)
  for (let index = 0; index < input.length; index += 1) pcm[index] = Math.max(-1, Math.min(1, input[index])) * 0x7fff
  const bytes = new Uint8Array(pcm.buffer)
  let binary = ""
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return btoa(binary)
}

const stageIcon = [Phone, MapPin, Radio, Check]

const toolLabels: Record<string, string> = {
  get_volimox_demo_quote: "Route and quote calculated",
  create_volimox_demo_link: "Continuation sent",
  capture_demo_contact: "Lead captured",
  start_requested_demo_call: "Callback started",
}

function toolDetail(name: string, value: unknown) {
  const result = value && typeof value === "object" ? value as Record<string, unknown> : {}
  if (name === "get_volimox_demo_quote") {
    const distance = Number(result.distanceMiles)
    const duration = Number(result.durationMinutes)
    const quote = Number(result.estimatedValueUsd)
    if (Number.isFinite(distance) && Number.isFinite(duration) && Number.isFinite(quote)) {
      return `${distance.toFixed(1)} miles, ${Math.round(duration)} minutes, $${quote.toFixed(2)}`
    }
  }
  if (name === "create_volimox_demo_link") return result.smsSent ? "SMS delivered to the approved number" : "Continuation link created"
  if (name === "capture_demo_contact") return "Contact and business need routed for follow-up"
  if (name === "start_requested_demo_call") return "Approved demonstration callback requested"
  return typeof result.message === "string" ? result.message : "Operation completed"
}

function friendlyVoiceError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value || "")
  if (/limit reached|quota|credits|prepayment/i.test(message)) return "Live voice is at capacity right now. Try again shortly or request a guided demo."
  if (/permission|notallowed|microphone|media devices/i.test(message)) return "Microphone access is required for the live demo. Allow access in your browser and try again."
  if (/timed out|network|connection|closed/i.test(message)) return "The live voice connection could not be established. Check your connection and try again."
  return "The live voice session could not start. Try again or request a guided demo."
}

export function ProtonLiveBooking({ agentId = "limo", compact = false }: { agentId?: MoxAgentId; compact?: boolean }) {
  const profile = getMoxAgent(agentId)
  const reducedMotion = useReducedMotion()
  const session = useRef<any>(null)
  const stream = useRef<MediaStream | null>(null)
  const inputContext = useRef<AudioContext | null>(null)
  const outputContext = useRef<AudioContext | null>(null)
  const processor = useRef<ScriptProcessorNode | null>(null)
  const nextPlayAt = useRef(0)
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectionOpened = useRef(false)
  const audioReceived = useRef(false)
  const intentionalClose = useRef(false)
  const transcriptDraft = useRef<{ user: string; agent: string }>({ user: "", agent: "" })
  const firstTranscriptTracked = useRef(false)
  const linesRef = useRef<Line[]>([])
  const toolRunsRef = useRef<ToolRun[]>([])
  const transcriptViewport = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<AgentState>("idle")
  const [talking, setTalking] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [toolRuns, setToolRuns] = useState<ToolRun[]>([])
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [active, setActive] = useState(0)
  const [error, setError] = useState("")

  const sessionGeneration = useRef(0)
  const connectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxMinutes = useRef(10)

  const cleanupResources = (preserveSummary = true, updateUi = true) => {
    sessionGeneration.current += 1
    if (updateUi && preserveSummary && (linesRef.current.length || toolRunsRef.current.length)) {
      setSummary({
        agentName: profile.name,
        messageCount: linesRef.current.length,
        tools: toolRunsRef.current.filter((item) => item.status === "completed"),
      })
    }
    if (sessionTimer.current) clearTimeout(sessionTimer.current)
    sessionTimer.current = null
    if (connectTimeout.current) clearTimeout(connectTimeout.current)
    connectTimeout.current = null
    processor.current?.disconnect()
    processor.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (session.current) {
      try { session.current.close() } catch { /* already closed */ }
      session.current = null
    }
    connectionOpened.current = false
    audioReceived.current = false
    if (inputContext.current?.state !== "closed") void inputContext.current?.close()
    inputContext.current = null
    if (outputContext.current?.state !== "closed") void outputContext.current?.close()
    outputContext.current = null
    nextPlayAt.current = 0
    linesRef.current = []
    toolRunsRef.current = []
    if (updateUi) {
      setLines([])
      setToolRuns([])
    }
    transcriptDraft.current = { user: "", agent: "" }
    if (updateUi) {
      setState("idle")
      setTalking(false)
    }
  }

  const stopSession = (preserveSummary = true, updateUi = true) => {
    intentionalClose.current = true
    cleanupResources(preserveSummary, updateUi)
  }

  const upsertTranscript = (role: Line["role"], content: string, final: boolean) => {
    if (!content.trim()) return
    if (!firstTranscriptTracked.current) {
      firstTranscriptTracked.current = true
      trackDemoEvent("voice_transcript_started", { agentId })
    }
    setLines((current) => {
      const next = [...current]
      const last = next[next.length - 1]
      if (last?.role === role) next[next.length - 1] = { role, content }
      else next.push({ role, content })
      const visible = next.slice(-8)
      linesRef.current = visible
      return visible
    })
    if (final) transcriptDraft.current[role] = ""
  }

  const playAudio = (encoded: string) => {
    const context = outputContext.current ?? new AudioContext({ sampleRate: 24000 })
    outputContext.current = context
    void context.resume()
    const pcm = base64ToPcm(encoded)
    const buffer = context.createBuffer(1, pcm.length, 24000)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < pcm.length; index += 1) channel[index] = pcm[index] / 0x7fff
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    const startAt = Math.max(context.currentTime, nextPlayAt.current)
    source.start(startAt)
    nextPlayAt.current = startAt + buffer.duration
  }

  const runTool = async (name: string, args: Record<string, unknown>) => {
    setActive((current) => Math.min(profile.stages.length - 1, current + 1))
    const id = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const running: ToolRun = { id, name, label: toolLabels[name] || "Business operation", status: "running", detail: "Working with the live demo data" }
    toolRunsRef.current = [...toolRunsRef.current, running].slice(-6)
    setToolRuns(toolRunsRef.current)
    try {
      const demoSessionToken = window.localStorage.getItem("volimox_demo_session_token") || undefined
      const response = await fetch("/api/mox-demo/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, tool: name, args, demoSessionToken }) })
      const payload = await response.json() as { ok?: boolean; result?: unknown; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The operation could not be completed.")
      toolRunsRef.current = toolRunsRef.current.map((item) => item.id === id ? { ...item, status: "completed", detail: toolDetail(name, payload.result) } : item)
      setToolRuns(toolRunsRef.current)
      trackDemoEvent("voice_tool_completed", { agentId, tool: name })
      return payload.result || { message: "Completed." }
    } catch (cause) {
      toolRunsRef.current = toolRunsRef.current.map((item) => item.id === id ? { ...item, status: "failed", detail: cause instanceof Error ? cause.message : "Operation failed" } : item)
      setToolRuns(toolRunsRef.current)
      throw cause
    }
  }

  const start = async () => {
    cleanupResources(false)
    sessionGeneration.current += 1
    const currentGeneration = sessionGeneration.current
    intentionalClose.current = false
    firstTranscriptTracked.current = false
    setState("connecting")
    setError("")
    setSummary(null)
    setLines([])
    linesRef.current = []
    setToolRuns([])
    toolRunsRef.current = []
    transcriptDraft.current = { user: "", agent: "" }
    setActive(0)
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      stream.current = microphone
      inputContext.current = new AudioContext({ sampleRate: 16000 })
      outputContext.current = new AudioContext({ sampleRate: 24000 })
      await inputContext.current.resume()
      await outputContext.current.resume()
      const tokenResponse = await fetch("/api/voice/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) })
      const payload = await tokenResponse.json() as { token?: string; model?: string; maxSessionMinutes?: number; error?: string }
      if (!tokenResponse.ok || !payload.token) throw new Error(payload.error || "Voice session could not start.")

      const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } })
      const connectionPromise = ai.live.connect({
        model: payload.model || "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            if (sessionGeneration.current !== currentGeneration) return
            if (connectTimeout.current) clearTimeout(connectTimeout.current)
            connectTimeout.current = null
            connectionOpened.current = true
            setState("live")
            trackDemoEvent("voice_demo_started", { agentId })
          },
          onmessage: async (message: any) => {
            if (sessionGeneration.current !== currentGeneration) return
            const content = message.serverContent
            if (content?.modelTurn?.parts) {
              const audioParts = content.modelTurn.parts.filter((part: any) => part.inlineData?.data)
              audioParts.forEach((part: any) => {
                audioReceived.current = true
                playAudio(part.inlineData.data)
              })
              if (audioParts.length) setTalking(true)
            }
            if (content?.inputTranscription?.text) {
              transcriptDraft.current.user += content.inputTranscription.text
              upsertTranscript("user", transcriptDraft.current.user, Boolean(content.turnComplete))
            }
            if (content?.outputTranscription?.text) {
              transcriptDraft.current.agent += content.outputTranscription.text
              upsertTranscript("agent", transcriptDraft.current.agent, Boolean(content.turnComplete))
              if (content.turnComplete) setTalking(false)
            }
            if (message.toolCall?.functionCalls) {
              const functionResponses = []
              for (const call of message.toolCall.functionCalls) {
                try {
                  const result = await runTool(call.name, call.args || {})
                  functionResponses.push({ name: call.name, id: call.id, response: { result } })
                } catch (toolError) {
                  functionResponses.push({ name: call.name, id: call.id, response: { error: toolError instanceof Error ? toolError.message : "Tool failed." } })
                }
              }
              if (sessionGeneration.current !== currentGeneration) return
              live.sendToolResponse({ functionResponses })
            }
          },
          onerror: (event: any) => {
            if (sessionGeneration.current !== currentGeneration) return
            cleanupResources(true)
            const detail = event?.message || event?.error?.message || "The voice connection was interrupted."
            setState("error")
            setError(friendlyVoiceError(detail))
          },
          onclose: (event: any) => {
            if (sessionGeneration.current !== currentGeneration) return
            if (intentionalClose.current) return
            const opened = connectionOpened.current
            const receivedAudio = audioReceived.current
            cleanupResources(true)
            if (!opened || !receivedAudio) {
              setState("error")
              const detail = event?.reason || (event?.code ? `close code ${event.code}` : "no close reason")
              setError(friendlyVoiceError(detail))
            } else {
              setState("idle")
            }
          },
        },
        })
      void connectionPromise.then((connected) => {
        if (sessionGeneration.current !== currentGeneration) connected.close()
      }).catch(() => undefined)

      const live = await Promise.race([
        connectionPromise,
        new Promise<never>((_, reject) => {
          connectTimeout.current = setTimeout(() => reject(new Error("Gemini Live connection timed out before audio started.")), 15000)
        }),
      ])
      if (sessionGeneration.current !== currentGeneration) {
        live.close()
        return
      }
      session.current = live
      maxMinutes.current = Math.max(1, Number(payload.maxSessionMinutes || 10))
      sessionTimer.current = setTimeout(() => {
        stopSession(true)
        setError(`This demonstration session ended after ${maxMinutes.current} minutes.`)
      }, maxMinutes.current * 60 * 1000)
      live.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Start the conversation by greeting me as the concierge." }] }], turnComplete: true })

      const source = inputContext.current.createMediaStreamSource(microphone)
      const node = inputContext.current.createScriptProcessor(4096, 1, 1)
      const silentGain = inputContext.current.createGain()
      silentGain.gain.value = 0
      node.onaudioprocess = (event) => {
        if (!session.current) return
        session.current.sendRealtimeInput({ audio: { data: pcmToBase64(event.inputBuffer.getChannelData(0)), mimeType: "audio/pcm;rate=16000" } })
      }
      source.connect(node)
      node.connect(silentGain)
      silentGain.connect(inputContext.current.destination)
      processor.current = node
    } catch (cause) {
      cleanupResources(false)
      setState("error")
      setError(friendlyVoiceError(cause))
    }
  }

  useEffect(() => {
    const viewport = transcriptViewport.current
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" })
  }, [lines, reducedMotion])

  useEffect(() => () => stopSession(false, false), [])

  const continueToContact = () => {
    trackDemoEvent("voice_demo_cta", { agentId, completedOperations: summary?.tools.length || 0 })
    window.dispatchEvent(new CustomEvent("volimox:demo-complete", {
      detail: {
        agentName: summary?.agentName || profile.name,
        completedOperations: summary?.tools.map((item) => item.label) || [],
      },
    }))
    document.getElementById("contact")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })
  }

  const visibleLines = lines.slice(-6)
  const voiceStatus = talking ? "Agent speaking" : state === "live" ? "Listening" : state === "connecting" ? "Connecting" : "Ready"

  return (
    <section id={compact ? undefined : "live-demo"} className={`${compact ? "" : "border-y border-line bg-ink py-24 text-white sm:py-32"} ${compact ? "text-white" : ""}`}>
      <div className={compact ? "" : "mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12"}>
        {!compact && (
          <div className="max-w-4xl">
            <p className="section-kicker text-signal">{profile.eyebrow}</p>
            <h2 className="mt-5 max-w-[10ch] text-[clamp(3rem,5.3vw,5.8rem)] font-semibold leading-[.93] tracking-[-.065em]">Let the agent do the work.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/55">Speak with {profile.name}. Watch the intake become a live operating workflow.</p>
          </div>
        )}

        <div className={`${compact ? "" : "mt-14"} grid border border-white/15 lg:grid-cols-[1.05fr_.95fr]`}>
          <div className="flex min-h-[420px] flex-col border-b border-white/15 p-5 sm:min-h-[500px] sm:p-8 lg:min-h-[560px] lg:border-b-0 lg:border-r lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-white/45">Live voice</span>
              <span className="flex items-center gap-2 text-xs text-white/45">
                <span className={`h-2 w-2 rounded-full transition-colors duration-200 ${state === "live" && talking ? "animate-pulse bg-signal" : state === "live" ? "bg-signal/35" : "bg-white/20"}`} />
                {voiceStatus}
              </span>
            </div>

            <div className={`mt-6 flex flex-1 flex-col justify-end ${visibleLines.length || talking ? "min-h-[280px]" : "min-h-[180px]"} sm:min-h-[300px] lg:min-h-[330px]`}>
              <AnimatePresence initial={false}>
                {(visibleLines.length > 0 || talking) && (
                  <motion.div
                    key="live-transcript"
                    initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
                    className="border-y border-white/10 py-2"
                  >
                    <div ref={transcriptViewport} className="live-transcript-scrollbar h-[260px] space-y-5 overflow-y-auto py-4 pr-2 sm:h-[300px]" role="log" aria-live="polite" aria-label="Live conversation transcript">
                      {visibleLines.map((line, index) => (
                        <motion.div
                          key={`${line.role}-${index}`}
                          initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                          className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`max-w-[88%] break-words ${line.role === "user" ? "border-r border-white/35 pr-4 text-right" : "border-l border-signal/75 pl-4"}`}>
                            <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-white/35">{line.role === "agent" ? profile.name : "You"}</span>
                            <p className="text-[15px] leading-6 text-white/88">{line.content}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div className="mt-5 flex items-start gap-3 border border-red-300/25 bg-red-300/[.06] p-4 text-sm text-red-100" role="alert">
                  <WarningCircle size={18} className="mt-0.5 shrink-0" />
                  <div><p>{error}</p><a href="#contact" className="mt-2 inline-block font-semibold text-white underline underline-offset-4">Request a guided demo</a></div>
                </div>
              )}
            </div>

            <button onClick={state === "live" ? () => stopSession(true) : start} disabled={state === "connecting"} className="mt-7 inline-flex h-14 w-full items-center justify-center gap-3 bg-signal px-5 font-semibold text-ink transition active:translate-y-px disabled:cursor-wait disabled:opacity-65">
              {state === "connecting" ? <SpinnerGap className="animate-spin" /> : state === "live" ? <Stop weight="fill" /> : <Microphone weight="fill" />}
              {state === "connecting" ? "Connecting..." : state === "live" ? "End conversation" : summary ? "Start another conversation" : `Talk to ${profile.name}`}
            </button>
          </div>

          <div className="flex min-h-[500px] flex-col p-5 sm:p-8 lg:min-h-[560px] lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-white/45">Live operations</span>
              <span className="text-xs text-white/40">{toolRuns.some((item) => item.status === "running") ? "Action running" : state === "live" ? "Watching" : "Standby"}</span>
            </div>

            {summary && state === "idle" ? (
              <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-1 flex-col">
                <CheckCircle size={32} weight="fill" className="text-signal" />
                <h3 className="mt-5 text-3xl font-semibold tracking-[-.045em]">The live run is complete.</h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/50">{summary.messageCount} transcript turns were processed by {summary.agentName}.</p>
                <div className="mt-8 border-t border-white/15">
                  {summary.tools.length ? summary.tools.map((item) => (
                    <div key={item.id} className="border-b border-white/15 py-4">
                      <div className="flex items-center gap-3"><Check size={15} weight="bold" className="text-signal" /><p className="text-sm font-semibold">{item.label}</p></div>
                      <p className="mt-1 pl-7 text-xs leading-5 text-white/40">{item.detail}</p>
                    </div>
                  )) : <p className="border-b border-white/15 py-4 text-sm text-white/45">No external action was requested during this conversation.</p>}
                </div>
                <button type="button" onClick={continueToContact} className="mt-auto inline-flex min-h-14 items-center justify-between bg-white px-5 py-4 text-sm font-semibold text-ink transition active:translate-y-px">
                  Build this for my business <ArrowRight size={16} weight="bold" />
                </button>
              </motion.div>
            ) : (
              <>
                <div className="mt-8 space-y-2">
                  {profile.stages.map((title, index) => {
                    const Icon = stageIcon[index] || UsersThree
                    const completed = index < active
                    const running = index === active && state === "live"
                    return (
                      <div key={title} className={`border p-4 transition-colors ${running ? "border-signal bg-signal/10" : completed ? "border-white/20 bg-white/[.03]" : "border-white/10"}`}>
                        <div className="flex items-center gap-4">
                          <span className={`flex h-9 w-9 items-center justify-center border ${running || completed ? "border-signal/70 text-signal" : "border-white/15 text-white/30"}`}><Icon size={16} /></span>
                          <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-white/35">{completed ? "Completed" : running ? "Running now" : "Waiting"}</p></div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <AnimatePresence initial={false}>
                  {toolRuns.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 border-t border-white/15 pt-5">
                      <p className="font-mono text-[9px] uppercase tracking-[.15em] text-white/35">Real tool activity</p>
                      <div className="mt-3 space-y-3">
                        {toolRuns.slice(-3).map((item) => (
                          <div key={item.id} className="flex items-start gap-3 text-xs">
                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${item.status === "completed" ? "bg-signal" : item.status === "failed" ? "bg-red-300" : "animate-pulse bg-white/50"}`} />
                            <div><p className="font-semibold text-white/80">{item.label}</p><p className="mt-1 leading-5 text-white/35">{item.detail}</p></div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
