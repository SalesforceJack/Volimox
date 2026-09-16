"use client"

import { useEffect, useRef, useState } from "react"
import { GoogleGenAI } from "@google/genai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRight, Check, CheckCircle, MapPin, Microphone, Phone, Radio, SpinnerGap, Stop, UsersThree, WarningCircle } from "@phosphor-icons/react"
import { getMoxAgent, type MoxAgentId } from "@/lib/mox-agents"
import { buildExampleLimoWebVoiceInstruction } from "@/lib/example-limo/proton-web-voice-policy"
import {
  createLiveTranscriptDeduplicationState,
  resetLiveTranscriptDeduplicationState,
  shouldAcceptFinalTranscript,
  transcriptEventItemId,
} from "@/lib/live-transcript"
import { trackDemoEvent } from "@/lib/client-analytics"
import {
  answerAfterLatestQuestion,
  canonicalBookingFields,
  canonicalVehicleSelection,
  explicitCount,
  explicitPassengerAndLuggageCounts,
  explicitTripType,
  type ClientCheckoutSelection,
  type ClientQuoteState,
} from "@/lib/example-limo/client-state"
import { isExampleLimoFinalFarewell } from "@/lib/example-limo/voice-farewell"

type Line = { id: string; role: "agent" | "user"; content: string }
type TranscriptDraft = { text: string; lineId: string | null }
type TranscriptDrafts = Record<Line["role"], TranscriptDraft>
type AgentState = "idle" | "connecting" | "live" | "error"
type ToolRunStatus = "running" | "completed" | "failed"
type ToolRun = { id: string; name: string; label: string; status: ToolRunStatus; detail: string }
type SessionSummary = { agentName: string; messageCount: number; tools: ToolRun[]; runId?: string }
type ExpectedCloseReason = "user" | "timer" | "goaway" | "replace" | "farewell"
type ResumeRequest = { resumeHandle: string; runId: string; voiceSessionToken: string; keySlot?: number }

const INPUT_SAMPLE_RATE = 16000
const TRANSCRIPT_BOTTOM_THRESHOLD = 18

function transcriptMessageStyle(distanceFromLatest: number, historyMode: boolean) {
  if (historyMode || distanceFromLatest <= 0) return { opacity: 1, filter: "blur(0px)", y: 0, pointerEvents: "auto" as const }
  if (distanceFromLatest === 1) return { opacity: 0.75, filter: "blur(0px)", y: 0, pointerEvents: "auto" as const }
  if (distanceFromLatest === 2) return { opacity: 0.35, filter: "blur(0.35px)", y: 0, pointerEvents: "auto" as const }
  if (distanceFromLatest === 3) return { opacity: 0.12, filter: "blur(0.7px)", y: 0, pointerEvents: "auto" as const }
  return { opacity: 0, filter: "blur(1px)", y: 0, pointerEvents: "none" as const }
}

function auditSafeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]"
  if (value == null || typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "string") return value.slice(0, 2000)
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => auditSafeValue(item, depth + 1))
  if (typeof value !== "object") return String(value)
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !/token|secret|authorization|api.?key|password/i.test(key))
    .map(([key, item]) => [key, auditSafeValue(item, depth + 1)]))
}

function emptyTranscriptDrafts(): TranscriptDrafts {
  return {
    user: { text: "", lineId: null },
    agent: { text: "", lineId: null },
  }
}

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

function xaiFunctionTools(tools: unknown[]) {
  return tools.flatMap((tool) => {
    if (!tool || typeof tool !== "object") return []
    const declarations = (tool as { functionDeclarations?: unknown }).functionDeclarations
    if (!Array.isArray(declarations)) return []
    return declarations.flatMap((declaration) => {
      if (!declaration || typeof declaration !== "object") return []
      const value = declaration as { name?: unknown; description?: unknown; parametersJsonSchema?: unknown }
      if (typeof value.name !== "string" || !value.name) return []
      return [{
        type: "function",
        name: value.name,
        description: typeof value.description === "string" ? value.description : "",
        parameters: value.parametersJsonSchema || { type: "object", properties: {} },
      }]
    })
  })
}

function xaiEventTranscript(event: Record<string, unknown>) {
  for (const key of ["transcript", "text", "delta"]) {
    if (typeof event[key] === "string" && event[key]) return event[key] as string
  }
  return ""
}

function requestMicrophone() {
  return new Promise<MediaStream>((resolve, reject) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      reject(new Error("Microphone access is unavailable in this browser."))
      return
    }

    let settled = false
    const timeout = window.setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error("Microphone permission timed out before the live demo could start."))
    }, 10000)

    void navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }).then((nextStream) => {
      if (settled) {
        nextStream.getTracks().forEach((track) => track.stop())
        return
      }
      settled = true
      window.clearTimeout(timeout)
      resolve(nextStream)
    }).catch((cause) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      reject(cause)
    })
  })
}

const stageIcon = [Phone, MapPin, Radio, Check]

const toolLabels: Record<string, string> = {
  get_example_limo_quote: "Route and vehicle quotes calculated",
  send_example_limo_checkout_link: "Secure checkout prepared",
  request_example_limo_dispatch: "Dispatch callback request captured",
  get_volimox_demo_quote: "Route and quote calculated",
  create_volimox_demo_link: "Continuation sent",
  capture_demo_contact: "Lead captured",
  start_requested_demo_call: "Callback started",
  create_demo_reservation: "Demo reservation prepared",
}

function toolDetail(name: string, value: unknown) {
  const result = value && typeof value === "object" ? value as Record<string, unknown> : {}
  if (name === "get_example_limo_quote") {
    const options = result.quotes_by_vehicle && typeof result.quotes_by_vehicle === "object" ? Object.values(result.quotes_by_vehicle as Record<string, any>) : []
    const prices = options.map((item: any) => `${item.vehicleName || "Vehicle"} $${Number(item.quotedTotalUsd || item.totalPrice || 0).toFixed(2)}`)
    if (prices.length) return prices.join(" · ")
  }
  if (name === "get_volimox_demo_quote") {
    const distance = Number(result.distanceMiles)
    const duration = Number(result.durationMinutes)
    const quote = Number(result.estimatedValueUsd)
    if (Number.isFinite(distance) && Number.isFinite(duration) && Number.isFinite(quote)) return `${distance.toFixed(1)} miles, ${Math.round(duration)} minutes, $${quote.toFixed(2)}`
  }
  if (name === "send_example_limo_checkout_link") {
    if (result.action === "vehicle_selected") return "Selected vehicle price is ready for approval"
    return result.checkoutUrl ? "Secure checkout button is ready" : (result.reviewRequired ? "Human review required before payment" : "Checkout prepared")
  }
  if (name === "request_example_limo_dispatch") return result.dispatchContactCaptured ? "Dispatch callback number captured" : "Dispatch request prepared"
  if (name === "create_volimox_demo_link") return result.smsSent ? "SMS delivered to the approved number" : "Continuation link created"
  if (name === "capture_demo_contact") return "Contact and business need routed for follow-up"
  if (name === "start_requested_demo_call") return "Approved demonstration callback requested"
  if (name === "create_demo_reservation") {
    const reservationId = typeof result.reservationId === "string" ? result.reservationId : ""
    const smsStatus = result.sms && typeof result.sms === "object" ? (result.sms as Record<string, unknown>).status : ""
    const emailStatus = result.email && typeof result.email === "object" ? (result.email as Record<string, unknown>).status : ""
    const channels = [smsStatus ? `SMS ${String(smsStatus).replace(/_/g, " ")}` : "", emailStatus ? `email ${String(emailStatus).replace(/_/g, " ")}` : ""].filter(Boolean)
    return [reservationId ? `Demo ${reservationId}` : "Demo reservation", channels.join(", ")].filter(Boolean).join(" · ")
  }
  return typeof result.message === "string" ? result.message : "Operation completed"
}

