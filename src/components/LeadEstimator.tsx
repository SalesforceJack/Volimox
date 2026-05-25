"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/* ─── Types ─── */

type IndustryVertical = "logistics" | "manufacturing" | "real-estate" | "healthcare"
type PrimaryChannel = "voice" | "chat" | "email"

interface EstimationResult {
  monthlyVolume: number
  industry: IndustryVertical
  channel: PrimaryChannel
  tokenConsumption: number
  voiceLicensingCost: number
  totalApiCost: number
  automatedFulfillmentPct: number
  hardenedRejectionPct: number
  humanHandoffPct: number
  automatedInteractions: number
  humanInteractions: number
  staffingFTE: number
  staffingCost: number
  computeCost: number
  netSavings: number
}

/* ─── Estimation Engine ─── */

function estimateProjection(
  volume: number,
  industry: IndustryVertical,
  channel: PrimaryChannel,
): EstimationResult {
  // Realistic per-interaction token consumption by channel
  const tokensPerInteraction: Record<PrimaryChannel, number> = {
    voice: 2800,  // Voice: longer context, TTS tokens
    chat: 1200,   // Chat: shorter, text-only
    email: 900,   // Email: structured parsing
  }

  // Voice stream licensing ($0.12/min avg, ~2min per interaction)
  const voiceLicensingPerInteraction = 0.24

  // Token cost ($3/M input tokens, $15/M output tokens, blended ~$6/M)
  const tokenCostPer1K = 0.006

  // Industry-specific automation rates (realistic, not 100%)
  const automationRates: Record<IndustryVertical, { auto: number; reject: number; handoff: number }> = {
    logistics:     { auto: 0.87, reject: 0.08, handoff: 0.05 },
    manufacturing: { auto: 0.78, reject: 0.12, handoff: 0.10 },
    "real-estate": { auto: 0.82, reject: 0.10, handoff: 0.08 },
    healthcare:    { auto: 0.74, reject: 0.14, handoff: 0.12 },
  }

  const tokens = volume * tokensPerInteraction[channel]
  const tokenCost = tokens * tokenCostPer1K / 1000
  const voiceCost = channel === "voice" ? volume * voiceLicensingPerInteraction : 0
  const totalApiCost = tokenCost + voiceCost

  const rates = automationRates[industry]
  const automatedCount = Math.round(volume * rates.auto)
  const rejectedCount = Math.round(volume * rates.reject)
  const handoffCount = Math.round(volume * rates.handoff)

  // Staffing: 1 FTE handles ~800 handoffs/month realistically
  const fte = Math.max(1, Math.round(handoffCount / 800))
  const avgAgentSalary = 42000 // annual, fully loaded
  const staffingCost = (fte * avgAgentSalary) / 12

  // Compute cost (hosting, inference, middleware)
  const computeCost = totalApiCost * 0.4 // 40% overhead for infra

  // Net savings vs. fully manual (avg $12/interaction manual cost)
  const manualCost = volume * 12
  const automatedCost = totalApiCost + staffingCost + computeCost
  const netSavings = Math.max(0, manualCost - automatedCost)

  return {
    monthlyVolume: volume,
    industry,
    channel,
    tokenConsumption: Math.round(tokens),
    voiceLicensingCost: Math.round(voiceCost * 100) / 100,
    totalApiCost: Math.round(totalApiCost * 100) / 100,
    automatedFulfillmentPct: Math.round(rates.auto * 1000) / 10,
    hardenedRejectionPct: Math.round(rates.reject * 1000) / 10,
    humanHandoffPct: Math.round(rates.handoff * 1000) / 10,
    automatedInteractions: automatedCount,
    humanInteractions: handoffCount,
    staffingFTE: fte,
    staffingCost: Math.round(staffingCost * 100) / 100,
    computeCost: Math.round(computeCost * 100) / 100,
    netSavings: Math.round(netSavings * 100) / 100,
  }
}

/* ─── Industry labels ─── */

const industryLabels: Record<IndustryVertical, string> = {
  logistics: "Logistics & Fleet",
  manufacturing: "Manufacturing & Supply Chain",
  "real-estate": "Real Estate Operations",
  healthcare: "Outpatient Healthcare",
}

/* ─── Formatters ─── */

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 })

/* ─── Root Component ─── */

