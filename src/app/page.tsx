import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import {
  ArrowRight,
  CheckCircle,
  LockKey,
  Path,
  UserSwitch,
} from "@phosphor-icons/react/dist/ssr"
import { ContactStudio } from "@/components/ContactStudio"
import { IntegrationMarquee } from "@/components/IntegrationMarquee"
import { MoxAgentGallery } from "@/components/MoxAgentGallery"
import { OperationsDemo } from "@/components/OperationsDemo"
import { PilotOffer, ProductOfferings } from "@/components/ProductOfferings"
import { ProtonLiveBooking } from "@/components/ProtonLiveBooking"
import { SiteHeader } from "@/components/SiteHeader"
import { VolimoxFooter } from "@/components/VolimoxFooter"
import { WorkflowStory } from "@/components/WorkflowStory"
import { SITE_CONTACT } from "@/config/siteContact"

export const metadata: Metadata = {
  title: "Volimox | Voice and operations for limo businesses",
  description:
    "Voice for your existing limo booking system, or a branded website, booking flow, and operations portal set up and managed by Volimox.",
}

const guardrails = [
  ["Your business rules", "Agree service areas, pricing, booking rules, and approval steps before your system goes live.", LockKey],
  ["Confirmed outcomes", "A quote, a booking request, a payment, and a completed trip each need their own confirmation.", Path],
  ["A person when needed", "Define who handles exceptions and what happens when a request cannot be confirmed.", UserSwitch],
] as const

