/**
 * Volimox — HeroSection
 *
 * Premium, technically dense hero section for the Volimox B2B AI Agency
 * marketing platform. Server component — no "use client".
 */

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface LiveMetric {
  label: string
  value: string
}

const liveMetrics: LiveMetric[] = [
  { label: "Total Automated Intake Interactions", value: "142,904" },
  { label: "Average Payment Time-To-Settlement", value: "42 seconds" },
  { label: "Hallucination Drift Rate", value: "0.00%" },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ metric }: { metric: LiveMetric }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-pulse" />
        <span className="relative rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
          {metric.label}
        </span>
        <span className="text-lg font-bold tabular-nums tracking-tight text-white sm:text-xl">
          {metric.value}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-zinc-950">
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Radial ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-to-b from-amber-500/[0.04] via-amber-500/[0.01] to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24 sm:pt-36 sm:pb-28 lg:pt-44 lg:pb-32">
        {/* Badge */}
        <div className="mb-8 flex justify-center sm:justify-start">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-zinc-400 backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-pulse" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Enterprise Conversational AI — Production-Proven Architecture
          </span>
        </div>

        {/* Headline */}
        <h1 className="max-w-5xl text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
          We build full-stack autonomous conversational systems that automate
          entry intake, live complex pricing calculation, payment capture, and
          driver dispatch at{" "}
          <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
            enterprise scale
          </span>
          .
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-4xl text-sm leading-relaxed text-zinc-400 sm:text-base sm:leading-relaxed">
          Production-proven across logistics, manufacturing, real estate, and
          outpatient healthcare — powered by the same architecture that
          autonomously orchestrates Proton Limo&rsquo;s entire
          booking-to-dispatch lifecycle. Every deployment ships with
          deterministic state-machine routing, idempotent payment capture,
          CRM-native fulfillment, and immutable system-level behavioral
          guardrails that user-supplied text cannot override.
        </p>

        {/* CTA */}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#lead-estimator"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg",
              "h-10 gap-2 px-5",
              "bg-white text-black text-sm font-medium",
              "transition-all hover:bg-white/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            )}
          >
            Schedule Architecture Review
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>

        {/* Live Metrics Ticker */}
        <div className="mt-16 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-400/80">
              Live Telemetry
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {liveMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </div>

        {/* Technical vocabulary strip */}
        <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-zinc-600">
          <span>Autonomous conversational orchestration</span>
          <span className="hidden sm:inline text-zinc-700">&middot;</span>
          <span>Deterministic state-machine routing</span>
          <span className="hidden sm:inline text-zinc-700">&middot;</span>
          <span>Idempotent payment capture</span>
          <span className="hidden sm:inline text-zinc-700">&middot;</span>
          <span>CRM-native fulfillment</span>
          <span className="hidden sm:inline text-zinc-700">&middot;</span>
          <span>Immutable system-level behavioral guardrails</span>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
