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
import { LeadEstimator } from "@/components/LeadEstimator"

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

      {/* Lead Estimator */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Deploy Your Agent
            </h2>
            <p className="mt-3 text-sm font-medium text-slate-500 sm:text-base">
              Model your deployment costs and automation distribution in real time
            </p>
          </div>
          <LeadEstimator />
        </div>
      </section>

      {/* Footer */}
      <VolimoxFooter />
    </div>
  )
}