export default function HomePage() {
  const localDemo = process.env.VOLIMOX_LOCAL_DEMO === "true" && process.env.NODE_ENV !== "production"
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Volimox",
    url: "https://volimox.com",
    description: "Voice, booking, and operations software for limo and black car businesses.",
    serviceType: "Limo voice and operations software setup and support",
    areaServed: "United States",
  }

  return (
    <main id="top" className="overflow-clip bg-canvas text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />

      <section className="relative min-h-[100dvh] border-b border-line pt-[72px]">
        <div className="absolute inset-0 paper-noise opacity-40" aria-hidden="true" />
        <div className="relative mx-auto grid min-h-[calc(100dvh-72px)] min-w-0 max-w-[1440px] items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-12 lg:py-16">
          <div className="min-w-0 max-w-xl">
            <p className="section-kicker">For limo and black car operators</p>
            <h1 className="mt-6 text-[clamp(2.85rem,12vw,5.1rem)] font-semibold leading-[0.94] tracking-[-0.07em]">
              From first call
              <span className="block text-outline">to booked ride.</span>
            </h1>
            <p className="mt-7 max-w-[38rem] text-base leading-7 text-ink-muted sm:text-lg">
              Voice for your existing booking system, or your own branded website, booking flow, and operations portal. Volimox handles setup and ongoing support.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/example-limo" className="button-primary" data-cta="hero-walkthrough">
                {localDemo ? "Walk through a booking" : "Try the voice demo"}
                <ArrowRight size={16} weight="bold" />
              </Link>
              <a href="#products" className="inline-flex min-h-12 items-center px-2 text-sm font-semibold underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink-muted" data-cta="hero-products">Find your starting point</a>
            </div>
            <div className="mt-10 flex max-w-lg flex-wrap gap-2 border-y border-line py-4 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
              <span className="border-r border-line pr-3">Your brand</span>
              <span className="border-r border-line pr-3">Your business rules</span>
              <span>Managed by Volimox</span>
            </div>
          </div>

          <div className="relative min-w-0 max-w-full lg:pl-4">
            <div className="absolute -left-8 -top-8 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint lg:block">
              Illustrated booking flow / Example Limo
            </div>
            <OperationsDemo />
          </div>
        </div>
      </section>

      <ProductOfferings localDemo={localDemo} />

      {localDemo ? (
        <section id="live-demo" className="border-b border-line bg-signal py-14 sm:py-20" aria-labelledby="local-demo-title">
          <div className="mx-auto grid max-w-[1440px] items-center gap-7 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:px-12">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]">Interactive simulation</p>
              <h2 id="local-demo-title" className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Try the passenger booking flow.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-muted">Follow a sample trip request through quote review and checkout. This local walkthrough uses sample data; it does not make calls, collect payments, or reserve a ride.</p>
            </div>
            <Link href="/example-limo" className="button-primary justify-self-start" data-cta="local-booking-walkthrough">
              Open the walkthrough <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : <ProtonLiveBooking />}

      <WorkflowStory />

      <section id="proof" className="border-y border-line bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid overflow-hidden border border-line-strong lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative min-h-[460px] bg-ink">
              <Image
                src="/brand/convergence-network.png"
                alt="Illustration of routes converging into one connected network"
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                priority={false}
              />
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute left-5 top-5 bg-signal px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-ink">
                {localDemo ? "Booking walkthrough" : "Voice demonstration"}
              </div>
            </div>
            <div className="flex flex-col justify-between bg-ink p-7 text-white sm:p-12">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">Example Limo / {localDemo ? "Simulation" : "Voice demo"}</p>
                <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{localDemo ? "Follow a trip request through quote and checkout." : "Try a limo booking conversation."}</h2>
                <p className="mt-6 text-sm leading-7 text-white/65">
                  {localDemo
                    ? "Enter sample trip details, select a quote, approve the price, and explore simulated checkout or a request held for review. The walkthrough does not confirm a real trip or payment."
                    : "Speak to the Example Limo agent about an airport transfer and follow the request through the booking conversation. This is a voice demonstration; a demo conversation alone does not confirm a ride."}
                </p>
              </div>
              <div className="mt-12 space-y-0 border-t border-white/15">
                {(localDemo
                  ? ["Sample trip and vehicle selection", "Explicit price approval", "Simulated checkout or review outcome"]
                  : ["Spoken trip intake", "Route and vehicle quote flow", "Customer approval before checkout"]
                ).map((item) => (
                  <div key={item} className="flex items-center gap-3 border-b border-white/15 py-4 text-sm text-white/75">
                    <CheckCircle size={17} weight="fill" className="text-signal" />
                    {item}
                  </div>
                ))}
                <Link href="/example-limo" className="button-signal mt-7" data-cta="reference-walkthrough">
                  {localDemo ? "Open the walkthrough" : "Try the voice demo"} <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 grid max-w-[1440px] gap-4 px-5 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:px-12">
          <p className="section-kicker pt-1">Built from an operator&apos;s perspective</p>
          <p className="max-w-2xl text-sm leading-7 text-ink-muted">Proton Limo is our founder&apos;s operating limo business and uses the underlying system. Volimox is the software and service brand. Our next step is the first three independent operator pilots.</p>
        </div>
      </section>

      <PilotOffer />

      <details id="other-agents" className="group border-b border-line bg-canvas-muted">
        <summary className="mx-auto flex max-w-[1440px] cursor-pointer list-none items-center justify-between gap-6 px-5 py-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset sm:px-8 lg:px-12">
          <span>
            <span className="section-kicker">More workflows</span>
            <span className="mt-2 block text-xl font-semibold tracking-[-0.035em] sm:text-2xl">Explore other service industries.</span>
            <span className="mt-2 block text-sm text-ink-muted">Voice examples and a missed-call follow-up preview.</span>
          </span>
          <ArrowRight size={22} className="shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
        </summary>
        {localDemo ? (
          <p className="mx-auto max-w-[1440px] px-5 py-5 text-sm leading-7 text-ink-muted sm:px-8 lg:px-12">Voice calls are unavailable in this local preview. You can explore the booking simulation above and watch the follow-up example below.</p>
        ) : <MoxAgentGallery />}

      <section id="follow-up" className="border-b border-line bg-canvas-muted py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:px-12">
          <div>
            <p className="section-kicker">Mox Follow-Up</p>
            <h2 className="section-title mt-5 max-w-[10ch]">A missed call becomes a ready-to-work lead.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted">
              A second workflow for service businesses: respond after a missed call, qualify the request by text, and hand the owner a clean lead.
            </p>
            {!localDemo && <a href="/follow-up" className="button-primary mt-8" data-cta="follow-up-preview">
              Try SMS follow-up
              <ArrowRight size={16} weight="bold" />
            </a>}
          </div>
          <div className="overflow-hidden border border-line-strong bg-ink">
            <video
              className="aspect-video w-full object-cover"
              controls
              muted
              playsInline
              preload="metadata"
              poster="/video/volimox-home-services-demo-poster.jpg"
              aria-label="Mox missed-call recovery preview"
            >
              <source src="/video/volimox-home-services-demo.webm" type="video/webm" />
              <source src="/video/volimox-home-services-demo.mp4" type="video/mp4" />
              Your browser does not support embedded video.
            </video>
          </div>
        </div>
      </section>
      </details>

      <IntegrationMarquee />
      <p className="border-b border-line bg-white px-5 pb-8 text-center text-xs leading-6 text-ink-muted sm:px-8">
        Connections are scoped per operator and verified before use. <Link href="/apps" className="underline decoration-line-strong underline-offset-4 hover:text-ink">Explore the integration directory.</Link>
      </p>

      <section id="guardrails" className="border-y border-line bg-white py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1440px] gap-16 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:px-12">
          <div>
            <h2 className="section-title max-w-[10ch]">Agree the rules before the first call.</h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-ink-muted">
              During setup, we agree what Voice can do, where confirmation comes from, and when your team takes over.
            </p>
          </div>
          <div className="border-t border-line-strong">
            {guardrails.map(([title, copy, Icon], index) => (
              <article key={title} className="grid gap-5 border-b border-line-strong py-7 sm:grid-cols-[64px_0.62fr_1.38fr] sm:items-start">
                <span className="font-mono text-[10px] text-ink-faint">0{index + 1}</span>
                <div className="flex items-center gap-3">
                  <Icon size={20} weight="duotone" />
                  <h3 className="text-base font-semibold">{title}</h3>
                </div>
                <p className="max-w-xl text-sm leading-7 text-ink-muted">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-canvas-muted py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="mb-12 max-w-4xl">
            <p className="section-kicker">Start with your operation</p>
            <h2 className="section-title mt-5">Tell us how you book rides today.</h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-ink-muted">Share your service area, current booking system, and where calls need more support. We will work out the right scope and whether the pilot fits.</p>
          </div>
          {localDemo ? (
            <div className="flex flex-wrap gap-4">
              <a href={"mailto:" + SITE_CONTACT.email} className="button-primary">Email Volimox <ArrowRight size={16} aria-hidden="true" /></a>
              <a href={"tel:" + SITE_CONTACT.phoneTel} className="button-secondary">{SITE_CONTACT.phoneDisplay}</a>
            </div>
          ) : <ContactStudio />}
        </div>
      </section>

      <VolimoxFooter />
    </main>
  )
}
