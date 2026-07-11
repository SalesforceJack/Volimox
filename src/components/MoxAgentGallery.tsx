"use client"

import { useState } from "react"
import { ArrowRight, CaretDown, Stethoscope, Scales, Wrench, Sparkle, HandPalm } from "@phosphor-icons/react"
import { ProtonLiveBooking } from "@/components/ProtonLiveBooking"
import { MOX_AGENTS, type MoxAgentId } from "@/lib/mox-agents"

const cards: Array<{ id: MoxAgentId; icon: typeof Stethoscope; accent: string }> = [
  { id: "dental", icon: Stethoscope, accent: "border-cyan-300/30" },
  { id: "law", icon: Scales, accent: "border-amber-300/30" },
  { id: "orthodontics", icon: Sparkle, accent: "border-pink-300/30" },
  { id: "auto-repair", icon: Wrench, accent: "border-orange-300/30" },
  { id: "med-spa", icon: HandPalm, accent: "border-emerald-300/30" },
  { id: "massage", icon: Sparkle, accent: "border-violet-300/30" },
]

export function MoxAgentGallery() {
  const [active, setActive] = useState<MoxAgentId | null>(null)
  const profile = active ? MOX_AGENTS[active] : null

  return <section id="agents" className="border-b border-line bg-canvas-muted py-24 text-ink sm:py-32">
    <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
      <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end"><div><p className="section-kicker text-signal">The Mox agent gallery</p><h2 className="mt-5 max-w-[10ch] text-[clamp(3rem,5vw,5.8rem)] font-semibold leading-[.92] tracking-[-.065em]">One system. Different work.</h2></div><p className="max-w-xl text-lg leading-8 text-ink-muted">Choose another example business and let its agent demonstrate the intake, guardrails, and handoff that matter in that world.</p></div>
      <div className="mt-14 grid gap-px bg-line-strong sm:grid-cols-2 lg:grid-cols-3">{cards.map(({ id, icon: Icon }) => { const item = MOX_AGENTS[id]; return <button key={id} type="button" onClick={() => setActive(id)} className="group bg-canvas p-6 text-left transition hover:bg-white"><div className="flex items-start justify-between"><Icon size={26} weight="duotone" className="text-ink" /><ArrowRight size={18} className="text-ink-faint transition group-hover:translate-x-1 group-hover:text-signal" /></div><p className="mt-12 font-mono text-[9px] uppercase tracking-[.17em] text-ink-faint">{item.eyebrow}</p><h3 className="mt-2 text-2xl font-semibold tracking-[-.04em]">{item.name}</h3><p className="mt-3 min-h-14 text-sm leading-6 text-ink-muted">{item.description}</p><span className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-ink">Open demo <CaretDown size={14} className="-rotate-90" /></span></button> })}</div>
      {profile && <div className="mt-8 border border-line-strong bg-ink p-4 text-white sm:p-8"><div className="mb-6 flex items-center justify-between gap-4"><div><p className="font-mono text-[9px] uppercase tracking-[.17em] text-signal">Selected agent</p><h3 className="mt-2 text-3xl font-semibold tracking-[-.05em]">{profile.name}</h3></div><button type="button" onClick={() => setActive(null)} className="text-sm text-white/45 hover:text-white">Close</button></div><ProtonLiveBooking agentId={profile.id} compact /></div>}
    </div>
  </section>
}
