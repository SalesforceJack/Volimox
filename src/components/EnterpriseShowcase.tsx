"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { enterpriseVerticals, type EnterpriseVertical } from "@/config/enterpriseVerticals"

/* ─── Sector colour scheme ─── */
type SectorScheme = {
  tabBg: string
  tabActive: string
  tabText: string
  accent: string
  accentBorder: string
  badgeBg: string
  badgeText: string
  iconColor: string
  cardBorder: string
}

const sectorSchemes: Record<string, SectorScheme> = {
  "logistics-fleet": {
    tabBg: "data-[state=active]:bg-white data-[state=active]:shadow-sm",
    tabActive: "text-indigo-700",
    tabText: "text-slate-500 data-[state=active]:text-indigo-700",
    accent: "bg-indigo-50 text-indigo-700",
    accentBorder: "border-indigo-200",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    iconColor: "text-indigo-600",
    cardBorder: "border-slate-200",
  },
  "manufacturing-supply-chain": {
    tabBg: "data-[state=active]:bg-white data-[state=active]:shadow-sm",
    tabActive: "text-amber-700",
    tabText: "text-slate-500 data-[state=active]:text-amber-700",
    accent: "bg-amber-50 text-amber-700",
    accentBorder: "border-amber-200",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    iconColor: "text-amber-600",
    cardBorder: "border-slate-200",
  },
  "real-estate-operations": {
    tabBg: "data-[state=active]:bg-white data-[state=active]:shadow-sm",
    tabActive: "text-emerald-700",
    tabText: "text-slate-500 data-[state=active]:text-emerald-700",
    accent: "bg-emerald-50 text-emerald-700",
    accentBorder: "border-emerald-200",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    iconColor: "text-emerald-600",
    cardBorder: "border-slate-200",
  },
  "healthcare-triage": {
    tabBg: "data-[state=active]:bg-white data-[state=active]:shadow-sm",
    tabActive: "text-teal-700",
    tabText: "text-slate-500 data-[state=active]:text-teal-700",
    accent: "bg-teal-50 text-teal-700",
    accentBorder: "border-teal-200",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-700",
    iconColor: "text-teal-600",
    cardBorder: "border-slate-200",
  },
}

/* ─── Sub-components ─── */

function MetricsBar({
  metrics,
  scheme,
}: {
  metrics: EnterpriseVertical["metrics"]
  scheme: SectorScheme
}) {
  const items = [
    { label: "Automated Interactions", value: metrics.automatedInteractions.toLocaleString() },
    { label: "Avg. Settlement", value: `${metrics.avgSettlementTimeSec}s` },
    { label: "Hallucination Rate", value: metrics.hallucinationRate },
  ]
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "rounded-lg border bg-white px-3.5 py-3 text-center shadow-sm transition-shadow hover:shadow-md",
            scheme.cardBorder,
          )}
        >
          <div className={cn("text-lg font-bold tracking-tight", scheme.tabActive)}>
            {item.value}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

function PipelineStageCard({
  stage,
  index,
  total,
  scheme,
}: {
  stage: EnterpriseVertical["pipelineStages"][number]
  index: number
  total: number
  scheme: SectorScheme
}) {
  return (
    <>
      <div className="flex items-start gap-4">
        {/* Step number */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
            scheme.accentBorder,
            scheme.accent,
          )}
        >
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900">{stage.label}</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{stage.description}</p>
        </div>
      </div>
      {index < total - 1 && (
        <div className="ml-4 h-6 w-px bg-slate-200" />
      )}
    </>
  )
}

