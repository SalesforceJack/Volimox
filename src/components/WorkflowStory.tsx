"use client"

import { useRef, useState } from "react"
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react"
import {
  ChatCircleText,
  CheckCircle,
  Database,
  Lightning,
} from "@phosphor-icons/react"

const story = [
  {
    number: "01",
    title: "Capture the request",
    copy: "Collect the pickup, destination, timing, and passenger details your team needs to review a trip.",
    detail: "Pickup · drop-off · time · passengers",
    icon: ChatCircleText,
  },
  {
    number: "02",
    title: "Validate and quote",
    copy: "Check the route and vehicle against your business rules, then ask the customer to approve the quote from your agreed pricing source.",
    detail: "Route · vehicle · price · approval",
    icon: Lightning,
  },
  {
    number: "03",
    title: "Confirm and hand off",
    copy: "Confirm each booking and payment in the connected system. Your team handles manual driver assignment and requests that need a person.",
    detail: "Booking · payment check · operator handoff",
    icon: Database,
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
    <section ref={root} id="system" className="relative border-t border-line bg-canvas lg:min-h-[210dvh]">
      <div className="flex items-center overflow-hidden lg:sticky lg:top-[72px] lg:min-h-[calc(100dvh-72px)]">
        <div className="mx-auto grid w-full max-w-[1440px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-12">
          <div className="self-center">
            <p className="section-kicker">The workflow we set up with you</p>
            <h2 className="section-title mt-5 max-w-[10ch]">A clear next step for every request.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-ink-muted">
              The exact actions depend on your setup and verified connections. We agree the booking rules and human handoff before launch.
            </p>
            <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Explore workflow steps">
              {story.map((item, index) => (
                <button
                  key={item.number}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-pressed={active === index}
                  className={`min-h-11 border px-3 py-2 text-left text-xs font-medium transition-colors ${active === index ? "border-ink bg-ink text-white" : "border-line-strong text-ink-muted hover:bg-white"}`}
                >
                  {item.number} {item.title}
                </button>
              ))}
            </div>
            <div className="mt-8 hidden gap-2 lg:flex" aria-hidden="true">
              {story.map((item, index) => (
                <span key={item.number} className={`h-1 flex-1 transition-colors duration-500 ${index <= active ? "bg-signal" : "bg-line-strong"}`} />
              ))}
            </div>
          </div>

          <div className="relative min-h-[480px] overflow-hidden border border-line-strong bg-ink p-5 text-white shadow-[0_30px_90px_rgba(18,19,17,0.16)] sm:p-8">
            <div className="absolute inset-0 operations-grid opacity-25" aria-hidden="true" />
            <div className="relative flex h-full min-h-[420px] flex-col">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">Example workflow</span>
                <span className="font-mono text-[10px] text-signal">STEP {current.number} / 0{story.length}</span>
              </div>

              <div className="grid flex-1 items-center gap-8 py-10 sm:grid-cols-[auto_1fr]">
                <motion.div
                  key={`icon-${current.number}`}
                  initial={false}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.45 }}
                  className="flex h-24 w-24 items-center justify-center bg-signal text-ink sm:h-32 sm:w-32"
                >
                  <CurrentIcon size={52} weight="duotone" />
                </motion.div>

                <motion.div
                  key={current.number}
                  initial={false}
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
