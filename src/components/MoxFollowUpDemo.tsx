"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  Check,
  CheckCircle,
  EnvelopeSimple,
  Lightning,
  Phone,
  PhoneCall,
  SpinnerGap,
  UserCircle,
  Wrench,
} from "@phosphor-icons/react"
import type { PublicFollowUpDemoSession } from "@/lib/follow-up-demo"
import { trackDemoEvent } from "@/lib/client-analytics"

const businesses = [
  { label: "Plumbing", icon: Wrench },
  { label: "Electrical", icon: Lightning },
  { label: "HVAC", icon: Wrench },
  { label: "Locksmith", icon: Wrench },
]

type FormState = {
  fullName: string
  email: string
  phone: string
  companyName: string
  businessType: string
  consentSms: boolean
  consentEmail: boolean
  consentCall: boolean
}

const initialForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  companyName: "",
  businessType: "Plumbing",
  consentSms: false,
  consentEmail: false,
  consentCall: false,
}

export function MoxFollowUpDemo() {
  const completedSessionTracked = useRef("")
  const demoVideoWatched = useRef(false)
  const idempotencyKeyRef = useRef(crypto.randomUUID())
  const [form, setForm] = useState(initialForm)
  const [session, setSession] = useState<PublicFollowUpDemoSession | null>(null)
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [calling, setCalling] = useState(false)
  const [error, setError] = useState("")

  const pollIntervalRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const storedToken = window.localStorage.getItem("volimox_demo_session_token")
    if (storedToken) setToken(storedToken)
  }, [])

  useEffect(() => {
    if (!token) return
    let stopped = false

    const scheduleNext = (delay: number) => {
      if (stopped) return
      if (pollIntervalRef.current) window.clearTimeout(pollIntervalRef.current)
      pollIntervalRef.current = window.setTimeout(refresh, delay)
    }

    const refresh = async () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch(`/api/follow-up-demo/events?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
          signal: abortControllerRef.current.signal,
        })

        if (response.status === 401 || response.status === 404) {
          window.localStorage.removeItem("volimox_demo_session_token")
          if (!stopped) setToken("")
          return
        }

        const payload = await response.json() as { ok?: boolean; session?: PublicFollowUpDemoSession }
        if (stopped) return

        if (response.ok && payload.session) {
          setSession(payload.session)
          if (payload.session.status === "completed" || payload.session.status === "expired") {
            return
          }

          const events = payload.session.events || []
          const messages = payload.session.messages || []
          const lastEventTime = events.length ? new Date(events[events.length - 1].timestamp).getTime() : 0
          const lastMessageTime = messages.length ? new Date(messages[messages.length - 1].timestamp).getTime() : 0
          const lastActivity = Math.max(lastEventTime, lastMessageTime, new Date(payload.session.createdAt).getTime())

          if (Date.now() - lastActivity > 10000) {
            scheduleNext(5000)
          } else {
            scheduleNext(1600)
          }
        } else {
          scheduleNext(1600)
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          scheduleNext(5000)
        }
      }
    }

    void refresh()

    return () => {
      stopped = true
      if (pollIntervalRef.current) window.clearTimeout(pollIntervalRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [token])

  useEffect(() => {
    if (session?.status !== "completed" || completedSessionTracked.current === session.id) return
    completedSessionTracked.current = session.id
    trackDemoEvent("follow_up_demo_completed", { businessType: session.businessType })
  }, [session?.businessType, session?.id, session?.status])

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/follow-up-demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, idempotencyKey: idempotencyKeyRef.current }),
      })
      const payload = await response.json() as { ok?: boolean; token?: string; session?: PublicFollowUpDemoSession; error?: string }
      if (!response.ok || !payload.ok || !payload.token || !payload.session) throw new Error(payload.error || "The live demo could not start.")
      window.localStorage.setItem("volimox_demo_session_token", payload.token)
      setToken(payload.token)
      setSession(payload.session)
      trackDemoEvent("follow_up_demo_started", { businessType: form.businessType, videoWatched: demoVideoWatched.current })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The live demo could not start.")
    } finally {
      setLoading(false)
    }
  }

  const startCall = async () => {
    setCalling(true)
    setError("")
    try {
      const response = await fetch("/api/follow-up-demo/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const payload = await response.json() as { ok?: boolean; session?: PublicFollowUpDemoSession; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The call could not start.")
      if (payload.session) setSession(payload.session)
      trackDemoEvent("follow_up_callback_requested", { businessType: session?.businessType || form.businessType })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The call could not start.")
    } finally {
      setCalling(false)
    }
  }

  return (
    <section id="follow-up" className="border-b border-line bg-canvas-muted py-24 text-ink sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-5xl">
          <p className="section-kicker text-ink">Mox Follow-Up</p>
          <h2 className="mt-5 max-w-[11ch] text-[clamp(3.1rem,6.2vw,6.7rem)] font-semibold leading-[.86] tracking-[-.072em]">You missed the call. <span className="text-outline">Mox didn't.</span></h2>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-muted">The starter system for independent service businesses. It responds, qualifies the job, follows up, and hands the owner a clean lead.</p>
        </div>

        <DemoExplainerVideo onHalfway={() => { demoVideoWatched.current = true }} />

        <div id="follow-up-form" className="mt-10 grid scroll-mt-24 overflow-hidden border border-line-strong bg-canvas lg:grid-cols-[.74fr_1.26fr]">
          <div className="border-b border-line-strong p-5 sm:p-8 lg:border-b-0 lg:border-r">
            {!session ? (
              <form onSubmit={submit}>
                <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
                  <div><p className="font-mono text-[9px] uppercase tracking-[.17em] text-ink-faint">Run it on your phone</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Recover a missed call</h3></div>
                  <span className="flex h-11 w-11 items-center justify-center bg-signal"><Phone size={20} weight="fill" /></span>
                </div>

                <div className="mt-6 border-l-2 border-signal bg-white p-4">
                  <p className="text-xs font-semibold">How this live simulation works</p>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">Your mobile receives one demo call. Reject it or let it ring out. The same phone then shows the real text-back experience a missed customer would receive.</p>
                </div>

                <fieldset className="mt-7">
                  <legend className="text-xs font-semibold">Choose an example business</legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {businesses.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => update("businessType", label)} className={`flex min-h-12 items-center gap-2 border px-3 text-left text-xs font-semibold transition ${form.businessType === label ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink"}`}><Icon size={16} />{label}</button>)}
                  </div>
                </fieldset>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <DemoField label="Customer name used in SMS" value={form.fullName} onChange={(value) => update("fullName", value)} autoComplete="name" placeholder="Sarah Miller" />
                  <DemoField label="Example business name" value={form.companyName} onChange={(value) => update("companyName", value)} autoComplete="organization" placeholder="Miller Services" />
                  <DemoField label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} autoComplete="email" placeholder="sarah@company.com" />
                  <DemoField label="Phone used for call and SMS" type="tel" value={form.phone} onChange={(value) => update("phone", value)} autoComplete="tel" placeholder="(201) 555-0123" />
                </div>

                <div className="mt-6 space-y-3 border-t border-line pt-5">
                  <Consent checked={form.consentSms && form.consentEmail} onChange={(checked) => { update("consentSms", checked); update("consentEmail", checked) }}>Send this requested demo to my phone and email. Message and data rates may apply. Reply STOP to opt out.</Consent>
                  <Consent required checked={form.consentCall} onChange={(checked) => update("consentCall", checked)}>Call me once to simulate a missed call. I understand I can reject it or let it ring out, then receive the text-back demo.</Consent>
                </div>

                {error && <p className="mt-5 border-l-2 border-red-600 pl-3 text-sm text-red-700">{error}</p>}
                <button disabled={loading} className="mt-6 inline-flex h-14 w-full items-center justify-center gap-3 bg-signal px-5 font-semibold text-ink transition hover:brightness-95 disabled:cursor-wait disabled:opacity-60">
                  {loading ? <SpinnerGap className="animate-spin" /> : <ArrowRight />} {loading ? "Starting live workflow..." : "Call me to start the demo"}
                </button>
                <p className="mt-3 text-center text-[10px] leading-5 text-ink-faint">Limited to two sessions per phone each day. Your contact details become a Volimox demo lead.</p>
              </form>
            ) : (
                <div className="flex h-full min-h-[610px] flex-col">
                <div className="flex items-center justify-between border-b border-line pb-5"><div><p className="text-xs font-semibold text-ink-faint">Live workflow</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Example {session.businessType}</h3></div><span className={`h-3 w-3 rounded-full ${session.status === "completed" ? "bg-ink/20" : "animate-pulse bg-signal"}`} /></div>
                <div className="mt-8">
                  <p className="text-sm font-semibold">{session.status === "completed" ? "Lead recovery complete" : session.messages.length ? "Continue by text" : "Check your phone"}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{session.status === "completed" ? "Mox captured the conversation and prepared the lead for owner follow-up." : session.messages.length ? `The text-back reached ${session.phoneMasked}. Reply with a real service problem and watch the workflow continue.` : `We are calling ${session.phoneMasked} now. Reject the call or let it ring out. Twilio sends the text-back only after the missed call is confirmed.`}</p>
                </div>
                <div className="mt-8 grid gap-px bg-line sm:grid-cols-2">
                  <ContactArtifact icon={Phone} label="SMS channel" value={session.phoneMasked} />
                  <ContactArtifact icon={EnvelopeSimple} label="Email sent to" value={session.emailMasked} />
                </div>
                <div className="mt-8 border border-line-strong bg-white p-5">
                  <p className="font-mono text-[9px] uppercase tracking-[.16em] text-ink-faint">What to try</p>
                  <p className="mt-3 text-sm leading-6 text-ink-muted">Reply with a real service problem. Mox will ask for the address, urgency, and timing, then prepare the lead for the owner.</p>
                </div>
                {form.consentCall && session.messages.some((item) => item.direction === "inbound") && <button type="button" onClick={startCall} disabled={calling} className="mt-4 inline-flex h-12 items-center justify-center gap-2 border border-ink bg-ink px-5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50">{calling ? <SpinnerGap className="animate-spin" /> : <PhoneCall weight="fill" />} {calling ? "Calling..." : "Call my phone"}</button>}
                {form.consentCall && !session.messages.some((item) => item.direction === "inbound") && <p className="mt-4 border-l-2 border-signal pl-3 text-xs leading-5 text-ink-muted">Reply to the SMS to verify this phone and unlock the live callback.</p>}
                {error && <p className="mt-5 border-l-2 border-red-600 pl-3 text-sm text-red-700">{error}</p>}
                <button type="button" onClick={() => { window.localStorage.removeItem("volimox_demo_session_token"); idempotencyKeyRef.current = crypto.randomUUID(); setSession(null); setToken(""); setForm(initialForm); setError("") }} className="mt-auto pt-8 text-left text-xs font-semibold text-ink-muted underline decoration-line-strong underline-offset-4">Start a different scenario</button>
              </div>
            )}
          </div>

          <OutcomeCanvas session={session} businessType={form.businessType} />
        </div>
      </div>
    </section>
  )
}

