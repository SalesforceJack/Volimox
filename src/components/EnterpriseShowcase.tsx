"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import enterpriseVerticals, { type EnterpriseVertical } from "@/config/enterpriseVerticals"

// ---------------------------------------------------------------------------
// Color schemes per vertical
// ---------------------------------------------------------------------------

type SectorScheme = {
  tabActive: string
  accentBorder: string
  accentBg: string
  accentText: string
  accentBadge: string
  pipelineGradient: string
  stageBorder: string
  stageBg: string
  stageNumberGradient: string
  metricAccent: string
  sectionTitleAccent: string
}

const sectorSchemes: Record<string, SectorScheme> = {
  "logistics-fleet": {
    tabActive: "data-[active]:bg-indigo-900/60 data-[active]:text-indigo-100 data-[active]:border-indigo-500/40",
    accentBorder: "border-amber-500/40",
    accentBg: "bg-amber-500/8",
    accentText: "text-amber-400",
    accentBadge: "border-amber-500/30 bg-amber-500/15 text-amber-400",
    pipelineGradient: "from-indigo-500 to-blue-500",
    stageBorder: "border-indigo-400/20",
    stageBg: "bg-indigo-950/30",
    stageNumberGradient: "from-indigo-500 to-blue-600",
    metricAccent: "text-indigo-400",
    sectionTitleAccent: "text-indigo-300",
  },
  "manufacturing-supply-chain": {
    tabActive: "data-[active]:bg-amber-900/50 data-[active]:text-amber-100 data-[active]:border-amber-500/40",
    accentBorder: "border-amber-500/30",
    accentBg: "bg-amber-500/8",
    accentText: "text-amber-400",
    accentBadge: "border-amber-500/30 bg-amber-500/15 text-amber-400",
    pipelineGradient: "from-amber-500 to-orange-600",
    stageBorder: "border-amber-400/20",
    stageBg: "bg-amber-950/30",
    stageNumberGradient: "from-amber-500 to-orange-600",
    metricAccent: "text-amber-400",
    sectionTitleAccent: "text-amber-300",
  },
  "real-estate-operations": {
    tabActive: "data-[active]:bg-emerald-900/50 data-[active]:text-emerald-100 data-[active]:border-emerald-500/40",
    accentBorder: "border-emerald-500/30",
    accentBg: "bg-emerald-500/8",
    accentText: "text-emerald-400",
    accentBadge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
    pipelineGradient: "from-emerald-500 to-green-600",
    stageBorder: "border-emerald-400/20",
    stageBg: "bg-emerald-950/30",
    stageNumberGradient: "from-emerald-500 to-green-600",
    metricAccent: "text-emerald-400",
    sectionTitleAccent: "text-emerald-300",
  },
  "healthcare-triage": {
    tabActive: "data-[active]:bg-teal-900/50 data-[active]:text-teal-100 data-[active]:border-teal-500/40",
    accentBorder: "border-teal-500/30",
    accentBg: "bg-teal-500/8",
    accentText: "text-teal-400",
    accentBadge: "border-teal-500/30 bg-teal-500/15 text-teal-400",
    pipelineGradient: "from-teal-500 to-cyan-600",
    stageBorder: "border-teal-400/20",
    stageBg: "bg-teal-950/30",
    stageNumberGradient: "from-teal-500 to-cyan-600",
    metricAccent: "text-teal-400",
    sectionTitleAccent: "text-teal-300",
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString("en-US")
}

function getScheme(id: string): SectorScheme {
  return sectorSchemes[id] ?? sectorSchemes["logistics-fleet"]!
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricsBar({ metrics, scheme }: { metrics: EnterpriseVertical["metrics"]; scheme: SectorScheme }) {
  const items = [
    { label: "Automated Interactions", value: formatNumber(metrics.automatedInteractions) },
    { label: "Avg. Settlement Time", value: `${metrics.avgSettlementTimeSec}s` },
    { label: "Hallucination Drift Rate", value: metrics.hallucinationRate },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4">
          <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">{item.value}</span>
          <span className="text-center text-[11px] leading-tight text-muted-foreground sm:text-xs">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function PipelineStageCard({ stage, index, total, scheme }: { stage: EnterpriseVertical["pipelineStages"][number]; index: number; total: number; scheme: SectorScheme }) {
  return (
    <>
      <div className={cn("relative flex flex-1 flex-col gap-2.5 rounded-xl border p-4 min-w-0", scheme.stageBorder, scheme.stageBg, "transition-shadow duration-300 hover:shadow-lg")}>
        <div className="flex items-center gap-2.5">
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", "bg-gradient-to-br", scheme.stageNumberGradient)}>
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-white">{stage.label}</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{stage.description}</p>
        <p className="mt-auto border-t border-white/[0.04] pt-2.5 text-[10px] leading-relaxed text-muted-foreground/55 italic">{stage.technicalDetail}</p>
      </div>
      {index < total - 1 && (
        <div className="flex shrink-0 items-center justify-center px-0.5 text-muted-foreground/30">
          <svg className="hidden h-5 w-5 md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <svg className="h-5 w-5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}
    </>
  )
}

function PipelineDiagram({ stages, scheme }: { stages: EnterpriseVertical["pipelineStages"]; scheme: SectorScheme }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
      {stages.map((stage, i) => (
        <PipelineStageCard key={stage.label} stage={stage} index={i} total={stages.length} scheme={scheme} />
      ))}
    </div>
  )
}

function TriggersAndLogicColumns({ triggers, logic, scheme }: { triggers: string[]; logic: string[]; scheme: SectorScheme }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card size="sm" className="border-white/[0.06] bg-white/[0.01]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className={cn("flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white", "bg-gradient-to-br", scheme.pipelineGradient)}>&darr;</span>
            Inbound Triggers
          </CardTitle>
          <CardDescription>How customer interactions enter the AI system</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {triggers.map((t) => (
              <li key={t} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", scheme.accentBg, "ring-1", scheme.accentBorder)} />
                {t}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card size="sm" className="border-white/[0.06] bg-white/[0.01]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className={cn("flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white", "bg-gradient-to-br", scheme.pipelineGradient)}>&#x1F9E0;</span>
            Core Agent Logic
          </CardTitle>
          <CardDescription>What the AI agent reasons about at runtime</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {logic.map((l) => (
              <li key={l} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", scheme.accentBg, "ring-1", scheme.accentBorder)} />
                {l}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function IntegrationGrid({ integrations, scheme }: { integrations: EnterpriseVertical["integrations"]; scheme: SectorScheme }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {integrations.map((integration) => (
        <div key={integration.name} className={cn("flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.01] p-4", "transition-shadow duration-300 hover:shadow-md", integration.isProductionProven && scheme.accentBorder)}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-white/10 text-[10px]">{integration.category}</Badge>
            {integration.isProductionProven && (
              <Badge variant="outline" className="gap-1 border-green-500/30 bg-green-500/10 text-[10px] text-green-400">
                <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Production Proven
              </Badge>
            )}
          </div>
          <span className="text-sm font-semibold text-white">{integration.name}</span>
          <p className="text-xs leading-relaxed text-muted-foreground">{integration.description}</p>
        </div>
      ))}
    </div>
  )
}

function CaseStudyCard({ caseStudy, scheme, isFlagship }: { caseStudy: EnterpriseVertical["caseStudy"]; scheme: SectorScheme; isFlagship: boolean }) {
  const isProduction = caseStudy.status === "production"
  return (
    <Card size="sm" className={cn("relative overflow-hidden border-white/[0.08] bg-white/[0.02]", isProduction && "border-amber-500/20", isFlagship && "shadow-[0_0_40px_rgba(245,158,11,0.08)]")}>
      {isFlagship && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />}
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base text-white">{caseStudy.name}</CardTitle>
          <Badge variant="outline" className={cn("text-[10px]", isProduction ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-blue-500/30 bg-blue-500/10 text-blue-400")}>
            {isProduction ? "Production" : "Reference Architecture"}
          </Badge>
        </div>
        <CardDescription>{caseStudy.description}</CardDescription>
      </CardHeader>
      {isFlagship && (
        <CardContent>
          <p className={cn("text-xs font-medium", scheme.accentText)}>Active Production-Grade Benchmark — Containerized and deployed at scale.</p>
        </CardContent>
      )}
    </Card>
  )
}

function SectorContent({ vertical }: { vertical: EnterpriseVertical }) {
  const scheme = getScheme(vertical.id)
  const isFlagship = vertical.id === "logistics-fleet"
  const isProduction = vertical.caseStudy.status === "production"

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{vertical.title}</h2>
          <Badge variant="outline" className={cn("text-[11px]", isProduction ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-blue-500/30 bg-blue-500/10 text-blue-400")}>
            {isProduction ? "Production" : "Reference Architecture"}
          </Badge>
          {isFlagship && <Badge variant="outline" className={scheme.accentBadge}>⭐ Flagship</Badge>}
        </div>
        <p className="text-sm font-medium text-muted-foreground sm:text-base">{vertical.subtitle}</p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground/80">{vertical.description}</p>
      </div>
      <div>
        <h3 className={cn("mb-3 text-xs font-semibold uppercase tracking-widest", scheme.sectionTitleAccent)}>Performance Metrics</h3>
        <MetricsBar metrics={vertical.metrics} scheme={scheme} />
      </div>
      <div>
        <h3 className={cn("mb-4 text-xs font-semibold uppercase tracking-widest", scheme.sectionTitleAccent)}>Pipeline Architecture</h3>
        <PipelineDiagram stages={vertical.pipelineStages} scheme={scheme} />
      </div>
      <div>
        <h3 className={cn("mb-4 text-xs font-semibold uppercase tracking-widest", scheme.sectionTitleAccent)}>Intake & Intelligence</h3>
        <TriggersAndLogicColumns triggers={vertical.inboundTriggers} logic={vertical.coreAgentLogic} scheme={scheme} />
      </div>
      <div>
        <h3 className={cn("mb-4 text-xs font-semibold uppercase tracking-widest", scheme.sectionTitleAccent)}>Enterprise Integrations</h3>
        <IntegrationGrid integrations={vertical.integrations} scheme={scheme} />
      </div>
      <div>
        <h3 className={cn("mb-4 text-xs font-semibold uppercase tracking-widest", scheme.sectionTitleAccent)}>Case Study</h3>
        <CaseStudyCard caseStudy={vertical.caseStudy} scheme={scheme} isFlagship={isFlagship} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export default function EnterpriseShowcase() {
  const defaultValue = enterpriseVerticals[0]?.id ?? ""
  const [activeTab, setActiveTab] = useState<string>(defaultValue)

  return (
    <section className="w-full">
      <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)}>
        <TabsList className="mb-10 w-full justify-start overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {enterpriseVerticals.map((vertical) => {
            const scheme = getScheme(vertical.id)
            return (
              <TabsTrigger
                key={vertical.id}
                value={vertical.id}
                className={cn("whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-all duration-200", scheme.tabActive)}
              >
                {vertical.title}
              </TabsTrigger>
            )
          })}
        </TabsList>
        {enterpriseVerticals.map((vertical) => (
          <TabsContent key={vertical.id} value={vertical.id}>
            <SectorContent vertical={vertical} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