function PipelineDiagram({
  stages,
  scheme,
}: {
  stages: EnterpriseVertical["pipelineStages"]
  scheme: SectorScheme
}) {
  return (
    <Card className={cn("border bg-white shadow-sm", scheme.cardBorder)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
          <svg className={cn("h-4 w-4", scheme.iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Pipeline Stages
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Autonomous execution flow
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          {stages.map((stage, i) => (
            <PipelineStageCard
              key={stage.label}
              stage={stage}
              index={i}
              total={stages.length}
              scheme={scheme}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TriggersAndLogicColumns({
  triggers,
  logic,
  scheme,
}: {
  triggers: string[]
  logic: string[]
  scheme: SectorScheme
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className={cn("border bg-white shadow-sm", scheme.cardBorder)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
            <svg className={cn("h-4 w-4", scheme.iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Trigger Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {triggers.map((t) => (
              <li key={t} className="flex items-center gap-2 text-xs text-slate-600">
                <span className={cn("h-1.5 w-1.5 rounded-full", scheme.iconColor.replace("text-", "bg-"))} />
                {t}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className={cn("border bg-white shadow-sm", scheme.cardBorder)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
            <svg className={cn("h-4 w-4", scheme.iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Core Agent Logic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {logic.map((l) => (
              <li key={l} className="flex items-center gap-2 text-xs text-slate-600">
                <span className={cn("h-1.5 w-1.5 rounded-full", scheme.iconColor.replace("text-", "bg-"))} />
                {l}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function IntegrationGrid({
  integrations,
  scheme,
}: {
  integrations: EnterpriseVertical["integrations"]
  scheme: SectorScheme
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {integrations.map((integration) => (
        <div
          key={integration.name}
          className={cn(
            "flex flex-col gap-1.5 rounded-lg border bg-white px-3.5 py-3 shadow-sm transition-shadow hover:shadow-md",
            scheme.cardBorder,
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">{integration.name}</span>
            {integration.isProductionProven && (
              <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-slate-400">{integration.description}</span>
        </div>
      ))}
    </div>
  )
}

function CaseStudyCard({
  caseStudy,
  scheme,
  isFlagship,
}: {
  caseStudy: EnterpriseVertical["caseStudy"]
  scheme: SectorScheme
  isFlagship: boolean
}) {
  const isProduction = caseStudy.status === "production"
  return (
    <Card
      className={cn(
        "relative overflow-hidden border bg-white shadow-sm transition-shadow hover:shadow-md",
        scheme.cardBorder,
        isFlagship && "ring-1 ring-amber-200",
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-slate-900">{caseStudy.name}</CardTitle>
            <CardDescription className="mt-0.5 text-xs text-slate-400">
              {isProduction ? "Production-Grade Deployment" : "Reference Architecture"}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px]",
              isProduction
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {isProduction ? "Production" : "Pilot"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs leading-relaxed text-slate-600">{caseStudy.description}</p>
      </CardContent>
    </Card>
  )
}

/* ─── Sector content panel ─── */

function SectorContent({ vertical }: { vertical: EnterpriseVertical }) {
  const scheme = sectorSchemes[vertical.id] ?? sectorSchemes["logistics-fleet"]

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">{vertical.title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          {vertical.description}
        </p>
      </div>

      {/* Metrics */}
      <MetricsBar metrics={vertical.metrics} scheme={scheme} />

      {/* Pipeline + Triggers */}
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PipelineDiagram stages={vertical.pipelineStages} scheme={scheme} />
        </div>
        <div className="lg:col-span-2">
          <TriggersAndLogicColumns
            triggers={vertical.inboundTriggers}
            logic={vertical.coreAgentLogic}
            scheme={scheme}
          />
        </div>
      </div>

      {/* Integrations */}
      <div>
        <h4 className="mb-4 text-sm font-semibold text-slate-900">Integrations</h4>
        <IntegrationGrid integrations={vertical.integrations} scheme={scheme} />
      </div>

      {/* Case study */}
      <div>
        <h4 className="mb-4 text-sm font-semibold text-slate-900">
          {vertical.id === "logistics-fleet" ? "Flagship Deployment" : "Case Study"}
        </h4>
        <CaseStudyCard
          caseStudy={vertical.caseStudy}
          scheme={scheme}
          isFlagship={vertical.id === "logistics-fleet"}
        />
      </div>
    </div>
  )
}

/* ─── Root component ─── */

export default function EnterpriseShowcase() {
  const [activeTab, setActiveTab] = useState(enterpriseVerticals[0]?.id ?? "")

  return (
    <section className="w-full" id="enterprise-showcase">
      <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)}>
        {/* Tabs bar */}
        <TabsList className="mb-10 w-full justify-start overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1">
          {enterpriseVerticals.map((vertical) => {
            const scheme = sectorSchemes[vertical.id] ?? sectorSchemes["logistics-fleet"]
            return (
              <TabsTrigger
                key={vertical.id}
                value={vertical.id}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  scheme.tabBg,
                  scheme.tabText,
                )}
              >
                {vertical.title.split(" ")[0]}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Tab panels */}
        {enterpriseVerticals.map((vertical) => (
          <TabsContent key={vertical.id} value={vertical.id}>
            <SectorContent vertical={vertical} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
