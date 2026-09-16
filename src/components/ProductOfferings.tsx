import Link from "next/link"
import { ArrowRight, ArrowUpRight, PhoneCall, Browser } from "@phosphor-icons/react/dist/ssr"

export function ProductOfferings({ localDemo = false }: { localDemo?: boolean }) {
  return (
    <section id="products" className="border-b border-line bg-canvas py-20 sm:py-28" aria-labelledby="products-title">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12">
          <p className="section-kicker pt-2">Two ways to work with Volimox</p>
          <div>
            <h2 id="products-title" className="section-title max-w-[12ch]">Start with the operation you have.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted">
              Keep the booking system your team knows, or let us set up your website and operations together.
            </p>
          </div>
        </div>

        <div className="mt-14 border-t border-line-strong">
          <article className="grid gap-7 border-b border-line-strong py-9 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:py-12">
            <div>
              <div className="flex items-center gap-3 text-ink-muted">
                <PhoneCall size={23} weight="duotone" aria-hidden="true" />
                <p className="text-sm">You already have a booking system</p>
              </div>
              <h3 className="mt-5 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Volimox Voice</h3>
            </div>
            <div>
              <p className="max-w-2xl text-base leading-7 text-ink-muted">
                Add call intake and a clear handoff to your team. We check what your current system supports, then agree which requests Voice can handle and which need a person.
              </p>
              <p className="mt-5 max-w-2xl border-l-2 border-signal pl-4 text-sm leading-6 text-ink-muted">
                Each connection needs verification. A request sent to your team is only a confirmed booking when your booking system confirms it.
              </p>
              <a href="#contact" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold transition-colors hover:text-ink-muted" data-cta="voice-scope-contact">
                Check my existing system <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </a>
            </div>
          </article>

          <article className="grid gap-7 border-b border-line-strong py-9 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:py-12">
            <div>
              <div className="flex items-center gap-3 text-ink-muted">
                <Browser size={23} weight="duotone" aria-hidden="true" />
                <p className="text-sm">You want the full system</p>
              </div>
              <h3 className="mt-5 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Your brand. Your operation.</h3>
            </div>
            <div>
              <p className="max-w-2xl text-base leading-7 text-ink-muted">
                A website in your name, online booking, Voice, and your own CRM and operations portal for reservations, passengers, payments, and manual driver assignment.
              </p>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-ink-muted">
                Volimox sets up and manages a dedicated deployment with your domain, branding, business rules, and separate customer data. Your team gets an account and a portal to use each day.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
                <a href="#contact" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold transition-colors hover:text-ink-muted" data-cta="full-system-contact">
                  Plan my setup <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </a>
                <Link href="/example-limo" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink" data-cta="full-system-walkthrough">
                  {localDemo ? "Explore the booking simulation" : "Try the voice demo"} <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export function PilotOffer() {
  return (
    <section id="pilot" className="border-b border-line bg-canvas-muted py-20 sm:py-28" aria-labelledby="pilot-title">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:px-12">
        <div>
          <p className="section-kicker">A controlled commercial pilot</p>
          <h2 id="pilot-title" className="section-title mt-5 max-w-[10ch]">First three operators.</h2>
          <p className="mt-6 max-w-md text-base leading-7 text-ink-muted">
            We are looking for three eligible independent limo or black car businesses to test the offer with us.
          </p>
          <a href="#contact" className="button-primary mt-8" data-cta="pilot-contact">
            Discuss the pilot <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </a>
        </div>

        <div className="border-t border-ink pt-7">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <p className="font-mono text-[clamp(4rem,10vw,7rem)] leading-none tracking-[-0.08em]">5<span className="text-[0.55em]">%</span></p>
            <p className="max-w-[20rem] pb-1 text-lg leading-7">of eligible, settled net service fare</p>
          </div>
          <p className="mt-7 max-w-xl text-base leading-7 text-ink-muted">
            No standard setup fee or fixed monthly fee during the pilot. Tax, tips, and tolls are excluded from the commission base.
          </p>
          <dl className="mt-8 border-t border-line-strong text-sm">
            <div className="grid gap-2 border-b border-line-strong py-5 sm:grid-cols-[0.38fr_0.62fr] sm:gap-6">
              <dt className="font-semibold">Pilot limit</dt>
              <dd className="leading-6 text-ink-muted">30 days or 300 AI minutes per operator, whichever comes first. New calls then follow the agreed human or message handoff.</dd>
            </div>
            <div className="grid gap-2 border-b border-line-strong py-5 sm:grid-cols-[0.38fr_0.62fr] sm:gap-6">
              <dt className="font-semibold">When commission applies</dt>
              <dd className="leading-6 text-ink-muted">A new booking attributed to Volimox, a completed trip, and verified full payment are all required.</dd>
            </div>
          </dl>
          <details className="group mt-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
              Scope and billing details
              <ArrowRight size={16} className="shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <div className="mt-3 max-w-2xl space-y-4 text-sm leading-6 text-ink-muted">
              <p>The first supported pilot uses inbound phone calls with our booking and payment flow. An existing system connection must provide reliable booking, completion, and payment evidence before it can qualify.</p>
              <p>Commission is reviewed in an itemized statement and billed separately. Automatic commission collection is not part of the current pilot. Existing bookings and support calls are not charged retroactively; cancellations and refunds are accounted for.</p>
              <p>This is a limited commercial test. Custom connectors and data migration need their own agreed scope. Permanent full system pricing and any continuation after the pilot will be agreed separately.</p>
            </div>
          </details>
        </div>
      </div>
    </section>
  )
}
