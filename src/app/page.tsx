import Image from "next/image"
import type { Metadata } from "next"
import {
  ArrowRight,
  CalendarCheck,
  ChatCircleText,
  CheckCircle,
  CirclesFour,
  CreditCard,
  Database,
  Fingerprint,
  LockKey,
  MapPin,
  Path,
  ShieldCheck,
  UserSwitch,
} from "@phosphor-icons/react/dist/ssr"
import { ArchitectureExplorer } from "@/components/ArchitectureExplorer"
import { BrandMark } from "@/components/BrandMark"
import { ContactStudio } from "@/components/ContactStudio"
import { IntegrationMarquee } from "@/components/IntegrationMarquee"
import { MoxAgentGallery } from "@/components/MoxAgentGallery"
import { OperationsDemo } from "@/components/OperationsDemo"
import { ProtonLiveBooking } from "@/components/ProtonLiveBooking"
import { SiteHeader } from "@/components/SiteHeader"
import { WorkflowStory } from "@/components/WorkflowStory"

export const metadata: Metadata = {
  title: "Volimox | Operational AI Systems",
  description:
    "Volimox designs operational AI systems that turn customer conversations into quotes, payments, schedules, dispatches, and complete business records.",
}

const capabilities = [
  {
    title: "Every channel, one intake layer",
    copy: "Voice, chat, SMS, email, and web forms resolve into the same operational schema.",
    icon: ChatCircleText,
    className: "md:col-span-7",
    visual: "channels",
  },
  {
    title: "Rules before action",
    copy: "Pricing, geography, eligibility, inventory, and consent remain deterministic.",
    icon: Fingerprint,
    className: "md:col-span-5",
    visual: "rules",
  },
  {
    title: "Money moves safely",
    copy: "Quote approval, payment links, authorization, and receipts stay inside the workflow.",
    icon: CreditCard,
    className: "md:col-span-4",
    visual: "payment",
  },
  {
    title: "Fulfillment is the finish line",
    copy: "The operation reaches scheduling, dispatch, CRM, and reporting without a second entry step.",
    icon: CalendarCheck,
    className: "md:col-span-8",
    visual: "fulfillment",
  },
]

