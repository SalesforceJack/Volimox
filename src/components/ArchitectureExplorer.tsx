"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  Buildings,
  Factory,
  Heartbeat,
  MapTrifold,
  type Icon,
} from "@phosphor-icons/react"

type Architecture = {
  id: string
  name: string
  status: string
  title: string
  copy: string
  input: string
  logic: string
  outcome: string
  icon: Icon
}

const architectures: Architecture[] = [
  {
    id: "fleet",
    name: "Fleet",
    status: "Production reference",
    title: "Premium transportation operations",
    copy: "A voice-first booking system that structures trip details, calculates a deterministic quote, secures payment, and coordinates fulfillment.",
    input: "Voice, web chat, SMS",
    logic: "Route, vehicle, price, consent",
    outcome: "Payment, dispatch, CRM record",
    icon: MapTrifold,
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    status: "Reference architecture",
    title: "Order and exception orchestration",
    copy: "A system blueprint for normalizing inbound purchase requests, validating inventory and constraints, then routing approved work into ERP fulfillment.",
    input: "Email, EDI, support line",
    logic: "SKU, stock, freight, approval",
    outcome: "Quote, order, ERP update",
    icon: Factory,
  },
  {
    id: "property",
    name: "Real estate",
    status: "Reference architecture",
    title: "Lead-to-appointment operations",
    copy: "A system blueprint for capturing inquiries, applying qualification criteria, coordinating availability, and handing complete context to the right agent.",
    input: "Portal, phone, web form",
    logic: "Intent, fit, availability, owner",
    outcome: "Appointment, CRM, follow-up",
    icon: Buildings,
  },
  {
    id: "health",
    name: "Healthcare",
    status: "Reference architecture",
    title: "Patient logistics coordination",
    copy: "A guarded architecture for administrative intake, appointment coordination, transport matching, and human escalation without making clinical decisions.",
    input: "Portal, phone, referral",
    logic: "Policy, scheduling, transport",
    outcome: "Booking, handoff, record update",
    icon: Heartbeat,
  },
]

export function ArchitectureExplorer() {
  const [selected, setSelected] = useState(architectures[0])
  const SelectedIcon = selected.icon

  return (
    <div className="grid overflow-hidden border border-line-strong bg-white lg:grid-cols-[0.36fr_0.64fr]">
      <div className="border-b border-line-strong lg:border-b-0 lg:border-r">
        {architectures.map((architecture) => {
          const ItemIcon = architecture.icon
          const active = architecture.id === selected.id
          return (
            <button
              key={architecture.id}
              type="button"
              onClick={() => setSelected(architecture)}
              className={`flex w-full items-center gap-4 border-b border-line px-5 py-5 text-left transition-colors last:border-b-0 ${
                active ? "bg-ink text-white" : "bg-white text-ink hover:bg-canvas-muted"
              }`}
            >
              <ItemIcon size={21} weight={active ? "fill" : "regular"} className={active ? "text-signal" : "text-ink-faint"} />
              <span className="flex-1 text-sm font-semibold">{architecture.name}</span>
              <span className={`font-mono text-[9px] uppercase tracking-[0.13em] ${active ? "text-white/35" : "text-ink-faint"}`}>
                {architecture.id === "fleet" ? "Live" : "Model"}
              </span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="p-6 sm:p-10"
        >
          <div className="flex items-start justify-between gap-6">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{selected.status}</span>
              <h3 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">{selected.title}</h3>
            </div>
            <div className="hidden h-16 w-16 shrink-0 items-center justify-center bg-signal text-ink sm:flex">
              <SelectedIcon size={30} weight="duotone" />
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-ink-muted sm:text-base">{selected.copy}</p>

          <div className="mt-10 grid gap-px bg-line md:grid-cols-3">
            {[
              ["INPUT", selected.input],
              ["DECISION LAYER", selected.logic],
              ["COMPLETED ACTION", selected.outcome],
            ].map(([label, value]) => (
              <div key={label} className="bg-canvas p-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-faint">{label}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-ink">{value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