export function mergeTranscriptFragment(existing: string, fragment: string) {
  if (!fragment) return existing
  if (!existing) return fragment
  if (fragment.startsWith(existing) || existing.endsWith(fragment)) return fragment.startsWith(existing) ? fragment : existing

  // Input transcription can revise an earlier partial phrase instead of
  // extending it. Prefer the later revision when most meaningful words match;
  // otherwise keep treating it as the next fragment of the same utterance.
  const words = (value: string): string[] => value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []
  const existingWords = words(existing)
  const fragmentWords = words(fragment)
  const commonWords = fragmentWords.filter((word) => existingWords.includes(word)).length
  const smallestWordCount = Math.min(existingWords.length, fragmentWords.length)
  if (smallestWordCount >= 2 && commonWords / smallestWordCount >= 0.66 && fragment.length >= existing.length * 0.7) return fragment

  const maxOverlap = Math.min(existing.length, fragment.length)
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (existing.endsWith(fragment.slice(0, overlap))) return existing + fragment.slice(overlap)
  }
  const needsBoundarySpace = !/\s$/.test(existing)
    && !/^\s/.test(fragment)
    && /[\p{L}\p{N},.!?:;]$/u.test(existing)
    && /^[\p{L}\p{N}]/u.test(fragment)
  return existing + (needsBoundarySpace ? " " : "") + fragment
}

function voiceErrorText(value: unknown, depth = 0): string {
  if (depth > 2 || value == null) return ""
  if (value instanceof Error) return value.message
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (typeof value !== "object") return ""

  const detail = value as Record<string, unknown>
  const parts = [
    detail.message,
    detail.reason,
    detail.status,
    detail.statusText,
    detail.code,
    detail.type,
    detail.error,
    detail.data,
  ].map((item) => voiceErrorText(item, depth + 1)).filter(Boolean)
  if (parts.length) return parts.join(" ")

  try {
    return JSON.stringify(value)
  } catch {
    return ""
  }
}

function isVoiceCapacityError(value: unknown) {
  return /limit reached|quota|resource[_ -]?exhausted|rate.?limit|429|too many|overload|capacity|temporarily unavailable|prepayment|credit/i.test(voiceErrorText(value))
}

