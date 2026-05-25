import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface PillarConfig {
  id: string
  icon: React.ReactNode
  title: string
  badge: string
  accentBorder: string
  accentBg: string
  accentText: string
  accentBadge: string
  iconContainerBg: string
  iconContainerRing: string
  paragraphs: string[]
  references: string[]
}

// ---------------------------------------------------------------------------
// Icon SVGs (inline, server-compatible)
// ---------------------------------------------------------------------------

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  )
}

function LoopIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
      <path d="M17 14v4" />
      <path d="M15 16h4" />
    </svg>
  )
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
      <line x1="12" y1="2" x2="12" y2="6" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Pillar data
// ---------------------------------------------------------------------------

const pillars: PillarConfig[] = [
  {
    id: "prompt-injection",
    icon: <ShieldIcon className="text-rose-400" />,
    title: "Prompt Injection & Hallucination Immunization",
    badge: "Defense-in-Depth Lexical Architecture",
    accentBorder: "border-l-rose-500",
    accentBg: "bg-rose-500/5",
    accentText: "text-rose-300",
    accentBadge: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    iconContainerBg: "bg-rose-500/10",
    iconContainerRing: "ring-rose-500/20",
    paragraphs: [
      "Every Volimox agent deployment is governed by an immutable system-level behavioral appendix that resides outside the conversational context window. This appendix encodes the agent's core operational policy — pricing bounds, geographic constraints, escalation thresholds, and refusal heuristics — as a cryptographically referable policy artifact that user-supplied text cannot mutate, override, or inject into.",
      "Before any user-uttered or user-typed text fragment reaches the LLM context assembler, it traverses a multi-stage lexical filtering pipeline. Stage one strips known delimiter-injection patterns. Stage two applies regex-based semantic boundary detection. Stage three runs the residual sanitized payload through an embedding-distance anomaly detector that flags structurally atypical inputs.",
      "When the inference engine approaches logic boundaries — multi-hop reasoning chains that exceed the agent's pre-configured recursion depth, ambiguous entity resolution where confidence scores fall below 0.7, or requests that would require the model to generate financial or legal commitments outside its authorized scope — the system does not guess. A deterministic fallback tree activates.",
      "This architecture is not theoretical. It is deployed in production within the Proton Limo conversational agent, where dedicated modules implement the lexical filtering and anti-injection pipeline, and an immutable system-level behavioral appendix anchors every agent instance in the runtime.",
    ],
    references: ["retell-abuse-guard.ts", "retell-limi-llm-appendix.md"],
  },
  {
    id: "financial-integrity",
    icon: <LockIcon className="text-emerald-400" />,
    title: "Financial Integrity Enforcement",
    badge: "Mid-Conversation State-Locking & Cryptographic Payment Verification",
    accentBorder: "border-l-emerald-500",
    accentBg: "bg-emerald-500/5",
    accentText: "text-emerald-300",
    accentBadge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    iconContainerBg: "bg-emerald-500/10",
    iconContainerRing: "ring-emerald-500/20",
    paragraphs: [
      "Mid-conversation state-locking is the financial integrity primitive that prevents the most dangerous class of AI commerce failures: post-consent price drift. When the agent presents a quoted price and the customer provides explicit consent, the system generates a cryptographically hashed QuoteIntegrityRecord that freezes quote parameters into an immutable data structure.",
      "Every Stripe payment link embeds a verification hash derived from the consented QuoteIntegrityRecord. Before any PaymentIntent authorization executes, a server-side pre-authorization hook recomputes the expected hash. Amount mismatches, currency substitutions, or added line items all trigger an immediate block with full audit logging.",
      "Unauthorized refund prevention is enforced at the architectural level. The conversational AI agent has zero capability to initiate refunds, voids, or chargebacks. All financial reversals require authenticated human operator intervention through the admin dashboard with append-only audit trails.",
      "These guarantees are implemented in the Proton Limo codebase through dedicated modules managing the QuoteIntegrityRecord lifecycle, pre-authorization verification hooks, and operator-only refund workflows.",
    ],
    references: ["retell-price-consent-integrity.ts", "retell-payment-guards.ts", "retell-payment-approval.ts"],
  },
  {
    id: "anti-loop",
    icon: <LoopIcon className="text-amber-400" />,
    title: "Anti-Loop & Contextual Expiry Protocols",
    badge: "Intelligent Counter Metrics & Graceful Degradation Routing",
    accentBorder: "border-l-amber-500",
    accentBg: "bg-amber-500/5",
    accentText: "text-amber-300",
    accentBadge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    iconContainerBg: "bg-amber-500/10",
    iconContainerRing: "ring-amber-500/20",
    paragraphs: [
      "Conversational loops are among the most insidious failure modes in production AI agents. Volimox deploys an intelligent counter-metric system that instruments every state-machine node with a visit counter. If a caller revisits the same node more than three times without advancing to a downstream state, the system flags a probabilistic loop condition and escalates.",
      "Upon loop detection, graceful degradation routing activates. The first tier attempts a warm transfer to a human agent queue with full conversation context. If no human agent is available within a configurable timeout window, the second tier triggers a voicemail capture flow that records the caller's request and generates a structured callback ticket.",
      "Contextual expiry provides a parallel safeguard. Every conversation session carries a configurable TTL that resets only on meaningful state transitions. If a session exceeds its duration threshold without reaching a terminal state, the system gracefully expires the session and dispatches a summary to the prospect.",
      "These protocols are implemented across the Proton Limo agent's safety layer, orchestrating graceful degradation tiered routing and preventing session collision and duplicate booking attempts.",
    ],
    references: ["retell-abuse-guard.ts", "retell-tool-fallback.ts", "retell-duplicate-guard.ts"],
  },
  {
    id: "geo-fencing",
    icon: <MapPinIcon className="text-blue-400" />,
    title: "Geo-Fencing & Service Limit Verification",
    badge: "Server-Side Coordinate Validation Against Runtime Polygons",
    accentBorder: "border-l-blue-500",
    accentBg: "bg-blue-500/5",
    accentText: "text-blue-300",
    accentBadge: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    iconContainerBg: "bg-blue-500/10",
    iconContainerRing: "ring-blue-500/20",
    paragraphs: [
      "Before any external quoting tool is invoked, pickup and drop-off coordinates pass through a server-side coordinate evaluation pipeline that validates each coordinate pair against runtime GeoJSON polygon boundaries defining the operational service area.",
      "The service area definitions are maintained through a layered validation strategy: O(1) state-level membership check, ZIP-code whitelist for partial-coverage nuances, and precise point-in-polygon tests using GeoJSON boundary definitions for complex metropolitan service areas.",
      "Capacity-aware quoting adds a further safeguard. Even when a coordinate pair passes all geospatial validation layers, the system queries fleet and driver availability for the requested time window before issuing a quote. If capacity cannot be confirmed with high confidence, the agent gracefully declines to quote.",
      "Production implementation spans multiple modules providing multi-layer geospatial validation, fleet availability queries, time-window conflict detection, and route feasibility assessment.",
    ],
    references: ["retell-service-area.ts", "retell-capacity-validation.ts", "retell-route-complexity-validation.ts"],
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PillarCard({ pillar }: { pillar: PillarConfig }) {
  return (
    <Card size="sm" className={cn("group relative overflow-hidden border-white/[0.05] bg-zinc-950/80", "transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]", pillar.accentBorder, "border-l-2")}>
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", pillar.id === "prompt-injection" && "from-rose-500/60 via-rose-500/20 to-transparent", pillar.id === "financial-integrity" && "from-emerald-500/60 via-emerald-500/20 to-transparent", pillar.id === "anti-loop" && "from-amber-500/60 via-amber-500/20 to-transparent", pillar.id === "geo-fencing" && "from-blue-500/60 via-blue-500/20 to-transparent")} />
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1", pillar.iconContainerBg, pillar.iconContainerRing)}>{pillar.icon}</div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <CardTitle className="text-base font-semibold leading-snug text-white">{pillar.title}</CardTitle>
            <Badge variant="outline" className={cn("text-[10px] w-fit", pillar.accentBadge)}>{pillar.badge}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3.5">
          {pillar.paragraphs.map((paragraph, i) => (
            <p key={i} className="text-xs leading-[1.75] text-zinc-400">{paragraph}</p>
          ))}
        </div>
        <div className="mt-5 border-t border-white/[0.04] pt-3.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Module References</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pillar.references.map((ref) => (
              <code key={ref} className={cn("inline-block rounded border px-1.5 py-0.5 font-mono text-[10px]", "border-white/[0.06] bg-white/[0.03] text-zinc-500")}>{ref}</code>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export default function SystemHardening() {
  return (
    <section className="w-full">
      <div className="mb-12">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">System Hardening Protocols</h2>
        <p className="mt-3 text-sm font-medium text-zinc-400 sm:text-base">Enterprise-grade safety guarantees enforced across every agent deployment</p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Volimox deploys a four-pillar safety architecture that operates at every layer of the AI agent stack — from the lexical boundary between user input and model context, through the financial rail that gates every payment authorization, to the runtime orchestration that detects and mitigates conversational failure modes in real time. Each pillar is backed by production-hardened reference implementations in the Proton Limo agent, providing CTOs and enterprise architects with auditable, testable, and deterministic safety guarantees.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {pillars.map((pillar) => (
          <PillarCard key={pillar.id} pillar={pillar} />
        ))}
      </div>
    </section>
  )
}
