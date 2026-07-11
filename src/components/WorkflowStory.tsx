"use client"

import { useRef, useState } from "react"
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react"
import {
  ChatCircleText,
  CheckCircle,
  CurrencyDollar,
  Database,
  Lightning,
  UserSwitch,
} from "@phosphor-icons/react"

const story = [
  {
    number: "01",
    title: "Understand the request",
    copy: "Voice, chat, SMS, email, and forms become one structured operational record.",
    detail: "Intent · locations · timing · constraints",
    icon: ChatCircleText,
  },
  {
    number: "02",
    title: "Apply business logic",
    copy: "Deterministic rules validate service areas, inventory, availability, and pricing before anything executes.",
    detail: "Rules · APIs · confidence · consent",
    icon: Lightning,
  },
  {
    number: "03",
    title: "Complete the transaction",
    copy: "The system produces the quote, secures payment, and confirms the next action while the customer is still engaged.",
    detail: "Quote · approval · payment · confirmation",
    icon: CurrencyDollar,
  },
  {
    number: "04",
    title: "Fulfill across your stack",
    copy: "Scheduling, dispatch, CRM, and reporting update together so no one has to re-enter the work.",
    detail: "Dispatch · calendar · CRM · audit log",
    icon: Database,
  },
  {
    number: "05",
    title: "Escalate the exception",
    copy: "When policy, confidence, or customer intent crosses a boundary, a human receives the full context.",
    detail: "Reason · transcript · owner · next step",
    icon: UserSwitch,
  },
]

export function WorkflowStory() {
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: root, offset: ["start start", "end end"] })

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (reduceMotion) return
    const next = Math.min(story.length - 1, Math.floor(progress * story.length))
    setActive((current) => (current === next ? current : next))
  })

  const current = story[active]
  const CurrentIcon = current.icon

  return (
    <section ref={root} id="system" className="relative min-h-[390vh] border-t border-line bg-canvas">
      <div className="sticky top-[72px] flex min-h-[calc(100dvh-72px)] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-12">
          <div className="self-center">
            <p className="section-kicker">Conversation to completion</p>
            <h2 className="section-title max-w-[9ch]">One request. One controlled run.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-ink-muted">
              Volimox joins the judgment layer and the execution layer, so an AI interaction can finish real work safely.
            </p>
            <div className="mt-10 hidden gap-2 lg:flex" aria-hidden="true">
              {story.map((item, index) => (
                <span key={item.number} className={`h-1 flex-1 transition-colors duration-500 ${index <= active ? "bg-signal" : "bg-line-strong"}`} />
              ))}
            </div>
          </div>

          <div className="relative min-h-[480px] overflow-hidden border border-line-strong bg-ink p-5 text-white shadow-[0_30px_90px_rgba(18,19,17,0.16)] sm:p-8">
            <div className="absolute inset-0 operations-grid opacity-25" aria-hidden="true" />
            <div className="relative flex h-full min-h-[420px] flex-col">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Operational runbook</span>
                <span className="font-mono text-[10px] text-signal">STEP {current.number} / 05</span>
              </div>

              <div className="grid flex-1 items-center gap-8 py-10 sm:grid-cols-[auto_1fr]">
                <motion.div
                  key={`icon-${current.number}`}
                  initial={{ opacity: 0, scale: 0.85, rotate: -5 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.45 }}
                  className="flex h-24 w-24 items-center justify-center bg-signal text-ink sm:h-32 sm:w-32"
                >
                  <CurrentIcon size={52} weight="duotone" />
                </motion.div>

                <motion.div
                  key={current.number}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <p className="font-mono text-xs text-signal">{current.number}</p>
                  <h3 className="mt-3 max-w-lg text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{current.title}</h3>
                  <p className="mt-5 max-w-xl text-sm leading-6 text-white/55 sm:text-base sm:leading-7">{current.copy}</p>
                </motion.div>
              </div>

              <div className="flex items-center gap-3 border-t border-white/10 pt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
                <CheckCircle size={15} weight="fill" className="text-signal" />
                {current.detail}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
