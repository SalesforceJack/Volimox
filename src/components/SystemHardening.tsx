import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/* ─── Types ─── */

interface PillarConfig {
  title: string
  description: string
  details: string[]
  moduleRef: string
  accentColor: string
  accentBorder: string
  iconBg: string
  iconRing: string
  iconColor: string
}

/* ─── Inline SVG Icons ─── */

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}

function LoopIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  )
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/* ─── Code-block label helper ─── */

function CodeRef({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
      {label}
    </span>
  )
}

/* ─── Pillar Configuration ─── */

const pillars: PillarConfig[] = [
  {
    title: "Hallucination Containment & Fallback Trees",
    description:
      "When LLM confidence scores drop below configurable threshold, the stateless proxy middleware intercepts the runtime token stream and shifts execution to a deterministic JSON state machine or triggers an API-based human-in-the-loop callback. Does not prevent hallucinations — contains and routes around them.",
    details: [
      "Confidence-score threshold monitoring on every LLM response token stream via proxy interceptor",
      "Deterministic JSON state-machine fallback — quote computation, slot validation, and payment amounts bypass LLM entirely",
      "Human-in-the-loop callback via webhook when automated containment cannot resolve ambiguity",
    ],
    moduleRef: "src/lib/retell-abuse-guard.ts",
    accentColor: "text-rose-600",
    accentBorder: "border-l-rose-500",
    iconBg: "bg-rose-50/80",
    iconRing: "ring-rose-200/50",
    iconColor: "text-rose-600",
  },
  {
    title: "Financial Integrity Layer",
    description:
      "Deterministic quote computation with cryptographic price-consent binding. The LLM never computes numeric values — it extracts structured slot data, then a stateless TypeScript engine computes pricing. Quote hashes are signed at offer and verified at payment to detect tampering.",
    details: [
      "Cryptographic price-consent binding — quote hash signed at offer via HMAC-SHA256, verified at payment",
      "Deterministic quote engine with zero LLM influence on numeric computation — pricing runs in isolated TypeScript runtime",
      "Payment guardrails enforcing pre-authorisation holds before service delivery; failed holds trigger escalation path",
    ],
    moduleRef: "src/lib/retell-price-consent-integrity.ts",
    accentColor: "text-amber-600",
    accentBorder: "border-l-amber-500",
    iconBg: "bg-amber-50/80",
    iconRing: "ring-amber-200/50",
    iconColor: "text-amber-600",
  },
  {
    title: "Anti-Loop & Circuit Breakers",
    description:
      "Configurable turn-count limits, semantic repetition detectors, and per-session API cost budgets prevent infinite loops and runaway compute costs. When thresholds are breached, the circuit breaker triggers a graceful handoff to a human operator rather than continuing degraded automation.",
    details: [
      "Configurable turn-count limits with graceful handoff to human operators via escalation webhook",
      "Semantic repetition detection — n-gram overlap analysis triggers circuit breaker before cost overrun",
      "Per-session API cost budgeting with automatic tool-call suspension at configurable limits",
    ],
    moduleRef: "src/lib/retell-duplicate-guard.ts",
    accentColor: "text-emerald-600",
    accentBorder: "border-l-emerald-500",
    iconBg: "bg-emerald-50/80",
    iconRing: "ring-emerald-200/50",
    iconColor: "text-emerald-600",
  },
  {
    title: "Geo-Fencing & Service Boundaries",
    description:
      "Spatial operation limits enforced via Google Maps Routes API radius checks, airport-code validation against FAA/IATA registries, and jurisdiction-aware tax computation. Out-of-bounds requests are rejected with structured error payloads rather than hallucinated service areas.",
    details: [
      "Service-radius enforcement with configurable geo-fence polygons per deployment — out-of-bounds requests return structured rejection",
      "Airport-code validation against FAA/IATA registries for limo/transit use cases; unknown codes trigger human verification",
      "Jurisdiction-aware sales-tax computation using validated pickup/dropoff addresses with fallback to base rate on ambiguity",
    ],
    moduleRef: "src/lib/retell-service-area.ts",
    accentColor: "text-sky-600",
    accentBorder: "border-l-sky-500",
    iconBg: "bg-sky-50/80",
    iconRing: "ring-sky-200/50",
    iconColor: "text-sky-600",
  },
]

/* ─── Pillar Card ─── */

function PillarCard({ pillar }: { pillar: PillarConfig }) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md",
        pillar.accentBorder,
        "border-l-2",
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-4">
          {/* Icon container */}
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1",
              pillar.iconBg,
              pillar.iconRing,
            )}
          >
            {pillar.title.startsWith("Hallucination Containment") && <ShieldIcon className={pillar.iconColor} />}
            {pillar.title === "Financial Integrity Layer" && <LockIcon className={pillar.iconColor} />}
            {pillar.title === "Anti-Loop & Circuit Breakers" && <LoopIcon className={pillar.iconColor} />}
            {pillar.title === "Geo-Fencing & Service Boundaries" && <MapPinIcon className={pillar.iconColor} />}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <CardTitle className="text-base text-slate-900">{pillar.title}</CardTitle>
            <CardDescription className="mt-1 text-sm leading-relaxed text-slate-600">
              {pillar.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="mb-4 space-y-2">
          {pillar.details.map((detail) => (
            <li key={detail} className="flex items-start gap-2 text-xs text-slate-600">
              <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", pillar.iconColor.replace("text-", "bg-"))} />
              {detail}
            </li>
          ))}
        </ul>
        <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/60 bg-slate-50 px-2.5 py-1 text-[11px] font-mono text-slate-500">
          <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          {pillar.moduleRef}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Root Component ─── */

export default function SystemHardening() {
  return (
    <section className="w-full" id="system-hardening">
      <div className="grid gap-6 md:grid-cols-2">
        {pillars.map((pillar) => (
          <PillarCard key={pillar.title} pillar={pillar} />
        ))}
      </div>
    </section>
  )
}
