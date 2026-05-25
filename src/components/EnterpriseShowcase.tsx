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
  stepConnector: string
  stepActive: string
  stepInactive: string
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
    stepConnector: "bg-indigo-200",
    stepActive: "bg-indigo-600 text-white",
    stepInactive: "bg-slate-100 text-slate-400",
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
    stepConnector: "bg-amber-200",
    stepActive: "bg-amber-600 text-white",
    stepInactive: "bg-slate-100 text-slate-400",
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
    stepConnector: "bg-emerald-200",
    stepActive: "bg-emerald-600 text-white",
    stepInactive: "bg-slate-100 text-slate-400",
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
    stepConnector: "bg-teal-200",
    stepActive: "bg-teal-600 text-white",
    stepInactive: "bg-slate-100 text-slate-400",
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
    { label: "Hardened Rejection Rate", value: metrics.hallucinationRate },
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

/* ─── Interactive Pipeline Stepper ─── */

function PipelineStepper({
  stages,
  scheme,
}: {
  stages: EnterpriseVertical["pipelineStages"]
  scheme: SectorScheme
}) {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <Card className={cn("border bg-white shadow-sm", scheme.cardBorder)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
          <svg className={cn("h-4 w-4", scheme.iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Pipeline Architecture
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Click a stage to inspect the technical implementation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Horizontal step indicators */}
        <div className="mb-6 flex items-center gap-0">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => setActiveStep(i)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  activeStep === i
                    ? cn(scheme.stepActive, "shadow-sm")
                    : cn(scheme.stepInactive, "hover:bg-slate-200/60"),
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    activeStep === i ? "bg-white/20" : "bg-white border border-slate-200",
                  )}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{stage.label}</span>
              </button>
              {i < stages.length - 1 && (
                <div className={cn("mx-2 h-px flex-1", scheme.stepConnector)} />
              )}
            </div>
          ))}
        </div>

        {/* Active step detail */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                scheme.stepActive,
              )}
            >
              {activeStep + 1}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">
                {stages[activeStep].label}
              </h4>
              <p className="text-xs leading-relaxed text-slate-600">
                {stages[activeStep].description}
              </p>
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-500">
                <span className="text-slate-400">// </span>
                {stages[activeStep].technicalDetail}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Ingestion Micro-Pills ─── */

function IngestionPills({ triggers, scheme }: { triggers: string[]; scheme: SectorScheme }) {
  return (
    <Card className={cn("border bg-white shadow-sm", scheme.cardBorder)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
          <svg className={cn("h-4 w-4", scheme.iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Inbound Triggers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {triggers.map((t) => (
            <span
              key={t}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
                scheme.accentBorder,
                scheme.accent,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", scheme.iconColor.replace("text-", "bg-"))} />
              {t}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Integration Grid ─── */

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

/* ─── Case Study Card ─── */

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

/* ─── Proton Limo Blueprint (Logistics only) ─── */

function ProtonLimoBlueprint({ scheme }: { scheme: SectorScheme }) {
  return (
    <Card className={cn("border bg-white shadow-sm ring-1 ring-amber-200", scheme.cardBorder)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
            Production Blueprint
          </Badge>
          <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">
            Codename: Proton
          </Badge>
        </div>
        <CardTitle className="mt-2 text-base text-slate-900">Proton Limo — Live Architecture</CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Full-stack deployment powering a 24/7 luxury limousine dispatch AI concierge
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Architecture rows */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">
              1
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-900">Voice / Chat Ingestion</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Retell AI voice agent with custom LLM policy for multi-turn slot filling. Web chat widget shares the same policy backend.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">
              2
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-900">Maps Distance Matrix</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Google Maps Routes API computes distance/duration matrices for multi-stop routes. Complexity scoring determines vehicle-class matching and fare calculation.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">
              3
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-900">Stripe Pre-Authorization</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Custom PaymentIntent creation with pre-authorization holds. Secure payment link delivery via Twilio SMS/Email. Price-consent binding via HMAC-SHA256 signature.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">
              4
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-900">Salesforce Agentforce Sync</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatic Lead/Opportunity creation, Field Service Lightning dispatch tracking, and post-ride satisfaction survey automation.
              </p>
            </div>
          </div>
        </div>

        {/* Technical tags */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
          {["Retell AI", "Google Maps Routes API", "Stripe Billing Engine", "Twilio", "Salesforce Agentforce", "Firebase"].map(
            (tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600"
              >
                {tag}
              </span>
            ),
          )}
        </div>
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

      {/* Interactive Pipeline Stepper */}
      <PipelineStepper stages={vertical.pipelineStages} scheme={scheme} />

      {/* Ingestion Triggers */}
      <IngestionPills triggers={vertical.inboundTriggers} scheme={scheme} />

      {/* Proton Limo Blueprint — only for logistics */}
      {vertical.id === "logistics-fleet" && <ProtonLimoBlueprint scheme={scheme} />}

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
    <section className="w-full bg-white" id="enterprise-showcase">
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
