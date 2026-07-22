import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowDown,
  ArrowRight,
  Check,
  Clock,
  PhoneDisconnect,
  ShieldCheck,
  UserFocus,
} from "@phosphor-icons/react/dist/ssr"
import { BrandMark } from "@/components/BrandMark"
import { LimoPilotForm } from "@/components/LimoPilotForm"
import { ProtonLiveBooking } from "@/components/ProtonLiveBooking"

export const metadata: Metadata = {
  title: "Booking recovery for limo operators",
  description:
    "Volimox helps limo and chauffeur operators qualify missed calls, route the right requests, and follow up before the ride is lost.",
  openGraph: {
    title: "Volimox | Booking recovery for limo operators",
    description:
      "Turn missed calls into qualified ride requests and confirmed bookings.",
    images: [{ url: "/brand/convergence-network.png", width: 1536, height: 1024 }],
  },
}

const recoverySteps = [
  {
    number: "01",
    title: "The call is missed",
    copy: "Your team is driving, with a passenger, or already handling another booking.",
    icon: PhoneDisconnect,
  },
  {
    number: "02",
    title: "The ride is qualified",
    copy: "Pickup, destination, timing, passengers, and vehicle fit are captured in one conversation.",
    icon: UserFocus,
  },
  {
    number: "03",
    title: "Your team gets the next move",
    copy: "A clean request is ready for transfer, quote, follow-up, and a confirmed booking decision.",
    icon: Check,
  },
]

const pilotDetails = [
  "Dedicated call flow for your business",
  "Your hours, service area, vehicles, and transfer rules",
  "A simple lead pipeline your team can actually use",
  "Weekly review of qualified and booked requests",
]

