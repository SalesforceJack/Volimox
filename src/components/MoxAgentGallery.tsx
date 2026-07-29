"use client"

import { useState } from "react"
import { ArrowRight, FlowerLotus, Scales, Tooth, Wrench } from "@phosphor-icons/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ProtonLiveBooking } from "@/components/ProtonLiveBooking"
import { MOX_AGENTS, type MoxAgentId } from "@/lib/mox-agents"

type GalleryCard = {
  id: MoxAgentId
  icon?: typeof Tooth
  image?: { src: string; alt: string; zoom: string }
}

const cards: GalleryCard[] = [
  { id: "dental", icon: Tooth },
  { id: "law", icon: Scales },
  { id: "orthodontics", image: { src: "/agent-cards/orthodontics-emoji-clean.png", alt: "Braces smile orthodontics mark", zoom: "scale-[1.02]" } },
  { id: "auto-repair", icon: Wrench },
  { id: "med-spa", icon: FlowerLotus },
  { id: "massage", image: { src: "/agent-cards/massage-themed-v2-small.png", alt: "Editorial head massage mark", zoom: "scale-[1.15]" } },
]

export function MoxAgentGallery() {
  const [active, setActive] = useState<MoxAgentId | null>(null)
  const reduceMotion = useReducedMotion()
  const profile = active ? MOX_AGENTS[active] : null

  return (
    <section id="agents" className="border-b border-line bg-canvas-muted py-24 text-ink sm:py-32">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-4xl">
          <h2 className="max-w-[11ch] text-[clamp(3rem,5vw,5.8rem)] font-semibold leading-[.92] tracking-[-.065em]">One system. Different work.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">Choose an example business. One shared voice stage loads the intake and handoff designed for that industry.</p>
          <div className="mt-7 inline-flex items-center gap-2 border-y border-line py-3 font-mono text-[10px] uppercase tracking-[.14em] text-ink-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-signal" aria-hidden="true" />
            Click a card to try the agent
            <ArrowRight size={14} className="text-ink-faint" />
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Choose an example agent">
          {cards.map(({ id, icon: Icon, image }) => {
            const item = MOX_AGENTS[id]
            const selected = active === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                aria-label={`Try the ${item.name} agent`}
                onClick={() => setActive(id)}
                className={`group flex min-h-36 w-full cursor-pointer flex-col justify-between border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${selected ? "border-ink bg-ink text-white" : "border-line-strong bg-canvas hover:border-ink hover:bg-white"}`}
              >
                <div className="flex items-start justify-between gap-5">
                  {image ? (
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden">
                      <img src={image.src} alt={image.alt} className={`h-full w-full object-contain ${image.zoom} ${selected ? "opacity-95" : "opacity-90"}`} />
                    </span>
                  ) : Icon ? <Icon size={24} weight="duotone" /> : null}
                  <ArrowRight size={16} className={`transition-transform group-hover:translate-x-1 ${selected ? "text-signal" : "text-ink-faint"}`} />
                </div>
                <div>
                  <p className={`text-xs font-semibold ${selected ? "text-signal" : "text-ink-faint"}`}>{item.eyebrow}</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-.03em]">{item.name}</p>
                  <span className={`mt-4 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.12em] ${selected ? "text-signal" : "text-ink-faint"}`}>
                    Try the agent
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {profile ? (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
              className="mt-5 border border-line-strong bg-ink p-4 text-white sm:p-8"
            >
              <div className="mb-6 flex items-start justify-between gap-5 border-b border-white/15 pb-6">
                <div><p className="text-xs font-semibold text-signal">Selected example</p><h3 className="mt-2 text-3xl font-semibold tracking-[-.05em]">{profile.name}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-white/45">{profile.description}</p></div>
                <button type="button" onClick={() => setActive(null)} className="text-sm text-white/45 transition-colors hover:text-white">Close</button>
              </div>
              <ProtonLiveBooking key={profile.id} agentId={profile.id} compact />
            </motion.div>
          ) : (
            <motion.div key="gallery-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 flex min-h-28 items-center justify-between gap-6 border border-line-strong bg-canvas p-5 sm:p-7">
              <p className="max-w-xl text-sm leading-6 text-ink-muted">Select a business above to open its real live agent. The flagship Limo demo remains available in the section above.</p>
              <ArrowRight size={20} className="hidden text-ink-faint sm:block" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