export function LeadEstimator() {
  const [volume, setVolume] = useState(5000)
  const [industry, setIndustry] = useState<IndustryVertical>("logistics")
  const [channel, setChannel] = useState<PrimaryChannel>("voice")

  const result = useMemo(() => estimateProjection(volume, industry, channel), [volume, industry, channel])

  return (
    <section className="w-full" id="lead-estimator">
      <Card className="mx-auto w-full max-w-4xl border-slate-200 bg-white shadow-xl shadow-slate-200/80 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900 sm:text-2xl">
            Deployment Cost Estimator
          </CardTitle>
          <CardDescription className="text-slate-500">
            Adjust your parameters below to model realistic API cost projections, staffing impact, and automation distribution
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* ── Input Form ── */}
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Monthly Volume */}
            <div className="space-y-1.5">
              <label htmlFor="volume" className="text-xs font-medium text-slate-700">
                Monthly Interaction Volume
              </label>
              <input
                id="volume"
                type="range"
                min={500}
                max={100000}
                step={500}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-slate-900"
              />
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  value={volume}
                  onChange={(e) => setVolume(Math.max(500, Math.min(100000, Number(e.target.value) || 500)))}
                  className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/20"
                />
                <span className="text-[11px] text-slate-400">interactions / mo</span>
              </div>
            </div>

            {/* Industry Vertical */}
            <div className="space-y-1.5">
              <label htmlFor="industry" className="text-xs font-medium text-slate-700">
                Industry Vertical
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value as IndustryVertical)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/20 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.75rem center",
                  paddingRight: "2.5rem",
                }}
              >
                <option value="logistics">Logistics & Fleet</option>
                <option value="manufacturing">Manufacturing & Supply Chain</option>
                <option value="real-estate">Real Estate Operations</option>
                <option value="healthcare">Outpatient Healthcare</option>
              </select>
            </div>

            {/* Primary Channel */}
            <div className="space-y-1.5">
              <label htmlFor="channel" className="text-xs font-medium text-slate-700">
                Primary Channel
              </label>
              <select
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as PrimaryChannel)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/20 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.75rem center",
                  paddingRight: "2.5rem",
                }}
              >
                <option value="voice">Voice (Retell AI)</option>
                <option value="chat">Chat (Web Widget)</option>
                <option value="email">Email (Parsed)</option>
              </select>
            </div>
          </div>

          {/* ── Results Dashboard ── */}
          <div className="space-y-6">
            {/* Cost Projections */}
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                API Cost Projections
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <span className="text-xs text-slate-500">Token Consumption</span>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">
                    {fmt(result.tokenConsumption / 1000)}K
                  </p>
                  <span className="text-[10px] text-slate-400">tokens / mo</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <span className="text-xs text-slate-500">API + Licensing</span>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">
                    {fmtMoney(result.totalApiCost)}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {channel === "voice" ? "incl. voice stream licensing" : "LLM inference only"}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <span className="text-xs text-slate-500">Compute Overhead</span>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">
                    {fmtMoney(result.computeCost)}
                  </p>
                  <span className="text-[10px] text-slate-400">middleware + hosting</span>
                </div>
              </div>
            </div>

            {/* Automation Distribution */}
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Automation Distribution
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500">Automated Fulfillment</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {result.automatedFulfillmentPct}%
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {fmt(result.automatedInteractions)} interactions
                  </span>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/30 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-xs text-slate-500">Hardened Rejections</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {result.hardenedRejectionPct}%
                  </p>
                  <span className="text-[10px] text-slate-400">
                    guardrail-blocked or confidence-low
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-xs text-slate-500">Human Agent Handoffs</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {result.humanHandoffPct}%
                  </p>
                  <span className="text-[10px] text-slate-400">
                    ~{result.staffingFTE} FTE{result.staffingFTE > 1 ? "s" : ""} needed
                  </span>
                </div>
              </div>
            </div>

            {/* Staffing vs Compute */}
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Staffing vs. Compute
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <span className="text-xs text-slate-500">Monthly Staffing Cost</span>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">
                    {fmtMoney(result.staffingCost)}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {result.staffingFTE} FTE{result.staffingFTE > 1 ? "s" : ""} @ {fmtMoney(42000 / 12)}/mo avg
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <span className="text-xs text-slate-500">Net Monthly Savings</span>
                  <p className={cn("mt-0.5 text-lg font-bold", result.netSavings > 0 ? "text-emerald-600" : "text-slate-500")}>
                    {result.netSavings > 0 ? fmtMoney(result.netSavings) : "—"}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    vs. fully manual operation
                  </span>
                </div>
              </div>
            </div>

            {/* Methodology note */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
              <p className="text-[11px] leading-relaxed text-slate-500">
                <span className="font-semibold text-slate-700">Methodology:</span> Token estimates use blended
                $0.006/1K tokens (input + output). Voice licensing at $0.12/min avg, ~2 min/interaction.
                Automation rates are industry-specific baselines from production deployments. Staffing assumes
                1 FTE handles ~800 handoffs/month at $42K/yr fully loaded. These are illustrative projections;
                actual costs vary by deployment complexity and negotiated API rates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