const guardrails = [
  ["Policy boundaries", "Explicit limits for service areas, pricing, approvals, and allowable actions.", LockKey],
  ["Deterministic checks", "Code validates critical decisions before an AI-generated output reaches a business system.", ShieldCheck],
  ["Traceable execution", "Inputs, decisions, tool calls, and outcomes create an inspectable operational record.", Path],
  ["Human exception lane", "Low confidence, policy conflicts, and sensitive requests arrive with context and ownership.", UserSwitch],
] as const

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Volimox",
    url: "https://volimox.com",
    description: "Operational AI systems that turn customer conversations into completed work.",
    serviceType: "Operational AI systems design and implementation",
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
            <p className="section-kicker">Operational AI systems</p>
            <h1 className="mt-6 text-[clamp(2.85rem,14vw,5.1rem)] font-semibold leading-[0.86] tracking-[-0.07em]">
              Conversation
              <span className="block whitespace-nowrap text-outline">to completion.</span>
            </h1>
            <p className="mt-7 max-w-[38rem] text-base leading-7 text-ink-muted sm:text-lg">
              Volimox designs AI systems that quote, collect, schedule, dispatch, and update your business tools.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#contact" className="button-primary" data-cta="hero-operation-map">
                Map my operation
                <ArrowRight size={16} weight="bold" />
              </a>
              <a href="#system" className="button-secondary" data-cta="hero-see-system">See the system</a>
            </div>
            <div className="mt-10 grid max-w-lg grid-cols-3 border-y border-line py-4">
              <HeroFact value="5" label="run stages" />
              <HeroFact value="1" label="production reference" />
              <HeroFact value="24/7" label="operational path" />
            </div>
          </div>

          <div className="relative min-w-0 max-w-full lg:pl-4">
            <div className="absolute -left-8 -top-8 hidden font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint lg:block">
              Live system model / 01
            </div>
            <OperationsDemo />
          </div>
        </div>
      </section>

      <IntegrationMarquee />

      <ProtonLiveBooking />

      <MoxAgentGallery />

      <section className="relative border-b border-line py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-12">
          <div>
            <h2 className="section-title max-w-[10ch]">AI can answer. Operations must finish.</h2>
          </div>
          <div className="lg:pt-14">
            <p className="max-w-3xl text-2xl font-medium leading-[1.35] tracking-[-0.03em] text-ink sm:text-4xl">
              The expensive part is not the conversation. It is everything your team still has to do after it.
            </p>
            <div className="mt-12 grid gap-px bg-line sm:grid-cols-3">
              <ProblemCell title="Fragmented intake" copy="Calls, forms, inboxes, and chat create different versions of the same request." />
              <ProblemCell title="Manual judgment" copy="Pricing, routing, and eligibility live in people instead of a controlled system." />
              <ProblemCell title="Broken fulfillment" copy="The answer is delivered, but the payment, schedule, dispatch, or CRM record is not." />
            </div>
          </div>
        </div>
      </section>

      <WorkflowStory />

      <section id="capabilities" className="border-t border-line bg-canvas-muted py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-4xl">
            <h2 className="section-title">Built around the work, not a chatbot.</h2>
          </div>
          <div className="mt-14 grid gap-px bg-line-strong md:grid-cols-12">
            {capabilities.map((capability) => {
              const Icon = capability.icon
              return (
                <article key={capability.title} className={`capability-cell ${capability.className}`}>
                  <div className="flex items-start justify-between gap-6">
                    <Icon size={30} weight="duotone" className="text-ink" />
                    <span className="h-3 w-3 bg-signal" aria-hidden="true" />
                  </div>
                  <div className="mt-16 max-w-xl">
                    <h3 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{capability.title}</h3>
                    <p className="mt-4 max-w-lg text-sm leading-7 text-ink-muted">{capability.copy}</p>
                  </div>
                  <CapabilityVisual type={capability.visual} />
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="proof" className="border-y border-line bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid overflow-hidden border border-line-strong lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative min-h-[460px] bg-ink">
              <Image
                src="/brand/convergence-network.png"
                alt="Routes converging into a single verified operational node"
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                priority={false}
              />
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute left-5 top-5 bg-signal px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-ink">
                Production reference
              </div>
            </div>
            <div className="flex flex-col justify-between bg-ink p-7 text-white sm:p-12">
              <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">Example Limo</p>
                <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">A booking request becomes a fulfilled ride.</h2>
                <p className="mt-6 text-sm leading-7 text-white/50">
                  The transportation architecture connects conversational intake with route validation, controlled quoting, customer follow-up, dispatch, and fulfillment.
                </p>
              </div>
              <div className="mt-12 space-y-0 border-t border-white/15">
                {["Structured trip intake", "Deterministic route and quote logic", "SMS and email follow-up", "Demo record fulfillment"].map((item) => (
                  <div key={item} className="flex items-center gap-3 border-b border-white/15 py-4 text-sm text-white/75">
                    <CheckCircle size={17} weight="fill" className="text-signal" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="mb-14 max-w-5xl">
            <h2 className="section-title">Production proof first. New industries without invented claims.</h2>
          </div>
          <ArchitectureExplorer />
        </div>
      </section>

      <section id="guardrails" className="border-y border-line bg-white py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1440px] gap-16 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:px-12">
          <div>
            <h2 className="section-title max-w-[9ch]">Autonomy needs boundaries.</h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-ink-muted">
              The model handles language. The system controls what is allowed to happen next.
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
            <p className="section-kicker">Build with Volimox</p>
            <h2 className="section-title mt-5">Show us where the work gets stuck.</h2>
          </div>
          <ContactStudio />
        </div>
      </section>

      <footer className="border-t border-line bg-canvas py-12">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <BrandMark />
            <p className="max-w-md text-sm leading-6 text-ink-muted">Operational AI systems that move from conversation to completed work.</p>
          </div>
          <div className="flex flex-col justify-between gap-4 border-t border-line pt-6 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint sm:flex-row">
            <span>© {new Date().getFullYear()} Volimox</span>
            <span>Systems designed for real operations</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

function HeroFact({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-r border-line px-3 first:pl-0 last:border-r-0">
      <p className="text-xl font-semibold tracking-[-0.04em]">{value}</p>
      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">{label}</p>
    </div>
  )
}

function ProblemCell({ title, copy }: { title: string; copy: string }) {
  return (
    <article className="bg-canvas p-5 sm:p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-3 text-xs leading-6 text-ink-muted">{copy}</p>
    </article>
  )
}

function CapabilityVisual({ type }: { type: string }) {
  if (type === "channels") {
    return (
      <div className="mt-10 flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted">
        {["Voice", "Chat", "SMS", "Email", "Forms"].map((item) => <span key={item} className="border border-line-strong bg-white px-3 py-2">{item}</span>)}
      </div>
    )
  }
  if (type === "rules") {
    return (
      <div className="mt-10 space-y-2">
        {["Service boundary", "Price validation", "Customer consent"].map((item) => (
          <div key={item} className="flex items-center justify-between border-t border-line pt-2 text-[10px] text-ink-muted">
            {item}<CheckCircle size={14} weight="fill" className="text-ink" />
          </div>
        ))}
      </div>
    )
  }
  if (type === "payment") {
    return (
      <div className="mt-10 border border-line-strong bg-ink p-4 text-white">
        <div className="flex items-center justify-between font-mono text-[9px] text-white/45"><span>AUTHORIZATION</span><span className="text-signal">SECURED</span></div>
        <p className="mt-5 text-2xl font-semibold">$186.00</p>
      </div>
    )
  }
  return (
    <div className="mt-10 grid grid-cols-4 gap-px bg-line-strong">
      {[MapPin, CalendarCheck, Database, CirclesFour].map((Icon, index) => (
        <div key={index} className="flex h-16 items-center justify-center bg-white"><Icon size={20} weight="duotone" /></div>
      ))}
    </div>
  )
}
