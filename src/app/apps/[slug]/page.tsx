import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleNotch,
  LockKey,
  PlugsConnected,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr"
import { AppLogo } from "@/components/AppLogo"
import { IntegrationCodeExample } from "@/components/IntegrationCodeExample"
import { SiteHeader } from "@/components/SiteHeader"
import { VolimoxFooter } from "@/components/VolimoxFooter"
import { getIntegration, integrationCatalog } from "@/config/integrationCatalog"
import { integrationWorkflowScenarios } from "@/config/integrationWorkflowScenarios"

type AppDetailPageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return integrationCatalog.map((app) => ({ slug: app.slug }))
}

export async function generateMetadata({ params }: AppDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const app = getIntegration(slug)
  if (!app) return { title: "App not found" }

  return {
    title: `${app.name} connection`,
    description: `${app.name} workflows, permissions, connection setup, and TypeScript examples for Volimox.`,
  }
}

export default async function AppDetailPage({ params }: AppDetailPageProps) {
  const { slug } = await params
  const app = getIntegration(slug)
  if (!app) notFound()

  const relatedApps = app.related
    .map((name) => integrationCatalog.find((candidate) => candidate.name === name))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .slice(0, 3)

  const primaryCta = app.status === "in-use" ? "Request this connection" : "Request a pilot"
  const workflowScenarios = integrationWorkflowScenarios[app.slug]

  return (
    <main className="min-h-screen overflow-clip bg-canvas text-ink">
      <SiteHeader homePage={false} />

      <div className="pt-[72px]">
        <section className="border-b border-line">
          <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
            <Link href="/apps" className="inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to apps
            </Link>

            <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_420px] lg:items-end lg:gap-20">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <AppLogo app={app} size="lg" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.17em] text-ink-faint">{app.category}</span>
                    <span className="h-1 w-1 bg-signal" aria-hidden="true" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.17em] text-ink-faint">{app.statusLabel}</span>
                  </div>
                </div>
                <h1 className="mt-8 max-w-4xl text-[clamp(3.2rem,8vw,7rem)] font-semibold leading-[0.88] tracking-[-0.08em]">
                  {app.name} <span className="text-ink-muted">× Volimox</span>
                </h1>
                <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-muted">{app.description}</p>
                <p className="mt-4 max-w-xl text-sm leading-6 text-ink-faint">{app.fit}</p>
              </div>

              <div className="border-l-2 border-signal pl-5 sm:pl-7">
                <p className="section-kicker">Connection boundary</p>
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  Volimox only takes the permissions this workflow needs. The account owner reviews access before anything is activated.
                </p>
                <a href="#connection" className="button-primary mt-6">
                  {primaryCta}
                  <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[220px_1fr] lg:gap-20 lg:px-12">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <p className="section-kicker">On this app</p>
            <nav className="mt-5 border-t border-line-strong" aria-label={`${app.name} page sections`}>
              {[
                ["workflows", "Workflows"],
                ["capabilities", "Triggers and actions"],
                ["code", "Connection code"],
                ["connection", "Connection setup"],
              ].map(([id, label], index) => (
                <a key={id} href={`#${id}`} className="flex items-center gap-3 border-b border-line py-3 text-xs text-ink-muted transition-colors hover:text-ink">
                  <span className="font-mono text-[9px] text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 max-w-5xl">
            <section id="workflows" className="scroll-mt-28 border-t border-line pt-8">
              <div className="flex items-start gap-4">
                <span className="pt-1 font-mono text-[10px] text-ink-faint">01</span>
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Special workflows for {app.name}.</h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-muted">Each scenario shows the trigger, the Volimox handoff, and the human checkpoint. These are concrete workflow blueprints, not a claim that every connection is live today.</p>
                </div>
              </div>

              <div className="mt-8 space-y-px bg-line-strong">
                {workflowScenarios.map((workflow, index) => (
                  <article key={workflow.title} className="bg-canvas-muted p-6 sm:p-8 lg:p-10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Use case {String(index + 1).padStart(2, "0")}</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{app.name} × Volimox</span>
                    </div>
                    <h3 className="mt-8 max-w-3xl text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">{workflow.title}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">{workflow.summary}</p>

                    <div className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
                      <div>
                        <p className="section-kicker">Starts when</p>
                        <p className="mt-3 text-sm leading-6 text-ink">{workflow.trigger}</p>
                      </div>
                      <div>
                        <p className="section-kicker">Result</p>
                        <p className="mt-3 text-sm leading-6 text-ink">{workflow.outcome}</p>
                      </div>
                    </div>

                    <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                      <div>
                        <p className="section-kicker">Volimox workflow</p>
                        <ol className="mt-4 space-y-3">
                          {workflow.steps.map((step, stepIndex) => (
                            <li key={step} className="flex gap-4 border-t border-line pt-3 text-sm leading-6 text-ink-muted">
                              <span className="font-mono text-[10px] text-ink-faint">{String(stepIndex + 1).padStart(2, "0")}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="border-l-2 border-signal pl-5 sm:pl-6">
                        <p className="section-kicker">Human checkpoint</p>
                        <p className="mt-3 text-sm leading-6 text-ink-muted">{workflow.checkpoint}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section id="capabilities" className="mt-16 scroll-mt-28 border-t border-line pt-8">
              <div className="flex items-start gap-4">
                <span className="pt-1 font-mono text-[10px] text-ink-faint">02</span>
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Supported triggers and actions.</h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-muted">A trigger starts the workflow. An action is the controlled operation Volimox performs after the rules pass.</p>
                </div>
              </div>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <CapabilityList title="Triggers" items={app.triggers} />
                <CapabilityList title="Actions" items={app.actions} />
              </div>
            </section>

            <IntegrationCodeExample app={app} />

            <section id="connection" className="mt-16 scroll-mt-28 border-t border-line pt-8">
              <div className="flex items-start gap-4">
                <span className="pt-1 font-mono text-[10px] text-ink-faint">04</span>
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Connection setup.</h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-muted">The setup path is specific to the provider. We will never ask you to paste credentials into a public page.</p>
                </div>
              </div>

              <div className="mt-8 grid gap-px bg-line-strong lg:grid-cols-[1.05fr_0.95fr]">
                <div className="bg-ink p-6 text-white sm:p-8">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">{app.authLabel}</p>
                      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">A reviewable connection, step by step.</h3>
                    </div>
                    <PlugsConnected size={25} weight="duotone" className="text-signal" aria-hidden="true" />
                  </div>
                  <ol className="mt-10 space-y-5">
                    {app.setup.map((step, index) => (
                      <li key={step} className="flex gap-4 border-t border-white/15 pt-4 text-sm leading-6 text-white/65">
                        <span className="font-mono text-[10px] text-white/35">{String(index + 1).padStart(2, "0")}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex flex-col justify-between bg-white p-6 sm:p-8">
                  <div>
                    <div className="flex items-center gap-3 text-sm font-semibold">
                      {app.status === "in-use" ? <ShieldCheck size={19} weight="duotone" className="text-[#557a2d]" /> : <CircleNotch size={19} className="text-signal" />}
                      {app.statusLabel}
                    </div>
                    <p className="mt-5 text-sm leading-6 text-ink-muted">
                      {app.status === "in-use"
                        ? "This provider already powers a Volimox demonstration path. Customer-level connection management is the next console step."
                        : "This app is cataloged and its workflow contract is defined. We will enable the connection after provider access and sandbox verification."}
                    </p>
                  </div>
                  <div className="mt-10 border-t border-line pt-5">
                    <div className="flex items-start gap-3 text-xs leading-5 text-ink-faint">
                      <LockKey size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>Tokens and provider credentials belong in the authenticated connection console, never in this public page.</span>
                    </div>
                    <a href="/#contact" className="button-signal mt-6">
                      {primaryCta}
                      <ArrowRight size={16} weight="bold" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {relatedApps.length > 0 ? (
              <section className="mt-16 border-t border-line pt-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="section-kicker">Related apps</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-[-0.045em]">Common handoffs with {app.name}.</h2>
                  </div>
                  <ArrowUpRight size={20} className="text-ink-faint" aria-hidden="true" />
                </div>
                <div className="mt-6 grid gap-px bg-line-strong sm:grid-cols-3">
                  {relatedApps.map((related) => (
                    <Link key={related.slug} href={`/apps/${related.slug}`} className="group bg-canvas-muted p-5 transition-colors hover:bg-white">
                      <AppLogo app={related} size="sm" />
                      <h3 className="mt-8 text-lg font-semibold tracking-[-0.035em]">{related.name}</h3>
                      <p className="mt-2 text-xs leading-5 text-ink-muted">{related.category}</p>
                      <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-ink">View app <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-16 border-t border-line pt-6 text-xs leading-6 text-ink-faint">
              Provider names and logos belong to their respective owners. Volimox only uses them to describe connection possibilities and configured workflows.
            </div>
          </article>
        </div>
      </div>

      <VolimoxFooter />
    </main>
  )
}

function CapabilityList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border-t border-line-strong">
      <h3 className="py-4 text-sm font-semibold text-ink">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 border-t border-line py-4 text-sm leading-6 text-ink-muted">
            <Check size={16} weight="bold" className="mt-1 shrink-0 text-signal" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
