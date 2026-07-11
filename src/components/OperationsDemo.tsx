"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  Check,
  CreditCard,
  MapPin,
  PhoneCall,
  SteeringWheel,
} from "@phosphor-icons/react"

const stages = [
  { label: "Intake", detail: "JFK to SoHo · 3 passengers", icon: PhoneCall },
  { label: "Route verified", detail: "18.6 mi · traffic adjusted", icon: MapPin },
  { label: "Quote approved", detail: "$186 · SUV class", icon: Check },
  { label: "Payment secured", detail: "Authorization confirmed", icon: CreditCard },
  { label: "Dispatch complete", detail: "Driver and CRM updated", icon: SteeringWheel },
]

export function OperationsDemo() {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState(reduceMotion ? stages.length - 1 : 0)

  useEffect(() => {
    if (reduceMotion) return
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % stages.length)
    }, 2300)
    return () => window.clearInterval(timer)
  }, [reduceMotion])

  const current = stages[active]
  const CurrentIcon = current.icon

  return (
    <div className="operations-shell w-full min-w-0 max-w-full" aria-label="Live operational workflow demonstration">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <span className="h-2 w-2 bg-signal shadow-[0_0_16px_rgba(244,207,58,0.9)]" />
          Live operation
        </div>
        <div className="font-mono text-[10px] text-white/35">RUN VX-2408</div>
      </div>

      <div className="grid min-w-0 gap-5 p-4 sm:p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Incoming</span>
            <span className="font-mono text-[10px] text-signal">00:42</span>
          </div>
          <div className="border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-white text-ink">
                <PhoneCall size={18} weight="fill" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Airport transfer request</p>
                <p className="mt-1 text-xs leading-5 text-white/45">Voice · New York · Priority customer</p>
              </div>
            </div>
            <div className="mt-5 space-y-2 font-mono text-[10px] text-white/45">
              <TranscriptLine label="PICKUP" value="JFK Terminal 4" delay={0} />
              <TranscriptLine label="DROP" value="SoHo, Manhattan" delay={0.08} />
              <TranscriptLine label="WHEN" value="Tonight · 9:30 PM" delay={0.16} />
            </div>
          </div>
        </div>

        <div className="relative min-w-0 min-h-[250px] border border-white/10 bg-black/20 p-4">
          <div className="absolute bottom-0 left-6 top-0 w-px bg-white/10" aria-hidden="true" />
          <div className="relative space-y-3">
            {stages.map((stage, index) => {
              const StageIcon = stage.icon
              const completed = index < active
              const isActive = index === active
              return (
                <motion.div
                  key={stage.label}
                  initial={false}
                  animate={{ opacity: index <= active ? 1 : 0.35, x: isActive ? 4 : 0 }}
                  transition={{ duration: 0.35 }}
                  className="relative flex items-center gap-3"
                >
                  <div
                    className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center border ${
                      completed || isActive ? "border-signal bg-signal text-ink" : "border-white/20 bg-ink text-white/30"
                    }`}
                  >
                    {completed ? <Check size={11} weight="bold" /> : <StageIcon size={11} weight="bold" />}
                  </div>
                  <div className={`min-w-0 flex-1 border px-3 py-2.5 ${isActive ? "border-signal/60 bg-signal/10" : "border-white/10 bg-white/[0.025]"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-white">{stage.label}</span>
                      {completed && <span className="font-mono text-[9px] text-signal">DONE</span>}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-white/40">{stage.detail}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-4 sm:px-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center bg-signal text-ink">
              <CurrentIcon size={17} weight="bold" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">{current.label}</p>
              <p className="truncate text-[10px] text-white/40">{current.detail}</p>
            </div>
            <ArrowRight size={15} className="text-signal" />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function TranscriptLine({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className="grid grid-cols-[64px_1fr] gap-3 border-t border-white/[0.07] pt-2"
    >
      <span className="text-white/25">{label}</span>
      <span className="truncate text-white/65">{value}</span>
    </motion.div>
  )
}