function DemoExplainerVideo({ onHalfway }: { onHalfway: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const startedTracked = useRef(false)
  const halfwayTracked = useRef(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    if (reduceMotion) {
      video.pause()
      video.currentTime = 0
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) {
        video.pause()
        return
      }

      void video.play().then(() => {
        if (startedTracked.current) return
        startedTracked.current = true
        trackDemoEvent("follow_up_demo_video_started")
      }).catch(() => {
        // Muted autoplay can still be blocked by browser or battery-saving settings.
      })
    }, { threshold: 0.35 })

    observer.observe(video)
    return () => {
      observer.disconnect()
      video.pause()
    }
  }, [reduceMotion])

  const trackHalfway = () => {
    const video = videoRef.current
    if (!video || halfwayTracked.current || !Number.isFinite(video.duration) || video.duration <= 0) return
    if (video.currentTime < video.duration / 2) return
    halfwayTracked.current = true
    onHalfway()
    trackDemoEvent("follow_up_demo_video_halfway")
  }

  return (
    <div className="mt-12 overflow-hidden border border-line-strong bg-ink text-white lg:grid lg:grid-cols-[.34fr_.66fr]">
      <div className="flex flex-col justify-between border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.17em] text-signal">See it in 24 seconds</p>
          <h3 className="mt-5 max-w-[12ch] text-[clamp(2rem,3.2vw,3.7rem)] font-semibold leading-[.92] tracking-[-.055em]">A missed call becomes a ready-to-work lead.</h3>
          <p id="follow-up-video-description" className="mt-5 max-w-md text-sm leading-6 text-white/55">Watch Mox respond while the owner stays focused on the job. No app walkthrough. Just the customer experience from ring to recovered lead.</p>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-white/35">Autoplays silently · Loops while visible</p>
          <a href="#follow-up-form" onClick={() => trackDemoEvent("follow_up_demo_video_cta_clicked")} className="mt-4 inline-flex h-12 items-center justify-center gap-2 bg-signal px-5 text-sm font-semibold text-ink transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal">
            Try it on your phone <ArrowRight size={15} />
          </a>
        </div>
      </div>

      <div className="flex items-center bg-black">
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/video/volimox-home-services-demo-poster.jpg"
          aria-label="Volimox missed-call recovery explainer"
          aria-describedby="follow-up-video-description"
          onTimeUpdate={trackHalfway}
          className="aspect-video h-auto w-full bg-black object-contain"
        >
          <source src="/video/volimox-home-services-demo.webm" type="video/webm" />
          <source src="/video/volimox-home-services-demo.mp4" type="video/mp4" />
          Your browser does not support embedded video.
        </video>
      </div>
    </div>
  )
}