export default function LimoPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Volimox Booking Recovery",
    provider: {
      "@type": "Organization",
      name: "Volimox",
      url: "https://volimox.com",
    },
    serviceType: "Missed-call booking recovery for limo and chauffeur operators",
    areaServed: "United States",
  }

  return (
    <main className="overflow-clip bg-canvas text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="border-b border-line bg-canvas">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="Return to Volimox home" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-muted sm:flex" aria-label="Limo page navigation">
            <a href="#how-it-works" className="transition-colors hover:text-ink">How it works</a>
            <a href="#live-demo" className="transition-colors hover:text-ink">Live demo</a>
            <a href="#pilot" className="transition-colors hover:text-ink">Pilot</a>
          </nav>
          <a href="#pilot" className="button-primary" data-cta="limo-header-pilot">
            Start a pilot
            <ArrowRight size={16} weight="bold" />
          </a>
        </div>
      </header>

      <section className="relative border-b border-line pt-16 sm:pt-20 lg:pt-24">
        <div className="absolute inset-0 paper-noise opacity-35" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1440px] gap-14 px-5 pb-20 sm:px-8 sm:pb-28 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-12 lg:pb-36">
          <div className="max-w-2xl">
            <p className="section-kicker">Volimox / booking recovery</p>
            <h1 className="mt-6 max-w-[10ch] text-[clamp(3.7rem,9vw,7.5rem)] font-semibold leading-[0.84] tracking-[-0.08em]">
              Turn missed calls into <span className="text-outline">booked rides.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-ink-muted sm:text-xl">
              When your team cannot answer, Volimox captures the trip, routes the right request, and keeps the follow-up moving.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#pilot" className="button-signal" data-cta="limo-hero-pilot">
                Start a paid pilot
                <ArrowRight size={16} weight="bold" />
              </a>
              <a href="#live-demo" className="button-secondary" data-cta="limo-hero-demo">
                Hear the live agent
              </a>
            </div>
            <div className="mt-12 flex items-center gap-3 border-t border-line pt-5 text-xs text-ink-muted">
              <Clock size={17} weight="duotone" className="text-ink" />
              <span>Designed for busy operators, after-hours calls, and requests that cannot wait for a callback.</span>
            </div>
          </div>

          <div className="relative min-w-0">
            <div className="absolute -left-6 -top-7 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint lg:block">
              Recovery path / 01
            </div>
            <div className="relative overflow-hidden border border-white/15 bg-ink p-5 text-white shadow-[0_36px_120px_rgba(20,21,18,0.18)] sm:p-8">
              <div className="absolute inset-0 operations-grid opacity-40" aria-hidden="true" />
              <div className="relative">
                <div className="flex items-center justify-between border-b border-white/15 pb-5">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-signal">Live recovery path</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">Example Limo</p>
                  </div>
                  <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
                    <span className="h-2 w-2 bg-signal" /> Pilot-ready flow
                  </span>
                </div>
                <div className="mt-8 space-y-3">
                  {[
                    ["Incoming call", "No answer after configured ring time"],
                    ["AI concierge", "Trip details and timing captured"],
                    ["Operator handoff", "Qualified request ready for action"],
                    ["Follow-up", "Customer stays in the booking path"],
                  ].map(([label, detail], index) => (
                    <div key={label} className="grid grid-cols-[32px_1fr] gap-4 border border-white/10 bg-white/[0.035] p-4">
                      <span className="flex h-8 w-8 items-center justify-center bg-signal font-mono text-[10px] font-semibold text-ink">0{index + 1}</span>
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-white/45">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-white/15 pt-5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">Result</span>
                  <span className="text-sm font-semibold text-signal">A request your team can act on</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <a href="#how-it-works" aria-label="Scroll to how it works" className="mx-auto mb-7 flex w-fit items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-ink sm:mb-9">
          See the flow <ArrowDown size={14} />
        </a>
      </section>

      <section id="how-it-works" className="border-b border-line bg-canvas-muted py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="section-kicker">The operating promise</p>
              <h2 className="section-title mt-5 max-w-[9ch]">The call does not end when nobody answers.</h2>
            </div>
            <div className="lg:pt-14">
              <p className="max-w-3xl text-2xl font-medium leading-[1.35] tracking-[-0.03em] sm:text-4xl">
                Volimox turns an unanswered call into a structured request, a clear handoff, and a next step your team can own.
              </p>
              <div className="mt-12 grid gap-px bg-line-strong md:grid-cols-3">
                {recoverySteps.map(({ number, title, copy, icon: Icon }) => (
                  <article key={number} className="flex min-h-64 flex-col bg-canvas p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-5">
                      <span className="font-mono text-[10px] text-ink-faint">{number}</span>
                      <Icon size={25} weight="duotone" />
                    </div>
                    <div className="mt-auto pt-16">
                      <h3 className="text-xl font-semibold tracking-[-0.04em]">{title}</h3>
                      <p className="mt-3 text-sm leading-6 text-ink-muted">{copy}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-ink py-24 text-white sm:py-32">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-12">
          <div>
            <p className="section-kicker text-signal">Pilot scope</p>
            <h2 className="mt-5 max-w-[10ch] text-[clamp(3rem,5.3vw,5.8rem)] font-semibold leading-[0.92] tracking-[-0.065em]">Built around your dispatch reality.</h2>
          </div>
          <div className="lg:pt-14">
            <p className="max-w-2xl text-lg leading-8 text-white/55">
              Start with one number, one operating area, and one clear handoff. We configure the recovery path around the way your team already books rides.
            </p>
            <div className="mt-10 border-t border-white/15">
              {pilotDetails.map((item) => (
                <div key={item} className="flex items-center gap-3 border-b border-white/15 py-4 text-sm text-white/75">
                  <Check size={17} weight="fill" className="text-signal" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-10 flex items-start gap-4 border border-white/15 p-5">
              <ShieldCheck size={22} weight="duotone" className="mt-0.5 shrink-0 text-signal" />
              <p className="text-sm leading-6 text-white/55">The first pilot is measured by qualified requests and confirmed booking outcomes, not by a vanity AI score.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-ink text-white">
        <div className="mx-auto max-w-[1440px] px-5 pt-24 sm:px-8 sm:pt-32 lg:px-12">
          <div className="max-w-4xl">
            <p className="section-kicker text-signal">Interactive simulation</p>
            <h2 className="mt-5 max-w-[10ch] text-[clamp(3rem,5.3vw,5.8rem)] font-semibold leading-[0.93] tracking-[-0.065em]">Hear the concierge qualify the ride.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/55">This demo shows the operating shape. Your pilot would use your hours, service area, vehicles, and transfer rules.</p>
          </div>
        </div>
        <ProtonLiveBooking agentId="limo" />
      </section>

      <section id="pilot" className="bg-canvas-muted py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="mb-12 max-w-4xl">
            <p className="section-kicker">Start a paid pilot</p>
            <h2 className="section-title mt-5 max-w-[10ch]">Show us the calls you cannot afford to lose.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">Tell us how your phone works today. We will map the smallest useful recovery path for your operation.</p>
          </div>
          <LimoPilotForm />
        </div>
      </section>

      <footer className="border-t border-line bg-canvas py-12">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <BrandMark />
            <p className="max-w-md text-sm leading-6 text-ink-muted">Booking recovery for limo and chauffeur operators.</p>
          </div>
          <div className="flex flex-col justify-between gap-4 border-t border-line pt-6 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint sm:flex-row">
            <span>© {new Date().getFullYear()} Volimox</span>
            <Link href="/" className="transition-colors hover:text-ink">Volimox systems</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
