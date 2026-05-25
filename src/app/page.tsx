/**
 * Volimox — Enterprise AI Agency Home Page
 *
 * Composes the full Volimox marketing landing page.
 * Server component — no "use client".
 */

import type { Metadata } from "next"
import { HeroSection } from "@/components/HeroSection"
import EnterpriseShowcase from "@/components/EnterpriseShowcase"
import SystemHardening from "@/components/SystemHardening"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Volimox — Enterprise AI Automation Agency",
  description:
    "Full-stack autonomous conversational systems for logistics, manufacturing, real estate, and healthcare. Production-proven architecture that automates entry intake, pricing, payment capture, and dispatch at enterprise scale.",
  keywords: [
    "enterprise AI automation",
    "conversational AI agency",
    "autonomous dispatch",
    "B2B AI orchestration",
    "voice AI logistics",
    "AI supply chain",
    "healthcare AI automation",
    "real estate AI",
  ],
}

// ---------------------------------------------------------------------------
// Lead Estimator Console (inline server component with HTML form)
// ---------------------------------------------------------------------------

function LeadEstimatorSection() {
  return (
    <section className="w-full" id="lead-estimator">
      <Card size="sm" className="mx-auto w-full max-w-2xl border-white/[0.06] bg-zinc-950/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white sm:text-2xl">
            Volimox Lead Estimator Console
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Model your deployment timeline and projected annual savings
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action="/api/contact" method="POST" className="space-y-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-zinc-300">
                Full Name <span className="text-amber-400">*</span>
              </Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="Jane Smith"
                className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-zinc-600 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
              />
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-zinc-300">
                Company Name <span className="text-amber-400">*</span>
              </Label>
              <Input
                id="companyName"
                name="companyName"
                type="text"
                required
                placeholder="Acme Logistics Inc."
                className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-zinc-600 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
              />
            </div>

            {/* Industry */}
            <div className="space-y-1.5">
              <Label htmlFor="industry" className="text-zinc-300">
                Industry <span className="text-amber-400">*</span>
              </Label>
              <select
                id="industry"
                name="industry"
                required
                className="h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-sm text-white outline-none transition-colors focus-visible:border-amber-500/50 focus-visible:ring-3 focus-visible:ring-amber-500/20 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%2371717a' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.5rem center",
                  paddingRight: "2rem",
                }}
              >
                <option value="" disabled className="bg-zinc-900 text-zinc-500">
                  Select your industry
                </option>
                <option value="Logistics & Fleet" className="bg-zinc-900 text-white">
                  Logistics & Fleet
                </option>
                <option value="Manufacturing & Supply Chain" className="bg-zinc-900 text-white">
                  Manufacturing & Supply Chain
                </option>
                <option value="Real Estate Operations" className="bg-zinc-900 text-white">
                  Real Estate Operations
                </option>
                <option value="Outpatient Healthcare" className="bg-zinc-900 text-white">
                  Outpatient Healthcare
                </option>
              </select>
            </div>

            {/* Project Scope */}
            <div className="space-y-1.5">
              <Label htmlFor="projectScope" className="text-zinc-300">
                Project Scope
              </Label>
              <Textarea
                id="projectScope"
                name="projectScope"
                rows={3}
                placeholder="Brief description of your automation needs — channels, volume, integration requirements, timeline expectations..."
                className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-zinc-600 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20 min-h-[80px]"
              />
            </div>

            {/* Estimated Monthly Volume */}
            <div className="space-y-1.5">
              <Label htmlFor="estimatedVolume" className="text-zinc-300">
                Estimated Monthly Interaction Volume <span className="text-amber-400">*</span>
              </Label>
              <Input
                id="estimatedVolume"
                name="estimatedVolume"
                type="number"
                required
                min="0"
                placeholder="e.g. 5000"
                className="border-white/[0.08] bg-white/[0.03] text-white placeholder:text-zinc-600 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
              />
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full bg-white text-black hover:bg-white/90 focus-visible:ring-white/50">
              Calculate Projection
            </Button>
          </form>

          {/* Projection Note */}
          <div className="mt-6 rounded-lg border border-white/[0.05] bg-white/[0.01] p-4">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              What You&rsquo;ll Receive
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Upon submission, our engineering team will provide a customized deployment
              projection including timeline estimates, integration complexity scoring, and
              projected annual savings based on your monthly interaction volume. Typical
              deployments see:
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
                Estimated Deployment Timeline:{" "}
                <span className="font-medium text-white">6–8 weeks</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
                Projected Annual Support Cost Savings:{" "}
                <span className="font-medium text-white">~$12 per automated interaction</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
                AI Agent Hallucination Risk Profile:{" "}
                <span className="font-medium text-emerald-400">{"<0.01%"}</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function VolimoxFooter() {
  return (
    <footer className="w-full border-t border-white/[0.04] bg-zinc-950">
      <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div>
            <span className="text-sm font-bold tracking-tight text-white">Volimox</span>
            <span className="ml-2 text-xs text-zinc-500">— Enterprise AI Automation</span>
          </div>
          <p className="text-xs text-zinc-600">
            &copy; 2025 Volimox — Enterprise AI Automation. All rights reserved.
          </p>
          <nav className="flex items-center gap-4 text-xs text-zinc-500">
            <a href="#" className="transition-colors hover:text-zinc-300">Privacy Policy</a>
            <a href="#" className="transition-colors hover:text-zinc-300">Terms of Service</a>
            <a href="#lead-estimator" className="transition-colors hover:text-zinc-300">Contact</a>
          </nav>
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VolimoxHomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Hero */}
      <HeroSection />

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Enterprise Showcase */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Enterprise Vertical Case Studies
            </h2>
            <p className="mt-3 text-sm font-medium text-zinc-400 sm:text-base">
              Select a sector below to explore the full pipeline architecture, integrations, and production metrics
            </p>
          </div>
          <EnterpriseShowcase />
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* System Hardening */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <SystemHardening />
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Lead Estimator Console */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <LeadEstimatorSection />
        </div>
      </section>

      {/* Footer */}
      <VolimoxFooter />
    </div>
  )
}