function OutcomeCanvas({ session, businessType }: { session: PublicFollowUpDemoSession | null; businessType: string }) {
  const reduceMotion = useReducedMotion()
  const messages = session?.messages || []
  const events = session?.events || []
  const callEvent = events.find((item) => item.channel === "call")
  return <div className="operations-grid bg-ink p-5 text-white sm:p-8">
    <div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-xs font-semibold text-white/40">Live result</p><p className="mt-2 text-sm font-semibold">One customer journey, fully visible</p></div><span className={`text-xs font-semibold ${session ? "text-signal" : "text-white/30"}`}>{session ? "Live" : "Waiting"}</span></div>
    <div className="mt-7 grid gap-5 xl:grid-cols-[.88fr_1.12fr]">
      <div className="mx-auto aspect-[78/163.4] w-full max-w-[252px] rounded-[2rem] border border-white/20 bg-[#f8f7f1] p-2 text-ink shadow-[0_30px_80px_rgba(0,0,0,.28)]">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[1.55rem] bg-white">
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-2 z-20 h-4 w-16 -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" />
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 pb-3 pt-7"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white"><Wrench size={15} /></span><div><p className="text-xs font-semibold">Example {session?.businessType || businessType}</p><p className="text-[9px] text-ink-faint">SMS conversation</p></div></div><Phone size={15} /></div>
          <div className="flex min-h-0 flex-1 flex-col bg-[#f3f2ed] p-4">
            {callEvent && <div className="flex items-center gap-3 rounded-xl border border-line bg-white/90 p-3 shadow-sm"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white"><PhoneCall size={14} weight="fill" /></span><div><p className="text-[10px] font-semibold">{callEvent.title}</p><p className="mt-0.5 text-[8px] text-ink-faint">{callEvent.detail}</p></div><span className="ml-auto text-[8px] font-semibold text-ink-faint">{callEvent.state}</span></div>}
            <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
              {!messages.length && <div className="mx-auto max-w-[210px] text-center"><Phone size={22} className="mx-auto text-ink-faint" /><p className="mt-3 text-xs font-semibold">No messages yet</p><p className="mt-2 text-[10px] leading-5 text-ink-faint">The real SMS thread appears after the demo call is missed.</p></div>}
              <AnimatePresence initial={false}>{messages.slice(-6).map((item) => <motion.div key={item.id} initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: .2 }} className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-[11px] leading-5 ${item.direction === "outbound" ? "ml-auto rounded-br-sm bg-signal" : "rounded-bl-sm bg-white shadow-sm"}`}><p>{item.preview}</p></motion.div>)}</AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[500px] flex-col">
        <p className="font-mono text-[9px] uppercase tracking-[.17em] text-white/40">Live operations</p>
        <ServiceStatusCard session={session} businessType={businessType} />
        <div className="mt-5 space-y-2">
          {!events.length && <div className="border border-white/10 p-5"><p className="text-sm font-semibold">Waiting for a real session</p><p className="mt-2 text-xs leading-5 text-white/40">Call, SMS, reply, follow-up, and lead events will appear here as Twilio confirms them.</p></div>}
          <AnimatePresence initial={false}>{events.slice(-7).map((item, index) => <motion.div key={index} initial={{ opacity: 0, x: reduceMotion ? 0 : 12 }} animate={{ opacity: 1, x: 0 }} transition={reduceMotion ? { duration: 0 } : { delay: Math.min(index * .04, .2) }} className="border border-white/10 bg-black/15 p-4"><div className="flex items-start gap-3"><EventIcon channel={item.channel} status={item.state} /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold">{item.title}</p><span className={`text-[8px] font-semibold ${item.state === "failed" ? "text-red-300" : item.state === "completed" ? "text-signal" : "text-white/35"}`}>{item.state}</span></div><p className="mt-1 text-[10px] leading-5 text-white/40">{item.detail}</p></div></div></motion.div>)}</AnimatePresence>
        </div>
        {session?.status === "completed" && <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} className="mt-auto border-l-4 border-signal bg-white p-5 text-ink"><div className="flex items-center gap-2 text-xs font-semibold text-ink-faint"><CheckCircle weight="fill" className="text-ink" /> Recovered lead</div><p className="mt-3 text-xl font-semibold tracking-[-.04em]">Ready for owner follow-up</p><p className="mt-2 text-xs leading-5 text-ink-muted">Conversation history, urgency, address, and timing stay attached to the lead.</p><a href="#contact" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-ink underline underline-offset-4">Build this for my business <ArrowRight size={13} /></a></motion.div>}
      </div>
    </div>
  </div>
}

type ServiceStageState = "waiting" | "active" | "complete" | "failed"

type ServiceStage = {
  label: string
  detail: string
  state: ServiceStageState
}

function ServiceStatusCard({ session, businessType }: { session: PublicFollowUpDemoSession | null; businessType: string }) {
  const reduceMotion = useReducedMotion()
  const events = session ? session.events : []
  const messages = session ? session.messages : []
  const hasEvent = (type: string) => events.some((item) => item.type === type)
  const hasInboundMessage = messages.some((item) => item.direction === "inbound")
  const hasOutboundMessage = messages.some((item) => item.direction === "outbound")
  const recoveryStarted = hasEvent("sms.recovery_started")
  const missedCallDetected = recoveryStarted || events.some((item) => ["call.busy", "call.no-answer", "call.canceled"].includes(item.type))
  const callFailed = !missedCallDetected && events.some((item) => item.channel === "call" && item.state === "failed")
  const callInProgress = events.some((item) => ["call.started", "sms.waiting_for_missed_call"].includes(item.type))
  const textSent = hasOutboundMessage || events.some((item) => ["sms.sent", "sms.delivered"].includes(item.type))
  const textFailed = !textSent && events.some((item) => item.channel === "sms" && item.state === "failed")
  const customerReplied = hasInboundMessage || hasEvent("customer.replied")
  const leadReady = hasEvent("lead.created")
  const optedOut = hasEvent("consent.revoked")

  const stages: ServiceStage[] = [
    {
      label: "Call",
      state: callFailed ? "failed" : missedCallDetected ? "complete" : callInProgress ? "active" : "waiting",
      detail: callFailed
        ? "The demo call could not be completed."
        : missedCallDetected
          ? "Twilio confirmed the missed call."
          : callInProgress
            ? "Waiting for the call to be missed."
            : "Start the demo to place the call.",
    },
    {
      label: "Text",
      state: textFailed ? "failed" : textSent ? "complete" : recoveryStarted ? "active" : "waiting",
      detail: textFailed
        ? "The recovery text could not be sent."
        : textSent
          ? "The missed-call text-back was sent."
          : recoveryStarted
            ? "Waiting for Twilio to send the recovery text."
            : "It starts after the missed call is confirmed.",
    },
    {
      label: "Reply",
      state: customerReplied ? "complete" : textSent ? "active" : "waiting",
      detail: customerReplied
        ? "A reply arrived; Mox is qualifying the job."
        : textSent
          ? "Waiting for the customer to reply."
          : "The conversation begins after the text-back.",
    },
    {
      label: optedOut ? "Closed" : "Lead",
      state: leadReady || optedOut ? "complete" : customerReplied ? "active" : "waiting",
      detail: leadReady
        ? "Job details captured for owner follow-up."
        : optedOut
          ? "Messaging stopped after the customer opted out."
          : customerReplied
            ? "Mox is collecting address, urgency, and timing."
            : "Completed intake creates the owner-ready lead.",
    },
  ]

  const completedCount = stages.filter((stage) => stage.state === "complete").length
  const progress = Math.round((completedCount / stages.length) * 100)
  const currentStage = stages.find((stage) => stage.state === "failed" || stage.state === "active")
    || stages.find((stage) => stage.state === "waiting")
    || stages[stages.length - 1]
  const statusLabel = !session
    ? "Ready"
    : stages.some((stage) => stage.state === "failed")
      ? "Needs attention"
      : leadReady
        ? "Lead ready"
        : optedOut
          ? "Closed"
          : stages.some((stage) => stage.state === "active")
            ? "In progress"
            : "Waiting"
  const statusTone = statusLabel === "Needs attention"
    ? "border-red-300/30 bg-red-300/[.07] text-red-100"
    : statusLabel === "Lead ready"
      ? "border-signal/45 bg-signal/10 text-signal"
      : "border-white/10 bg-white/[.05] text-white/55"

  return (
    <div className="mt-4 border border-white/10 bg-white/[.035] p-4 sm:p-5" aria-label="Service call status">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.17em] text-white/40">Service call status</p>
          <p className="mt-1 text-sm font-semibold text-white/80">Example {businessType}</p>
        </div>
        <span className={`shrink-0 border px-2 py-1 font-mono text-[8px] uppercase tracking-[.12em] ${statusTone}`}>{statusLabel}</span>
      </div>

      <div className="mt-5 h-1 bg-white/10" aria-hidden="true">
        <motion.div
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
          className="h-full bg-signal"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stages.map((stage, index) => (
          <div key={stage.label} className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center border text-[9px] font-semibold ${stage.state === "complete" ? "border-signal/70 text-signal" : stage.state === "active" ? "border-signal bg-signal text-ink" : stage.state === "failed" ? "border-red-300/50 text-red-200" : "border-white/15 text-white/35"}`}>
                {stage.state === "complete" ? <Check size={12} weight="bold" /> : stage.state === "failed" ? "!" : `0${index + 1}`}
              </span>
              <span className={`truncate font-mono text-[9px] uppercase tracking-[.1em] ${stage.state === "active" ? "text-white" : stage.state === "complete" ? "text-white/70" : "text-white/40"}`}>{stage.label}</span>
            </div>
            <p className={`mt-2 min-h-10 text-[10px] leading-4 ${stage.state === "failed" ? "text-red-200/70" : "text-white/40"}`}>{stage.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-white/10 pt-4" aria-live="polite">
        <p className="font-mono text-[8px] uppercase tracking-[.16em] text-white/30">Current signal</p>
        <p className="mt-1 text-xs font-semibold text-white/75">{currentStage?.detail || "Waiting for the live workflow."}</p>
      </div>
    </div>
  )
}

