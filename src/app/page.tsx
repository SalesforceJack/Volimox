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
      <Card className="mx-auto w-full max-w-2xl border-slate-200 bg-white shadow-2xl shadow-slate-200/80">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900 sm:text-2xl">
            Volimox Lead Estimator Console
          </CardTitle>
          <CardDescription className="text-slate-500">
            Model your deployment timeline and projected annual savings
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action="/api/contact" method="POST" className="space-y-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-slate-700">
                Full Name <span className="text-amber-500">*</span>
              </Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="Jane Smith"
                className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-amber-400 focus-visible:ring-amber-400/20"
              />
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-slate-700">
                Company Name <span className="text-amber-500">*</span>
              </Label>
              <Input
                id="companyName"
                name="companyName"
                type="text"
                required
                placeholder="Acme Logistics Inc."
                className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-amber-400 focus-visible:ring-amber-400/20"
              />
            </div>

            {/* Industry */}
            <div className="space-y-1.5">
              <Label htmlFor="industry" className="text-slate-700">
                Industry <span className="text-amber-500">*</span>
              </Label>
              <select
                id="industry"
                name="industry"
                required
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus-visible:border-amber-400 focus-visible:ring-3 focus-visible:ring-amber-400/20 appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.75rem center",
                  paddingRight: "2.5rem",
                }}
              >
                <option value="" disabled className="text-slate-400">
                  Select your industry
                </option>
                <option value="Logistics & Fleet">Logistics & Fleet</option>
                <option value="Manufacturing & Supply Chain">Manufacturing & Supply Chain</option>
                <option value="Real Estate Operations">Real Estate Operations</option>
                <option value="Outpatient Healthcare">Outpatient Healthcare</option>
              </select>
            </div>

            {/* Project Scope */}
            <div className="space-y-1.5">
              <Label htmlFor="projectScope" className="text-slate-700">
                Project Scope
              </Label>
              <Textarea
                id="projectScope"
                name="projectScope"
                rows={3}
                placeholder="Brief description of your automation needs — channels, volume, integration requirements, timeline expectations..."
                className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-amber-400 focus-visible:ring-amber-400/20 min-h-[80px]"
              />
            </div>

            {/* Estimated Monthly Volume */}
            <div className="space-y-1.5">
              <Label htmlFor="estimatedVolume" className="text-slate-700">
                Estimated Monthly Interaction Volume <span className="text-amber-500">*</span>
              </Label>
              <Input
                id="estimatedVolume"
                name="estimatedVolume"
                type="number"
                required
                min="0"
                placeholder="e.g. 5000"
                className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-amber-400 focus-visible:ring-amber-400/20"
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full bg-slate-950 text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md active:scale-[0.98]"
            >
              Calculate Projection
            </Button>
          </form>

          {/* Projection Note */}
          <div className="mt-6 rounded-lg border border-amber-200/60 bg-amber-50/50 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-amber-800">
              What You&rsquo;ll Receive
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Upon submission, our engineering team will provide a customized deployment
              projection including timeline estimates, integration complexity scoring, and
              projected annual savings based on your monthly interaction volume. Typical
              deployments see:
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Estimated Deployment Timeline:{" "}
                <span className="font-semibold text-slate-900">6–8 weeks</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Projected Annual Support Cost Savings:{" "}
                <span className="font-semibold text-slate-900">~$12 per automated interaction</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                AI Agent Hallucination Risk Profile:{" "}
                <span className="font-semibold text-emerald-600">{"<0.01%"}</span>
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
    <footer className="w-full border-t border-slate-200/60 bg-white">
      <div className="mx-auto max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-900">Volimox</span>
            <span className="ml-2 text-xs text-slate-400">— Enterprise AI Automation</span>
          </div>
          <p className="text-xs text-slate-400">
            &copy; 2025 Volimox — Enterprise AI Automation. All rights reserved.
          </p>
          <nav className="flex items-center gap-4 text-xs text-slate-400">
            <a href="#" className="transition-colors hover:text-slate-700">Privacy Policy</a>
            <a href="#" className="transition-colors hover:text-slate-700">Terms of Service</a>
            <a href="#lead-estimator" className="transition-colors hover:text-slate-700">Contact</a>
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Hero */}
      <HeroSection />

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

      {/* Enterprise Showcase */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Enterprise Vertical Case Studies
            </h2>
            <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
              Select a sector below to explore the full pipeline architecture, integrations, and production metrics
            </p>
          </div>
          <EnterpriseShowcase />
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

      {/* System Hardening */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              System Hardening & Guardrails
            </h2>
            <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
              Every Volimox deployment ships with four layers of operational safety — from prompt
              injection defense to geo-fenced service boundaries.
            </p>
          </div>
          <SystemHardening />
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />

      {/* Lead Estimator Console */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Deploy Your Agent
            </h2>
            <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
              Tell us about your operation and we&rsquo;ll model your deployment in 24 hours
            </p>
          </div>
          <LeadEstimatorSection />
        </div>
      </section>

      {/* Footer */}
      <VolimoxFooter />
    </div>
  )
}