function friendlyVoiceError(value: unknown, fallbackAttempted = false) {
  const message = voiceErrorText(value)
  if (isVoiceCapacityError(message)) {
    return fallbackAttempted
      ? "Both live voice connections are temporarily at capacity. Try again shortly or request a guided demo."
      : "Live voice is at capacity right now. We are switching to the backup connection."
  }
  if (/permission|notallowed|microphone|media devices/i.test(message)) return "Microphone access is required for the live demo. Allow access in your browser and try again."
  if (/not configured/i.test(message)) return message
  if (/timed out|network|connection|closed|close code|no close reason|websocket/i.test(message)) return "The live voice connection could not be established. Check your connection and try again."
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
  const transcriptDraft = useRef<TranscriptDrafts>(emptyTranscriptDrafts())
  const firstTranscriptTracked = useRef(false)
  const linesRef = useRef<Line[]>([])
  const transcriptHistoryRef = useRef<Line[]>([])
  const finalizedTranscriptLines = useRef(new Set<string>())
  const transcriptDeduplication = useRef(createLiveTranscriptDeduplicationState())
  const toolRunsRef = useRef<ToolRun[]>([])
  const transcriptViewport = useRef<HTMLDivElement | null>(null)
  const transcriptFollowTail = useRef(true)
  const transcriptHistoryModeRef = useRef(false)
  const [state, setState] = useState<AgentState>("idle")
  const [talking, setTalking] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [transcriptHistoryMode, setTranscriptHistoryMode] = useState(false)
  const [unreadTranscriptCount, setUnreadTranscriptCount] = useState(0)
  const [toolRuns, setToolRuns] = useState<ToolRun[]>([])
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState("")
  const [runId, setRunId] = useState("")
  const [active, setActive] = useState(0)
  const [error, setError] = useState("")

  const sessionGeneration = useRef(0)
  const connectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxMinutes = useRef(10)
  const fallbackAttempted = useRef(false)
  const voiceSessionToken = useRef("")
  const demoVoiceSessionToken = useRef("")
  const runIdRef = useRef("")
  const auditSequence = useRef(0)
  const auditQueue = useRef<Promise<void>>(Promise.resolve())
  const resumeHandleRef = useRef("")
  const resumeInFlight = useRef(false)
  const expectedCloseReason = useRef<ExpectedCloseReason | null>(null)
  const farewellCloseScheduled = useRef(false)
  const sessionDeadlineAt = useRef(0)
  const latestQuote = useRef<ClientQuoteState | null>(null)
  const checkoutSelection = useRef<ClientCheckoutSelection | null>(null)

  const emitAuditEvent = (eventType: string, payload?: Record<string, unknown>) => {
    if (!runIdRef.current || !voiceSessionToken.current) return
    const sequence = auditSequence.current + 1
    auditSequence.current = sequence
    const eventId = `evt_${runIdRef.current.slice(4)}_${sequence}`
    const eventRunId = runIdRef.current
    const eventToken = voiceSessionToken.current
    const eventBody = JSON.stringify({
      runId: eventRunId,
      eventId,
      sequence,
      eventType,
      occurredAt: new Date().toISOString(),
      payload: auditSafeValue(payload || {}),
    })
    auditQueue.current = auditQueue.current.then(async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch("/api/example-limo/run-event", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-example-limo-voice-session": eventToken },
            body: eventBody,
          })
          if (response.ok || response.status < 500) return
        } catch { /* keep the audit path non-fatal and retry the same event */ }
        await new Promise((resolve) => window.setTimeout(resolve, 150 * (attempt + 1)))
      }
    }, () => undefined)
  }

  const stopInputCapture = () => {
    if (processor.current) {
      processor.current.onaudioprocess = null
      processor.current.disconnect()
    }
    processor.current = null
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    if (inputContext.current?.state !== "closed") void inputContext.current?.close()
    inputContext.current = null
  }

  const cleanupResources = (preserveSummary = true, updateUi = true, preserveConversation = false) => {
    sessionGeneration.current += 1
    if (updateUi && preserveSummary && (linesRef.current.length || toolRunsRef.current.length)) {
      setSummary({
        agentName: profile.name,
        messageCount: linesRef.current.length,
        tools: toolRunsRef.current.filter((item) => item.status === "completed"),
        runId: runIdRef.current || undefined,
      })
    }
    if (sessionTimer.current) clearTimeout(sessionTimer.current)
    sessionTimer.current = null
    if (connectTimeout.current) clearTimeout(connectTimeout.current)
    connectTimeout.current = null
    stopInputCapture()
    if (session.current) {
      try { session.current.close() } catch { /* already closed */ }
      session.current = null
    }
    connectionOpened.current = false
    audioReceived.current = false
    if (outputContext.current?.state !== "closed") void outputContext.current?.close()
    outputContext.current = null
    nextPlayAt.current = 0
    if (!preserveConversation) {
      linesRef.current = []
      transcriptHistoryRef.current = []
      finalizedTranscriptLines.current.clear()
      resetLiveTranscriptDeduplicationState(transcriptDeduplication.current)
      toolRunsRef.current = []
      transcriptDraft.current = emptyTranscriptDrafts()
      latestQuote.current = null
      checkoutSelection.current = null
      voiceSessionToken.current = ""
      demoVoiceSessionToken.current = ""
      runIdRef.current = ""
      resumeHandleRef.current = ""
      auditSequence.current = 0
      auditQueue.current = Promise.resolve()
      sessionDeadlineAt.current = 0
      farewellCloseScheduled.current = false
      if (updateUi) {
        transcriptFollowTail.current = true
        transcriptHistoryModeRef.current = false
        setTranscriptHistoryMode(false)
        setUnreadTranscriptCount(0)
        setLines([])
        setToolRuns([])
        setRunId("")
      }
      if (updateUi && !preserveSummary) setCheckoutUrl("")
    }
    if (updateUi) {
      setState("idle")
      setTalking(false)
    }
  }

  const stopSession = (preserveSummary = true, updateUi = true, reason: ExpectedCloseReason = "user") => {
    intentionalClose.current = true
    expectedCloseReason.current = reason
    commitTranscriptTurn()
    emitAuditEvent("lifecycle_closed", { reason })
    cleanupResources(preserveSummary, updateUi)
  }

  const upsertTranscript = (role: Line["role"], content: string) => {
    if (!content.trim()) return
    if (!firstTranscriptTracked.current) {
      firstTranscriptTracked.current = true
      trackDemoEvent("voice_transcript_started", { agentId })
    }
    const draft = transcriptDraft.current[role]
    const lineId = draft.lineId ?? `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    draft.lineId = lineId
    const next = [...transcriptHistoryRef.current]
    const lineIndex = next.findIndex((line) => line.id === lineId)
    if (lineIndex >= 0) next[lineIndex] = { id: lineId, role, content }
    else next.push({ id: lineId, role, content })
    // Update the refs synchronously so tool calls and the next transcription
    // event always see the complete conversation, even when React batches UI
    // updates from several Live websocket messages.
    transcriptHistoryRef.current = next
    linesRef.current = next
    setLines(next)
    if (lineIndex < 0 && transcriptHistoryModeRef.current) setUnreadTranscriptCount((current) => current + 1)
  }

  const finishTranscript = (role: Line["role"]) => {
    const draft = transcriptDraft.current[role]
    const finalText = draft.text.trim()
    if (draft.lineId && finalText && !finalizedTranscriptLines.current.has(draft.lineId)) {
      finalizedTranscriptLines.current.add(draft.lineId)
      emitAuditEvent("transcript_final", { transcript: { role: role === "user" ? "customer" : "agent", text: finalText, final: true } })
    }
    if (role === "agent" && isExampleLimoFinalFarewell(finalText) && !farewellCloseScheduled.current) {
      farewellCloseScheduled.current = true
      // Stop accepting new customer audio immediately. Keep the Live session
      // and output context open only long enough to finish Diane's farewell.
      stopInputCapture()
      const remainingAudioMs = Math.max(300, ((nextPlayAt.current - (outputContext.current?.currentTime || 0)) * 1000) + 180)
      window.setTimeout(() => {
        if (!farewellCloseScheduled.current || !session.current) return
        stopSession(true, true, "farewell")
      }, remainingAudioMs)
    }
    transcriptDraft.current[role] = { text: "", lineId: null }
  }

  const commitTranscriptTurn = () => {
    const userText = transcriptDraft.current.user.text.trim()
    const agentText = transcriptDraft.current.agent.text.trim()
    if (userText) upsertTranscript("user", userText)
    if (agentText) upsertTranscript("agent", agentText)
    for (const role of ["user", "agent"] as const) {
      const draft = transcriptDraft.current[role]
      if (!draft.lineId || !draft.text.trim() || finalizedTranscriptLines.current.has(draft.lineId)) continue
      finalizedTranscriptLines.current.add(draft.lineId)
      emitAuditEvent("transcript_final", { transcript: { role: role === "user" ? "customer" : "agent", text: draft.text.trim(), final: true } })
    }
    transcriptDraft.current = emptyTranscriptDrafts()
  }

  const latestFinalUserTurn = () => {
    for (let index = transcriptHistoryRef.current.length - 1; index >= 0; index -= 1) {
      const line = transcriptHistoryRef.current[index]
      if (line.role === "user" && finalizedTranscriptLines.current.has(line.id)) return line.content.trim()
    }
    return ""
  }

  const latestFinalAgentTurn = () => {
    for (let index = transcriptHistoryRef.current.length - 1; index >= 0; index -= 1) {
      const line = transcriptHistoryRef.current[index]
      if (line.role === "agent" && finalizedTranscriptLines.current.has(line.id)) return line.content.trim()
    }
    return ""
  }

  const currentConversationTranscript = () => {
    const entries = [...transcriptHistoryRef.current]
    for (const role of ["user", "agent"] as const) {
      const draft = transcriptDraft.current[role]
      if (!draft.text.trim()) continue
      const lineIndex = draft.lineId ? entries.findIndex((line) => line.id === draft.lineId) : -1
      const line = { id: draft.lineId || `${role}-draft`, role, content: draft.text.trim() } satisfies Line
      if (lineIndex >= 0) entries[lineIndex] = line
      else entries.push(line)
    }
    return entries.map((line) => `${line.role === "user" ? "Customer" : "Diane"}: ${line.content}`).join("\n")
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
    const label = name === "send_example_limo_checkout_link" && args.action === "select_vehicle"
      ? "Vehicle selection verified"
      : toolLabels[name] || "Business operation"
    const running: ToolRun = { id, name, label, status: "running", detail: "Working with the live demo data" }
    toolRunsRef.current = [...toolRunsRef.current, running].slice(-6)
    setToolRuns(toolRunsRef.current)
    try {
      const demoSessionToken = window.localStorage.getItem("volimox_demo_session_token") || undefined
      const isExampleLimoQuote = agentId === "limo" && name === "get_example_limo_quote"
      const isExampleLimoCheckout = agentId === "limo" && name === "send_example_limo_checkout_link"
      const isExampleLimoDispatch = agentId === "limo" && name === "request_example_limo_dispatch"
      const isVerticalReservation = agentId !== "limo" && name === "create_demo_reservation"
      const nextArgs = { ...args }
      if (isVerticalReservation) {
        nextArgs.last_customer_utterance = latestFinalUserTurn()
        nextArgs.last_agent_utterance = latestFinalAgentTurn()
      }
      if (isExampleLimoQuote) {
        const tripAnswer = answerAfterLatestQuestion(transcriptHistoryRef.current, "trip_type")
        if (tripAnswer !== null) {
          const tripType = explicitTripType(tripAnswer)
          if (!tripType) throw new Error('I could not verify that answer. Ask exactly: "Is this one-way or round trip?"')
          nextArgs.trip_type = tripType
        }

        const passengerAnswer = answerAfterLatestQuestion(transcriptHistoryRef.current, "passenger_count")
        const luggageAnswer = answerAfterLatestQuestion(transcriptHistoryRef.current, "luggage_count")
        const combinedAnswer = passengerAnswer || luggageAnswer
        const combinedCounts = explicitPassengerAndLuggageCounts(combinedAnswer)
        if (combinedCounts.passengerCount !== null) nextArgs.passenger_count = combinedCounts.passengerCount
        else if (passengerAnswer !== null) {
          const passengerCount = explicitCount(passengerAnswer, 1, 6)
          if (passengerCount === null) throw new Error('I could not verify the passenger count. Ask exactly: "How many passengers are riding?"')
          nextArgs.passenger_count = passengerCount
        }
        if (combinedCounts.luggageCount !== null) nextArgs.luggage_count = combinedCounts.luggageCount
        else if (luggageAnswer !== null) {
          const luggageCount = explicitCount(luggageAnswer, 0, 14)
          if (luggageCount === null) throw new Error('I could not verify the luggage count. Ask exactly: "How many bags will you have?"')
          nextArgs.luggage_count = luggageCount
        }
      }
      if (isExampleLimoCheckout) {
        const finalUserTurn = latestFinalUserTurn()
        const quote = latestQuote.current
        if (!quote) throw new Error("The current quote is unavailable. Please request the quote again.")
        if (nextArgs.action === "select_vehicle") {
          checkoutSelection.current = null
          const selected = canonicalVehicleSelection(quote, finalUserTurn)
          Object.assign(nextArgs, canonicalBookingFields(quote), {
            vehicle_name: selected.vehicleName,
            quote_id: selected.quoteId,
            quote_fingerprint: selected.vehicleQuote.quoteFingerprint,
            quoted_total_usd: selected.vehicleQuote.quotedTotalUsd,
            quote_issued_at: selected.vehicleQuote.quoteIssuedAt,
            selection_utterance: finalUserTurn,
          })
        } else if (nextArgs.action === "create_checkout") {
          const selected = checkoutSelection.current
          if (!selected) throw new Error("The vehicle selection has not been verified. Ask the customer to choose Sedan or SUV.")
          Object.assign(nextArgs, canonicalBookingFields(quote), {
            vehicle_name: selected.vehicleName,
            quote_id: selected.quoteId,
            quote_fingerprint: selected.quoteFingerprint,
            quoted_total_usd: selected.quotedTotalUsd,
            quote_issued_at: selected.quoteIssuedAt,
            approval_intent_token: selected.approvalIntentToken,
            approval: "yes",
            last_customer_utterance: finalUserTurn,
          })
        } else {
          throw new Error("Choose the vehicle-selection or checkout action first.")
        }
        nextArgs.conversation_transcript = currentConversationTranscript()
      }
      emitAuditEvent("tool_requested", { tool: { toolName: name, status: "running", args: nextArgs } })
      const endpoint = isExampleLimoQuote
        ? "/api/example-limo/quote"
        : isExampleLimoCheckout
          ? "/api/example-limo/checkout-link"
          : isExampleLimoDispatch
          ? "/api/example-limo/dispatch"
            : isVerticalReservation
              ? "/api/mox-demo/reservation"
            : "/api/mox-demo/action"
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (agentId === "limo" && voiceSessionToken.current) headers["x-example-limo-voice-session"] = voiceSessionToken.current
      if (isVerticalReservation && demoVoiceSessionToken.current) headers["x-volimox-demo-voice-session"] = demoVoiceSessionToken.current
      const body = isExampleLimoQuote || isExampleLimoCheckout || isExampleLimoDispatch
        ? { ...nextArgs, voiceSessionToken: voiceSessionToken.current || undefined }
        : isVerticalReservation
          ? { agentId, args: nextArgs }
          : { agentId, tool: name, args: nextArgs, demoSessionToken }
      let response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) })
      let payload = await response.json() as { ok?: boolean; result?: unknown; error?: string; code?: string; action?: string; agent_say_price?: string }
      if (
        (!response.ok || !payload.ok)
        && isExampleLimoCheckout
        && nextArgs.action === "select_vehicle"
        && ["selected_quote_not_found", "quote_not_active_for_session"].includes(payload.code || "")
      ) {
        const staleQuote = latestQuote.current!
        const staleSelection = canonicalVehicleSelection(staleQuote, latestFinalUserTurn())
        const refreshResponse = await fetch("/api/example-limo/quote", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...canonicalBookingFields(staleQuote), voiceSessionToken: voiceSessionToken.current || undefined }),
        })
        const refreshedQuote = await refreshResponse.json() as ClientQuoteState & { ok?: boolean; error?: string }
        if (!refreshResponse.ok || !refreshedQuote.ok) throw new Error(refreshedQuote.error || "The current quote could not be refreshed.")
        latestQuote.current = refreshedQuote
        checkoutSelection.current = null
        const refreshedSelection = canonicalVehicleSelection(refreshedQuote, latestFinalUserTurn())
        if (Math.abs(refreshedSelection.vehicleQuote.quotedTotalUsd - staleSelection.vehicleQuote.quotedTotalUsd) > 0.03) {
          payload = {
            ok: true,
            action: "quote_refreshed",
            agent_say_price: (refreshedQuote as ClientQuoteState & { agent_say_price?: string }).agent_say_price || "The fare changed. Please read the refreshed vehicle options and ask the customer to choose again.",
          }
          response = new Response(null, { status: 200 })
        } else {
          Object.assign(nextArgs, canonicalBookingFields(refreshedQuote), {
            vehicle_name: refreshedSelection.vehicleName,
            quote_id: refreshedSelection.quoteId,
            quote_fingerprint: refreshedSelection.vehicleQuote.quoteFingerprint,
            quoted_total_usd: refreshedSelection.vehicleQuote.quotedTotalUsd,
            quote_issued_at: refreshedSelection.vehicleQuote.quoteIssuedAt,
            selection_utterance: latestFinalUserTurn(),
          })
          response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ ...nextArgs, voiceSessionToken: voiceSessionToken.current || undefined }) })
          payload = await response.json() as typeof payload
        }
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The operation could not be completed.")
      const resultValue = isExampleLimoQuote || isExampleLimoCheckout || isExampleLimoDispatch ? payload : payload.result
      if (isExampleLimoQuote) {
        latestQuote.current = resultValue as ClientQuoteState
        checkoutSelection.current = null
      }
      if (isExampleLimoCheckout && nextArgs.action === "select_vehicle" && payload.action !== "quote_refreshed") {
        const selectedVehicle = (payload as any).selectedVehicle
        const selectedQuote = latestQuote.current?.quotes_by_vehicle?.[selectedVehicle as "Luxury Sedan" | "Large SUV"]
        const approvalIntentToken = (payload as any).approval_intent_token
        if (!selectedQuote || typeof approvalIntentToken !== "string" || !approvalIntentToken) {
          throw new Error("The verified vehicle selection response was incomplete. Please choose the vehicle again.")
        }
        checkoutSelection.current = {
          ...selectedQuote,
          quoteId: latestQuote.current!.quoteId,
          approvalIntentToken,
        }
      }
      const responseForModel = isExampleLimoCheckout && nextArgs.action === "select_vehicle"
        ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "approval_intent_token"))
        : resultValue
      if (isExampleLimoCheckout && typeof (payload as any).checkoutUrl === "string") setCheckoutUrl((payload as any).checkoutUrl)
      toolRunsRef.current = toolRunsRef.current.map((item) => item.id === id ? { ...item, status: "completed", detail: toolDetail(name, resultValue) } : item)
      setToolRuns(toolRunsRef.current)
      emitAuditEvent("tool_completed", { tool: { toolName: name, status: "completed", data: resultValue } })
      trackDemoEvent("voice_tool_completed", { agentId, tool: name })
      return responseForModel || { message: "Completed." }
    } catch (cause) {
      toolRunsRef.current = toolRunsRef.current.map((item) => item.id === id ? { ...item, status: "failed", detail: cause instanceof Error ? cause.message : "Operation failed" } : item)
      setToolRuns(toolRunsRef.current)
      emitAuditEvent("tool_failed", { tool: { toolName: name, status: "failed", detail: cause instanceof Error ? cause.message : "Operation failed" } })
      throw cause
    }
  }

  const start = async (retryFallback = false, avoidKeySlot?: number, resumeRequest?: ResumeRequest) => {
    const isResume = Boolean(resumeRequest?.resumeHandle)
    if (!retryFallback && !isResume) fallbackAttempted.current = false
    expectedCloseReason.current = isResume ? "replace" : null
    cleanupResources(false, !isResume, isResume)
    sessionGeneration.current += 1
    const currentGeneration = sessionGeneration.current
    intentionalClose.current = false
    expectedCloseReason.current = null
    if (!isResume) firstTranscriptTracked.current = false
    setState("connecting")
    setError("")
    if (!isResume) {
      setSummary(null)
      setLines([])
      linesRef.current = []
      setToolRuns([])
      toolRunsRef.current = []
      transcriptDraft.current = emptyTranscriptDrafts()
      transcriptHistoryRef.current = []
      finalizedTranscriptLines.current.clear()
      resetLiveTranscriptDeduplicationState(transcriptDeduplication.current)
      latestQuote.current = null
      checkoutSelection.current = null
      setCheckoutUrl("")
      setActive(0)
    } else {
      resumeInFlight.current = true
      emitAuditEvent("lifecycle_resume_started")
    }
    let connectionAttempted = false
    let selectedKeySlot: number | undefined
    const retryOnConnectionFailure = (detail: unknown, receivedAudio = false) => {
      const canRetry = !retryFallback
        && !isResume
        && !fallbackAttempted.current
        && connectionAttempted
        && !receivedAudio
        && sessionGeneration.current === currentGeneration
      if (!canRetry) return false
      fallbackAttempted.current = true
      intentionalClose.current = true
      console.warn("[volimox/live] primary connection failed; trying fallback", voiceErrorText(detail).slice(0, 180))
      cleanupResources(false)
      void start(true, selectedKeySlot)
      return true
    }
    try {
      const microphone = await requestMicrophone()
      stream.current = microphone
      inputContext.current = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE })
      outputContext.current = new AudioContext({ sampleRate: 24000 })
      await inputContext.current.resume()
      await outputContext.current.resume()
      const tokenResponse = await fetch("/api/voice/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(resumeRequest?.voiceSessionToken ? { "x-example-limo-voice-session": resumeRequest.voiceSessionToken } : {}),
        },
        body: JSON.stringify({
          agentId,
          fallback: retryFallback,
          avoidKeySlot,
          runId: resumeRequest?.runId,
          resumeHandle: resumeRequest?.resumeHandle,
          voiceSessionToken: resumeRequest?.voiceSessionToken,
        }),
      })
      const payload = await tokenResponse.json() as { token?: string; provider?: "xai" | "gemini"; model?: string; voice?: string; speed?: number; keySlot?: number; maxSessionMinutes?: number; voiceSessionToken?: string; demoVoiceSessionToken?: string; runId?: string; resumeHandle?: string; error?: string }
      if (!tokenResponse.ok || !payload.token) throw new Error(payload.error || "Voice session could not start.")
      selectedKeySlot = payload.keySlot
      voiceSessionToken.current = payload.voiceSessionToken || ""
      demoVoiceSessionToken.current = payload.demoVoiceSessionToken || ""
      runIdRef.current = payload.runId || resumeRequest?.runId || ""
      setRunId(runIdRef.current)
      if (payload.resumeHandle) resumeHandleRef.current = payload.resumeHandle

      connectionAttempted = true
      const provider = payload.provider === "xai" ? "xai" : "gemini"
      let connectionPromise: Promise<any>
      if (provider === "xai") {
        connectionPromise = new Promise<WebSocket>((resolve, reject) => {
          const socket = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(payload.model || "grok-voice-think-fast-2.0")}`, [`xai-client-secret.${payload.token}`])
          const pendingToolCalls: Array<{ callId: string; name: string; arguments: string }> = []
          let toolFlushTimer: ReturnType<typeof setTimeout> | null = null
          let opened = false

          const sendEvent = (event: Record<string, unknown>) => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event))
          }
          const failOpenConnection = (detail: string) => {
            if (sessionGeneration.current !== currentGeneration) return
            if (!connectionOpened.current) {
              reject(new Error(detail))
              return
            }
            if (retryOnConnectionFailure(detail, audioReceived.current)) return
            emitAuditEvent(isResume ? "lifecycle_resume_failed" : "error", { detail })
            console.error("[volimox/live] xAI websocket error", detail.slice(0, 300))
            cleanupResources(true, true, isResume)
            setState("error")
            setError(friendlyVoiceError(detail, retryFallback))
          }
          const flushToolCalls = () => {
            toolFlushTimer = null
            const calls = pendingToolCalls.splice(0)
            if (!calls.length) return
            void Promise.all(calls.map(async (call) => {
              try {
                const parsed = JSON.parse(call.arguments || "{}")
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Tool arguments must be a JSON object.")
                const result = await runTool(call.name, parsed as Record<string, unknown>)
                return { callId: call.callId, output: JSON.stringify(result) }
              } catch (toolError) {
                return { callId: call.callId, output: JSON.stringify({ error: toolError instanceof Error ? toolError.message : "Tool failed." }) }
              }
            })).then((results) => {
              if (sessionGeneration.current !== currentGeneration || socket.readyState !== WebSocket.OPEN) return
              results.forEach((result) => sendEvent({
                type: "conversation.item.create",
                item: { type: "function_call_output", call_id: result.callId, output: result.output },
              }))
              sendEvent({ type: "response.create" })
            })
          }
          const queueToolCall = (event: Record<string, unknown>) => {
            const name = typeof event.name === "string" ? event.name : ""
            const callId = typeof event.call_id === "string" ? event.call_id : `xai-call-${Date.now()}`
            if (!name) return
            pendingToolCalls.push({ callId, name, arguments: typeof event.arguments === "string" ? event.arguments : "{}" })
            if (!toolFlushTimer) toolFlushTimer = setTimeout(flushToolCalls, 0)
          }

          socket.onopen = () => {
            if (sessionGeneration.current !== currentGeneration) {
              socket.close()
              return
            }
            opened = true
            connectionOpened.current = true
            if (connectTimeout.current) clearTimeout(connectTimeout.current)
            connectTimeout.current = null
            resumeInFlight.current = false
            const now = new Date()
            const currentTimeNewYork = new Intl.DateTimeFormat("en-US", {
              timeZone: "America/New_York",
              dateStyle: "full",
              timeStyle: "long",
            }).format(now)
            const runtimeInstructions = agentId === "limo"
              ? buildExampleLimoWebVoiceInstruction(now)
              : `${profile.systemInstruction}\n\nCURRENT TIME\n- The current date/time in New York (America/New_York) is: ${currentTimeNewYork}\n- Resolve today, tomorrow, tonight, and weekdays from this exact value.`
            try {
              sendEvent({
                type: "session.update",
                session: {
                  voice: payload.voice || "eve",
                  instructions: runtimeInstructions,
                  reasoning: { effort: "none" },
                  tools: xaiFunctionTools(profile.tools),
                  turn_detection: { type: "server_vad", silence_duration_ms: 800, prefix_padding_ms: 333 },
                  audio: {
                    input: { format: { type: "audio/pcm", rate: INPUT_SAMPLE_RATE }, transport: "json", transcription: { model: "grok-transcribe" } },
                    output: { format: { type: "audio/pcm", rate: 24000 }, transport: "json", speed: typeof payload.speed === "number" ? payload.speed : 1.2 },
                  },
                },
              })
              sendEvent({
                type: "conversation.item.create",
                item: { type: "message", role: "user", content: [{ type: "input_text", text: "Start the conversation by greeting me as the concierge." }] },
              })
              sendEvent({ type: "response.create" })
            } catch (cause) {
              reject(cause)
              socket.close()
              return
            }
            setState("live")
            emitAuditEvent(isResume ? "lifecycle_resume_succeeded" : "lifecycle_connected", { provider: "xai", model: payload.model })
            trackDemoEvent("voice_demo_started", { agentId })
            resolve(socket)
          }
          socket.onmessage = (message) => {
            if (sessionGeneration.current !== currentGeneration || typeof message.data !== "string") return
            let event: Record<string, unknown>
            try {
              event = JSON.parse(message.data) as Record<string, unknown>
            } catch {
              return
            }
            const type = typeof event.type === "string" ? event.type : ""
            if (type === "error") {
              failOpenConnection(voiceErrorText(event.error || event) || "xAI Grok voice reported an error.")
              return
            }
            const audio = type === "response.output_audio.delta" || type === "response.audio.delta"
              ? (typeof event.delta === "string" ? event.delta : typeof event.audio === "string" ? event.audio : "")
              : ""
            if (audio) {
              audioReceived.current = true
              playAudio(audio)
              setTalking(true)
            }
            const isInputTranscript = type === "conversation.item.input_audio_transcription.updated"
              || type === "conversation.item.input_audio_transcription.completed"
              || type === "conversation.item.input_audio_transcription.done"
            if (isInputTranscript) {
              const text = xaiEventTranscript(event)
              const isFinal = /\.(completed|done)$/.test(type)
              const acceptFinal = !isFinal || shouldAcceptFinalTranscript({
                state: transcriptDeduplication.current,
                role: "user",
                itemId: transcriptEventItemId(event),
                text: text || transcriptDraft.current.user.text,
              })
              if (acceptFinal && text) {
                const draft = transcriptDraft.current.user
                draft.text = mergeTranscriptFragment(draft.text, text)
                upsertTranscript("user", draft.text)
              }
              if (acceptFinal && isFinal) finishTranscript("user")
            }
            const isOutputTranscript = /^response\.(output_audio_transcript|audio_transcript)\.(delta|done|completed)$/.test(type)
            if (isOutputTranscript) {
              const text = xaiEventTranscript(event)
              const isFinal = /\.(completed|done)$/.test(type)
              const acceptFinal = !isFinal || shouldAcceptFinalTranscript({
                state: transcriptDeduplication.current,
                role: "agent",
                itemId: transcriptEventItemId(event),
                text: text || transcriptDraft.current.agent.text,
              })
              if (acceptFinal && text) {
                const draft = transcriptDraft.current.agent
                draft.text = mergeTranscriptFragment(draft.text, text)
                upsertTranscript("agent", draft.text)
              }
              if (acceptFinal && isFinal) finishTranscript("agent")
            }
            if (type === "response.function_call_arguments.done") {
              const pendingCustomerTurn = transcriptDraft.current.user
              if (pendingCustomerTurn.text.trim()) {
                upsertTranscript("user", pendingCustomerTurn.text)
                finishTranscript("user")
              }
              queueToolCall(event)
            }
            if (type === "response.done") {
              commitTranscriptTurn()
              setTalking(false)
            }
          }
          socket.onerror = () => {
            failOpenConnection("xAI Grok voice WebSocket error.")
          }
          socket.onclose = (event) => {
            if (sessionGeneration.current !== currentGeneration) return
            if (!opened) {
              reject(new Error(event.reason || (event.code ? `close code ${event.code}` : "xAI Grok voice connection closed.")))
              return
            }
            const receivedAudio = audioReceived.current
            const detail = event.reason || (event.code ? `close code ${event.code}` : "no close reason")
            if (retryOnConnectionFailure(detail, receivedAudio)) return
            const expectedReason = expectedCloseReason.current
            if (expectedReason) {
              emitAuditEvent("lifecycle_closed", { reason: expectedReason, detail, code: event.code })
              cleanupResources(true, true, expectedReason === "goaway")
              setState("idle")
              return
            }
            emitAuditEvent(isResume ? "lifecycle_resume_failed" : "error", { detail, code: event.code })
            console.error("[volimox/live] xAI websocket closed", detail)
            cleanupResources(true, true, isResume)
            if (!receivedAudio) {
              setState("error")
              setError(friendlyVoiceError(detail, retryFallback))
            } else {
              setState("idle")
            }
          }
        })
      } else {
        const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } })
        connectionPromise = ai.live.connect({
          model: payload.model || "gemini-3.1-flash-live-preview",
          // Keep transcription enabled on the browser connection as well as on
          // the ephemeral-token constraint. This makes customer turns available
          // to the transcript UI across Gemini Live model variants.
          config: {
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: resumeRequest?.resumeHandle ? { handle: resumeRequest.resumeHandle } : {},
          },
          callbacks: {
            onopen: () => {
              if (sessionGeneration.current !== currentGeneration) return
              if (connectTimeout.current) clearTimeout(connectTimeout.current)
              connectTimeout.current = null
              connectionOpened.current = true
              resumeInFlight.current = false
              setState("live")
              emitAuditEvent(isResume ? "lifecycle_resume_succeeded" : "lifecycle_connected", { keySlot: selectedKeySlot })
              trackDemoEvent("voice_demo_started", { agentId })
            },
            onmessage: async (message: any) => {
              if (sessionGeneration.current !== currentGeneration) return
              let requestedResume: ResumeRequest | undefined
              const resumptionUpdate = message.sessionResumptionUpdate
              if (resumptionUpdate?.resumable && typeof resumptionUpdate.newHandle === "string" && resumptionUpdate.newHandle) {
                resumeHandleRef.current = resumptionUpdate.newHandle
              }
              if (message.goAway) {
                commitTranscriptTurn()
                const handle = resumeHandleRef.current
                emitAuditEvent("lifecycle_goaway", { timeLeft: message.goAway.timeLeft })
                expectedCloseReason.current = "goaway"
                intentionalClose.current = true
                const canResume = Boolean(handle && runIdRef.current && voiceSessionToken.current)
                  && (!sessionDeadlineAt.current || sessionDeadlineAt.current - Date.now() > 5000)
                if (canResume && !resumeInFlight.current) {
                  resumeInFlight.current = true
                  requestedResume = {
                    resumeHandle: handle,
                    runId: runIdRef.current,
                    voiceSessionToken: voiceSessionToken.current,
                    keySlot: selectedKeySlot,
                  }
                }
              }
              const content = message.serverContent
              if (content?.modelTurn?.parts) {
                const audioParts = content.modelTurn.parts.filter((part: any) => part.inlineData?.data)
                audioParts.forEach((part: any) => {
                  audioReceived.current = true
                  playAudio(part.inlineData.data)
                })
                if (audioParts.length) setTalking(true)
              }
              const inputTranscription = content?.inputTranscription || message.inputTranscription
              const inputFinished = Boolean(inputTranscription?.finished)
              const acceptInput = !inputFinished || shouldAcceptFinalTranscript({
                state: transcriptDeduplication.current,
                role: "user",
                itemId: typeof inputTranscription?.itemId === "string" ? inputTranscription.itemId : typeof inputTranscription?.item_id === "string" ? inputTranscription.item_id : "",
                text: inputTranscription?.text || transcriptDraft.current.user.text,
              })
              if (acceptInput && inputTranscription?.text) {
                const draft = transcriptDraft.current.user
                draft.text = mergeTranscriptFragment(draft.text, inputTranscription.text)
                upsertTranscript("user", draft.text)
              }
              if (acceptInput && inputFinished) finishTranscript("user")

              const outputTranscription = content?.outputTranscription || message.outputTranscription
              const outputFinished = Boolean(outputTranscription?.finished)
              const acceptOutput = !outputFinished || shouldAcceptFinalTranscript({
                state: transcriptDeduplication.current,
                role: "agent",
                itemId: typeof outputTranscription?.itemId === "string" ? outputTranscription.itemId : typeof outputTranscription?.item_id === "string" ? outputTranscription.item_id : "",
                text: outputTranscription?.text || transcriptDraft.current.agent.text,
              })
              if (acceptOutput && outputTranscription?.text) {
                const draft = transcriptDraft.current.agent
                draft.text = mergeTranscriptFragment(draft.text, outputTranscription.text)
                upsertTranscript("agent", draft.text)
              }
              if (acceptOutput && outputFinished) finishTranscript("agent")
              if (content?.turnComplete) {
                // Gemini emits input/output transcription independently and some
                // models omit `finished`. Turn completion is the shared boundary
                // that prevents a user's next utterance being merged into this one.
                commitTranscriptTurn()
                setTalking(false)
              }
              if (message.toolCall?.functionCalls) {
                // A Gemini function call is also a customer-turn boundary. Some
                // Live model variants issue it before `finished`/`turnComplete`,
                // so finalize the accumulated customer transcript before the
                // server validates vehicle selection or price approval.
                const pendingCustomerTurn = transcriptDraft.current.user
                if (pendingCustomerTurn.text.trim()) {
                  upsertTranscript("user", pendingCustomerTurn.text)
                  finishTranscript("user")
                }
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
              if (requestedResume && sessionGeneration.current === currentGeneration) {
                const nextResume = requestedResume
                window.setTimeout(() => { void start(false, undefined, nextResume) }, 0)
              }
            },
            onerror: (event: any) => {
              if (sessionGeneration.current !== currentGeneration) return
              const detail = voiceErrorText(event) || "The voice connection was interrupted."
              if (retryOnConnectionFailure(detail, audioReceived.current)) return
              if (expectedCloseReason.current === "goaway" || /goaway|session duration/i.test(detail)) {
                emitAuditEvent("lifecycle_closed", { reason: "goaway", detail })
                cleanupResources(true, true, true)
                setState("idle")
                return
              }
              emitAuditEvent(isResume ? "lifecycle_resume_failed" : "error", { detail })
              console.error("[volimox/live] websocket error", detail.slice(0, 300))
              cleanupResources(true, true, isResume)
              setState("error")
              setError(friendlyVoiceError(detail, retryFallback))
            },
            onclose: (event: any) => {
              if (sessionGeneration.current !== currentGeneration) return
              const opened = connectionOpened.current
              const receivedAudio = audioReceived.current
              const detail = event?.reason || (event?.code ? `close code ${event.code}` : "no close reason")
              if (retryOnConnectionFailure(detail, receivedAudio)) return
              const expectedReason = expectedCloseReason.current || (/goaway|session duration/i.test(detail) ? "goaway" : null)
              if (expectedReason) {
                emitAuditEvent("lifecycle_closed", { reason: expectedReason, detail, code: event?.code })
                cleanupResources(true, true, expectedReason === "goaway")
                setState("idle")
                return
              }
              emitAuditEvent(isResume ? "lifecycle_resume_failed" : "error", { detail, code: event?.code })
              console.error("[volimox/live] websocket closed", detail)
              cleanupResources(true, true, isResume)
              if (!opened || !receivedAudio) {
                setState("error")
                setError(friendlyVoiceError(detail, retryFallback))
              } else {
                setState("idle")
              }
            },
          },
          })
      }
      void connectionPromise.then((connected) => {
        if (sessionGeneration.current !== currentGeneration) connected.close()
      }).catch(() => undefined)

      const live = await Promise.race([
        connectionPromise,
        new Promise<never>((_, reject) => {
          connectTimeout.current = setTimeout(() => reject(new Error("Live voice connection timed out before audio started.")), 15000)
        }),
      ])
      if (sessionGeneration.current !== currentGeneration) {
        live.close()
        return
      }
      session.current = live
      maxMinutes.current = Math.max(1, Number(payload.maxSessionMinutes || 10))
      if (!isResume || !sessionDeadlineAt.current) sessionDeadlineAt.current = Date.now() + maxMinutes.current * 60 * 1000
      const remainingSessionMs = Math.max(1, sessionDeadlineAt.current - Date.now())
      sessionTimer.current = setTimeout(() => {
        stopSession(true, true, "timer")
        setError(`This demonstration session ended after ${maxMinutes.current} minutes.`)
      }, remainingSessionMs)
      if (provider === "gemini" && !isResume) live.sendRealtimeInput({ text: "Start the conversation by greeting me as the concierge." })

      const input = inputContext.current
      if (!input) throw new Error("The microphone audio context is unavailable.")
      const source = input.createMediaStreamSource(microphone)
      const silentGain = input.createGain()
      silentGain.gain.value = 0
      const sendAudio = (samples: Float32Array) => {
        if (!session.current) return
        if (provider === "xai") {
          if (session.current.readyState === WebSocket.OPEN) session.current.send(JSON.stringify({ type: "input_audio_buffer.append", audio: pcmToBase64(samples) }))
        } else {
          session.current.sendRealtimeInput({ audio: { data: pcmToBase64(samples), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` } })
        }
      }
      const inputNode = input.createScriptProcessor(1024, 1, 1)
      inputNode.onaudioprocess = (event) => sendAudio(event.inputBuffer.getChannelData(0))
      source.connect(inputNode)
      inputNode.connect(silentGain)
      silentGain.connect(input.destination)
      processor.current = inputNode
    } catch (cause) {
      if (retryOnConnectionFailure(cause, audioReceived.current)) return
      if (isResume) emitAuditEvent("lifecycle_resume_failed", { detail: voiceErrorText(cause) })
      else emitAuditEvent("error", { detail: voiceErrorText(cause) })
      resumeInFlight.current = false
      cleanupResources(false, true, isResume)
      setState("error")
      setError(friendlyVoiceError(cause, retryFallback))
    }
  }

  useEffect(() => {
    const viewport = transcriptViewport.current
    if (!viewport || !transcriptFollowTail.current) return
    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" })
    })
    return () => window.cancelAnimationFrame(frame)
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

  const handleTranscriptScroll = () => {
    const viewport = transcriptViewport.current
    if (!viewport) return
    const followingTail = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < TRANSCRIPT_BOTTOM_THRESHOLD
    transcriptFollowTail.current = followingTail
    transcriptHistoryModeRef.current = !followingTail
    setTranscriptHistoryMode(!followingTail)
    if (followingTail) setUnreadTranscriptCount(0)
  }

  const returnTranscriptToLive = () => {
    const viewport = transcriptViewport.current
    transcriptFollowTail.current = true
    transcriptHistoryModeRef.current = false
    setTranscriptHistoryMode(false)
    setUnreadTranscriptCount(0)
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" })
  }

  const visibleLines = lines
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
              <div className="text-right">
                <span className="flex items-center justify-end gap-2 text-xs text-white/45">
                  <span className={`h-2 w-2 rounded-full transition-colors duration-200 ${state === "live" && talking ? "animate-pulse bg-signal" : state === "live" ? "bg-signal/35" : "bg-white/20"}`} />
                  {voiceStatus}
                </span>
                {runId && <span className="mt-1 block font-mono text-[8px] uppercase tracking-[.12em] text-white/25" title={runId}>Run {runId.slice(-8)}</span>}
              </div>
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
                    <div className="relative">
                    <div ref={transcriptViewport} onScroll={handleTranscriptScroll} className="live-transcript-scrollbar h-[260px] space-y-5 overflow-y-auto py-4 pr-2 sm:h-[300px]" role="log" aria-live="polite" aria-label="Live conversation transcript">
                      {visibleLines.map((line, index) => {
                        const messageStyle = transcriptMessageStyle(visibleLines.length - index - 1, transcriptHistoryMode)
                        return (
                        <motion.div
                          key={line.id}
                          initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
                          animate={{ opacity: messageStyle.opacity, filter: messageStyle.filter, y: messageStyle.y }}
                          transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
                          style={{ pointerEvents: messageStyle.pointerEvents }}
                          className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`max-w-[88%] break-words ${line.role === "user" ? "border-r border-white/35 pr-4 text-right" : "border-l border-signal/75 pl-4"}`}>
                            <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[.14em] text-white/35">{line.role === "agent" ? profile.name : "You"}</span>
                            <p className="text-[15px] leading-6 text-white/88">{line.content}</p>
                          </div>
                        </motion.div>
                        )
                      })}
                    </div>
                    <AnimatePresence initial={false}>
                      {transcriptHistoryMode && (
                        <motion.button
                          type="button"
                          initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
                          transition={reducedMotion ? { duration: 0 } : { duration: 0.18 }}
                          onClick={returnTranscriptToLive}
                          className="absolute bottom-2 left-1/2 -translate-x-1/2 border border-white/20 bg-ink/95 px-3 py-2 font-mono text-[9px] uppercase tracking-[.12em] text-white/75 backdrop-blur-sm transition-colors hover:border-signal/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                        >
                          Return to live{unreadTranscriptCount > 0 ? ` · ${unreadTranscriptCount} new` : ""}
                        </motion.button>
                      )}
                    </AnimatePresence>
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

            <button onClick={state === "live" ? () => stopSession(true) : () => { void start() }} disabled={state === "connecting"} className="mt-7 inline-flex h-14 w-full items-center justify-center gap-3 bg-signal px-5 font-semibold text-ink transition active:translate-y-px disabled:cursor-wait disabled:opacity-65">
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
                {summary.runId && <p className="mt-2 break-all font-mono text-[9px] uppercase tracking-[.1em] text-white/30">Run {summary.runId}</p>}
                <div className="mt-8 border-t border-white/15">
                  {summary.tools.length ? summary.tools.map((item) => (
                    <div key={item.id} className="border-b border-white/15 py-4">
                      <div className="flex items-center gap-3"><Check size={15} weight="bold" className="text-signal" /><p className="text-sm font-semibold">{item.label}</p></div>
                      <p className="mt-1 pl-7 text-xs leading-5 text-white/40">{item.detail}</p>
                    </div>
                  )) : <p className="border-b border-white/15 py-4 text-sm text-white/45">No external action was requested during this conversation.</p>}
                </div>
                {checkoutUrl && (
                  <a href={checkoutUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-14 items-center justify-between border border-signal bg-signal px-5 py-4 text-sm font-semibold text-ink transition active:translate-y-px">
                    Open secure checkout <ArrowRight size={16} weight="bold" />
                  </a>
                )}
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
                {checkoutUrl && (
                  <a href={checkoutUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-12 items-center justify-between border border-signal bg-signal px-4 py-3 text-sm font-semibold text-ink transition active:translate-y-px">
                    Open secure checkout <ArrowRight size={16} weight="bold" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