function DemoField({ label, value, onChange, type = "text", autoComplete, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; placeholder: string }) {
  return <label className="text-xs font-semibold text-ink-muted">{label}<input required type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} className="mt-2 min-h-12 w-full border border-line-strong bg-white px-3 text-sm font-normal text-ink outline-none transition placeholder:text-ink-faint focus:border-ink" /></label>
}

function Consent({ checked, required = false, onChange, children }: { checked: boolean; required?: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return <label className="flex cursor-pointer items-start gap-3 text-[11px] leading-5 text-ink-muted"><input type="checkbox" required={required} checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center border border-line-strong bg-white peer-checked:border-ink peer-checked:bg-ink peer-checked:text-signal">{checked && <Check size={13} weight="bold" />}</span><span>{children}</span></label>
}

function ContactArtifact({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return <div className="bg-white p-4"><Icon size={17} /><p className="mt-5 font-mono text-[8px] uppercase tracking-[.14em] text-ink-faint">{label}</p><p className="mt-1 truncate text-xs font-semibold">{value}</p></div>
}

function EventIcon({ channel, status }: { channel: string; status: string }) {
  const Icon = channel === "sms" ? Phone : channel === "email" ? EnvelopeSimple : channel === "call" ? PhoneCall : channel === "lead" ? UserCircle : CheckCircle
  return <span className={`flex h-8 w-8 flex-none items-center justify-center border ${status === "completed" ? "border-signal text-signal" : status === "failed" ? "border-red-400/50 text-red-300" : "border-white/15 text-white/35"}`}><Icon size={14} /></span>
}
