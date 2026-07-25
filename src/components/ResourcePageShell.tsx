import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import { SiteHeader } from "@/components/SiteHeader"
import { VolimoxFooter } from "@/components/VolimoxFooter"

export type ResourcePageSection = {
  id: string
  label: string
}

type ResourcePageShellProps = {
  eyebrow: string
  title: string
  description: string
  badge: string
  sections: ResourcePageSection[]
  children: ReactNode
}

export function ResourcePageShell({
  eyebrow,
  title,
  description,
  badge,
  sections,
  children,
}: ResourcePageShellProps) {
  return (
    <main className="min-h-screen overflow-clip bg-canvas text-ink">
      <SiteHeader homePage={false} />

      <section className="border-b border-line pt-[72px]">
        <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
            <Link href="/" className="inline-flex items-center gap-2 transition-colors hover:text-ink">
              <ArrowLeft size={15} />
              Back to Volimox
            </Link>
            <span className="h-px w-8 bg-line-strong" aria-hidden="true" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">{badge}</span>
          </div>
          <div className="mt-14 max-w-4xl">
            <p className="section-kicker">{eyebrow}</p>
            <h1 className="mt-5 max-w-4xl text-[clamp(3rem,8vw,7rem)] font-semibold leading-[0.9] tracking-[-0.075em]">
              {title}
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">{description}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[220px_1fr] lg:gap-20 lg:px-12">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="section-kicker">On this page</p>
          <nav className="mt-5 border-t border-line-strong" aria-label="Page sections">
            {sections.map((section, index) => (
              <a
                key={section.id}
                href={"#" + section.id}
                className="flex items-center gap-3 border-b border-line py-3 text-xs text-ink-muted transition-colors hover:text-ink"
              >
                <span className="font-mono text-[9px] text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
                {section.label}
              </a>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 max-w-4xl">{children}</article>
      </div>

      <VolimoxFooter />
    </main>
  )
}

type ResourceSectionProps = {
  id: string
  index: number
  title: string
  children: ReactNode
}

export function ResourceSection({ id, index, title, children }: ResourceSectionProps) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-4">
        <span className="pt-1 font-mono text-[10px] text-ink-faint">{String(index).padStart(2, "0")}</span>
        <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{title}</h2>
      </div>
      <div className="mt-5 space-y-5 pl-9 text-sm leading-7 text-ink-muted">{children}</div>
    </section>
  )
}
