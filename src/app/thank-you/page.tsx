/**
 * Volimox — Thank You Page
 *
 * Shown after a successful lead form submission.
 * Static page — no "use client" needed.
 */

import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Thank You — Volimox",
  description:
    "Your request has been received. Our engineering team will provide a customized deployment projection.",
}

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative mx-auto w-full max-w-lg">
        {/* Card */}
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/80 p-10 text-center shadow-2xl backdrop-blur-sm">
          {/* Checkmark icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <svg
              className="h-8 w-8 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Thank You
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Your request has been received. Our engineering team will review your
            deployment requirements and provide a customized projection including
            timeline estimates, integration complexity scoring, and projected
            annual savings.
          </p>

          {/* Timeline info */}
          <div className="mt-8 rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
              <svg
                className="h-4 w-4 text-amber-400/70"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6l4 2"
                />
                <circle cx="12" cy="12" r="10" />
              </svg>
              <span>
                Typical response time:{" "}
                <span className="font-medium text-zinc-300">within 24 hours</span>
              </span>
            </div>
          </div>

          {/* Back link */}
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-amber-400 transition-colors hover:text-amber-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Volimox
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-zinc-700">
          &copy; {new Date().getFullYear()} Volimox — Enterprise AI Automation
        </p>
      </div>
    </div>
  )
}
