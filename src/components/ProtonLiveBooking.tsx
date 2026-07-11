"use client"

import { useEffect, useRef, useState } from "react"
import { GoogleGenAI, Modality } from "@google/genai"
import { motion } from "motion/react"
import { Check, MapPin, Microphone, Phone, Radio, SpinnerGap, Stop, UsersThree } from "@phosphor-icons/react"
import { getMoxAgent, type MoxAgentId } from "@/lib/mox-agents"

type Line = { role: "agent" | "user"; content: string }
type AgentState = "idle" | "connecting" | "live" | "error"

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

export function ProtonLiveBooking({ agentId = "limo", compact = false }: { agentId?: MoxAgentId; compact?: boolean }) {
  const profile = getMoxAgent(agentId)
  const session = useRef<any>(null)
  const stream = useRef<MediaStream | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const processor = useRef<ScriptProcessorNode | null>(null)
  const nextPlayAt = useRef(0)
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptDraft = useRef<{ user: string; agent: string }>({ user: "", agent: "" })
  const [state, setState] = useState<AgentState>("idle")
  const [talking, setTalking] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState("")

  const stop = () => {
    if (sessionTimer.current) clearTimeout(sessionTimer.current)
    sessionTimer.current = null
    processor.current?.disconnect()
    processor.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    session.current?.close()
    session.current = null
    audioContext.current?.close()
    audioContext.current = null
    setState("idle")
    setTalking(false)
  }

  const upsertTranscript = (role: Line["role"], content: string, final: boolean) => {
    if (!content.trim()) return
    setLines((current) => {
      const next = [...current]
      const last = next[next.length - 1]
      if (last?.role === role) next[next.length - 1] = { role, content }
      else next.push({ role, content })
      return next.slice(-8)
    })
    if (final) transcriptDraft.current[role] = ""
  }

  const playAudio = (encoded: string) => {
    const context = audioContext.current
    if (!context) return
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
    const response = await fetch("/api/mox-demo/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, tool: name, args }) })
    const payload = await response.json() as { ok?: boolean; result?: unknown; error?: string }
    if (!response.ok || !payload.ok) throw new Error(payload.error || "The operation could not be completed.")
    return payload.result || { message: "Completed." }
  }

  const start = async () => {
    setState("connecting")
    setError("")
    setLines([])
    setActive(0)
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      stream.current = microphone
      audioContext.current = new AudioContext({ sampleRate: 16000 })
      await audioContext.current.resume()
      const tokenResponse = await fetch("/api/voice/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) })
      const payload = await tokenResponse.json() as { token?: string; model?: string; maxSessionMinutes?: number; error?: string }
      if (!tokenResponse.ok || !payload.token) throw new Error(payload.error || "Voice session could not start.")

      const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } })
      const live = await ai.live.connect({
        model: payload.model || "gemini-3.1-flash-live-preview",
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: () => {
            setState("live")
          },
          onmessage: async (message: any) => {
            const content = message.serverContent
            if (content?.modelTurn?.parts) {
              const audioParts = content.modelTurn.parts.filter((part: any) => part.inlineData?.data)
              audioParts.forEach((part: any) => playAudio(part.inlineData.data))
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
              live.sendToolResponse({ functionResponses })
            }
          },
          onerror: () => { setState("error"); setError("The voice connection was interrupted.") },
          onclose: () => { if (state !== "error") setState("idle") },
        },
      })
      session.current = live
      sessionTimer.current = setTimeout(() => {
        stop()
        setError("This demonstration session ended after 10 minutes.")
      }, Math.max(1, Number(payload.maxSessionMinutes || 10)) * 60 * 1000)
      live.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Start the conversation by greeting me as the concierge." }] }], turnComplete: true })

      const source = audioContext.current.createMediaStreamSource(microphone)
      const node = audioContext.current.createScriptProcessor(4096, 1, 1)
      node.onaudioprocess = (event) => {
        if (!session.current) return
        session.current.sendRealtimeInput({ audio: { data: pcmToBase64(event.inputBuffer.getChannelData(0)), mimeType: "audio/pcm;rate=16000" } })
      }
      source.connect(node)
      node.connect(audioContext.current.destination)
      processor.current = node
    } catch (cause) {
      stop()
      setState("error")
      setError(cause instanceof Error ? cause.message : "Voice session could not start.")
    }
  }

  useEffect(() => () => stop(), [])

  return <section id={compact ? undefined : "live-demo"} className={`${compact ? "" : "border-y border-line bg-ink py-24 text-white sm:py-32"} ${compact ? "text-white" : ""}`}>
    <div className={compact ? "" : "mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12"}>
      {!compact && <><p className="section-kicker text-signal">{profile.eyebrow}</p><div className="mt-5 grid gap-8 lg:grid-cols-2 lg:items-end"><h2 className="max-w-[10ch] text-[clamp(3rem,5.3vw,5.8rem)] font-semibold leading-[.93] tracking-[-.065em]">Let the agent do the work.</h2><p className="max-w-xl text-lg leading-8 text-white/55">Speak with {profile.name}. Watch the intake become a live operating workflow.</p></div></>}
      <div className={`${compact ? "" : "mt-14"} grid border border-white/15 lg:grid-cols-[1.05fr_.95fr]`}>
        <div className="min-h-[520px] border-b border-white/15 p-6 lg:border-b-0 lg:border-r lg:p-10"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-white/45">Gemini Live voice channel</span><span className={`h-2.5 w-2.5 rounded-full ${state === "live" ? "animate-pulse bg-signal" : "bg-white/20"}`} /></div><div className="mt-8 flex min-h-[310px] flex-col justify-end gap-3">{lines.length ? lines.map((line, index) => <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={`${index}-${line.content}`} className={`max-w-[86%] border p-4 text-sm leading-6 ${line.role === "agent" ? "border-signal/40 bg-signal/10" : "ml-auto border-white/15 bg-white/5"}`}><span className="mb-1 block font-mono text-[9px] uppercase tracking-[.16em] text-white/40">{line.role === "agent" ? profile.name : "You"}</span>{line.content}</motion.div>) : <p className="max-w-sm text-2xl font-medium tracking-[-.035em] text-white/65">Press talk. {profile.greeting}</p>}</div>{error && <p className="mb-4 text-sm text-red-300">{error}</p>}<button onClick={state === "live" ? stop : start} disabled={state === "connecting"} className="mt-7 inline-flex h-14 w-full items-center justify-center gap-3 bg-signal px-5 font-semibold text-ink disabled:cursor-wait">{state === "connecting" ? <SpinnerGap className="animate-spin" /> : state === "live" ? <Stop weight="fill" /> : <Microphone weight="fill" />}{state === "connecting" ? "Connecting..." : state === "live" ? "End conversation" : `Talk to ${profile.name}`}</button></div>
        <div className="p-6 lg:p-10"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[.18em] text-white/45">Live operations</span><span className="text-xs text-white/40">{talking ? "Agent speaking" : state === "live" ? "Listening" : "Standby"}</span></div><div className="mt-9 space-y-3">{profile.stages.map((title, index) => { const Icon = stageIcon[index] || UsersThree; return <div key={title} className={`border p-5 transition ${index === active && state === "live" ? "border-signal bg-signal/10" : index < active ? "border-white/20 bg-white/[.03]" : "border-white/10"}`}><div className="flex items-center gap-4"><span className={`flex h-10 w-10 items-center justify-center border ${index <= active && state === "live" ? "border-signal text-signal" : "border-white/15 text-white/35"}`}><Icon size={18} /></span><div><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-white/40">{index < active ? "Completed" : index === active && state === "live" ? "Running now" : "Waiting"}</p></div></div></div> })}</div><p className="mt-7 border-l-2 border-signal pl-4 text-sm leading-6 text-white/50">Every call is a demonstration session. Follow-up actions can use Twilio and email when configured.</p></div>
      </div>
    </div>
  </section>
}
