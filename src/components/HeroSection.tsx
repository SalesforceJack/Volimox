import { cn } from "@/lib/utils"

interface LiveMetric {
  label: string
  value: string
  sublabel: string
}

const liveMetrics: LiveMetric[] = [
  { label: "Interactions Processed", value: "142,904", sublabel: "Across all active deployments" },
  { label: "Avg. Settlement Time", value: "42s", sublabel: "From inquiry to quote" },
  { label: "Hallucination Rate", value: "0.00%", sublabel: "Verified over 30 days" },
]

function MetricCard({ metric }: { metric: LiveMetric }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {metric.label}
      </span>
      <span className="text-2xl font-bold tracking-tight text-slate-950">
        {metric.value}
      </span>
      <span className="text-xs text-slate-400">{metric.sublabel}</span>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-white via-slate-50 to-zinc-100">
      {/* Subtle mesh grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.07) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Soft radial glow — top-right */}
      <div className="pointer-events-none absolute -right-48 -top-48 h-[600px] w-[600px] rounded-full bg-amber-200/20 blur-[120px]" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28 lg:px-8">
        {/* Eyebrow badge */}
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1 text-xs font-medium text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Enterprise AI — Production Ready
        </div>

        {/* Headline */}
        <h1 className="max-w-4xl text-center text-4xl font-bold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl md:text-6xl lg:text-7xl">
          Deploy AI Agents That
          <br />
          <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
            Run Your Operations
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 max-w-2xl text-center text-base leading-relaxed text-slate-600 sm:text-lg">
          Volimox builds purpose-built AI agents for logistics, manufacturing, real estate,
          and healthcare — not chatbots, but autonomous operational systems that dispatch
          fleets, triage patients, and reconcile supply chains.
        </p>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#lead-estimator"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-6 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-slate-800 hover:shadow-md active:scale-[0.98]"
          >
            Deploy Your Agent
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <a
            href="#enterprise-showcase"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.98]"
          >
            View Case Studies
          </a>
        </div>

        {/* Live metrics row */}
        <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {liveMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>

        {/* Technical vocabulary strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs font-medium text-slate-400">
          <span>Retell AI</span>
          <span className="h-3 w-px bg-slate-200" />
          <span>Firebase</span>
          <span className="h-3 w-px bg-slate-200" />
          <span>Next.js 15</span>
          <span className="h-3 w-px bg-slate-200" />
          <span>Stripe</span>
          <span className="h-3 w-px bg-slate-200" />
          <span>Twilio</span>
          <span className="h-3 w-px bg-slate-200" />
          <span>PostgreSQL</span>
        </div>
      </div>
    </section>
  )
}
