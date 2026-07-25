"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Check,
  Funnel,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react"
import {
  integrationCatalog,
  integrationCategories,
  type IntegrationStatus,
} from "@/config/integrationCatalog"
import { AppLogo } from "@/components/AppLogo"

type StatusFilter = "all" | IntegrationStatus

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "in-use", label: "Used in Volimox" },
  { value: "next", label: "Next connectors" },
  { value: "planned", label: "Planned" },
]

const statusTone: Record<IntegrationStatus, string> = {
  "in-use": "bg-[#e9f2dc] text-[#446026]",
  next: "bg-[#fff1bf] text-[#6d5500]",
  planned: "bg-canvas-muted text-ink-muted",
}

export function AppDirectory() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<(typeof integrationCategories)[number]>("All apps")
  const [status, setStatus] = useState<StatusFilter>("all")

  const filteredApps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return integrationCatalog.filter((app) => {
      const matchesCategory = category === "All apps" || app.category === category
      const matchesStatus = status === "all" || app.status === status
      const searchableText = [app.name, app.category, app.description, app.fit].join(" ").toLowerCase()
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery)

      return matchesCategory && matchesStatus && matchesQuery
    })
  }, [category, query, status])

  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 lg:px-12">
      <section className="grid gap-10 border-b border-line py-12 sm:py-16 lg:grid-cols-[1fr_430px] lg:items-end lg:gap-20 lg:py-20">
        <div>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <Sparkle size={15} weight="duotone" className="text-signal" />
            <span>Product directory</span>
            <span className="h-px w-10 bg-line-strong" aria-hidden="true" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">{integrationCatalog.length} app definitions</span>
          </div>
          <h1 className="mt-7 max-w-4xl text-[clamp(3.2rem,8vw,7rem)] font-semibold leading-[0.89] tracking-[-0.08em] text-ink">
            Apps that carry the work forward.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">
            Browse the tools Volimox can connect to customer intake, booking, dispatch, payment, and follow-up workflows. Every app has a job, a boundary, and a visible setup path.
          </p>
        </div>

        <div className="relative">
          <label htmlFor="app-search" className="section-kicker">
            Search connections
          </label>
          <div className="mt-3 flex min-h-14 items-center gap-3 border-b-2 border-ink bg-white px-4">
            <MagnifyingGlass size={22} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <input
              id="app-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by app, category, or workflow"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-faint">
            Search is local to this catalog. Connection availability still depends on account access and the selected workflow.
          </p>
        </div>
      </section>

      <div className="grid gap-10 pt-12 lg:grid-cols-[230px_1fr] lg:gap-16 lg:pt-16">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Funnel size={16} weight="duotone" aria-hidden="true" />
            Filter apps
          </div>

          <div className="mt-5 border-t border-line-strong">
            <p className="section-kicker border-b border-line py-3">Categories</p>
            <div className="border-b border-line pb-3">
              {integrationCategories.map((item) => {
                const active = category === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`flex w-full items-center justify-between border-b border-line py-3 text-left text-sm transition-colors last:border-0 ${active ? "font-semibold text-ink" : "text-ink-muted hover:text-ink"}`}
                    aria-pressed={active}
                  >
                    <span>{item}</span>
                    {active ? <Check size={14} weight="bold" className="text-signal" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-7 border-t border-line-strong">
            <p className="section-kicker border-b border-line py-3">Status</p>
            <div className="border-b border-line pb-3">
              {statusFilters.map((item) => {
                const active = status === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatus(item.value)}
                    className={`flex w-full items-center justify-between border-b border-line py-3 text-left text-sm transition-colors last:border-0 ${active ? "font-semibold text-ink" : "text-ink-muted hover:text-ink"}`}
                    aria-pressed={active}
                  >
                    <span>{item.label}</span>
                    {active ? <Check size={14} weight="bold" className="text-signal" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <section aria-labelledby="app-results-title">
          <div className="flex flex-col justify-between gap-4 border-b border-line-strong pb-5 sm:flex-row sm:items-end">
            <div>
              <p className="section-kicker">Browse the catalog</p>
              <h2 id="app-results-title" className="mt-2 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">
                {filteredApps.length} {filteredApps.length === 1 ? "connection" : "connections"}
              </h2>
            </div>
            <p className="max-w-xs text-left text-xs leading-5 text-ink-faint sm:text-right">
              Open an app to see the workflows, permissions, and configuration path that belong to it.
            </p>
          </div>

          {filteredApps.length > 0 ? (
            <div className="mt-6 grid gap-px bg-line-strong md:grid-cols-2">
              {filteredApps.map((app) => (
                <Link
                  key={app.slug}
                  href={`/apps/${app.slug}`}
                  className="group flex min-h-[260px] flex-col bg-canvas-muted p-5 transition-colors hover:bg-white focus-visible:bg-white sm:p-7"
                >
                  <div className="flex items-start justify-between gap-4">
                    <AppLogo app={app} size="sm" />
                    <ArrowUpRight size={18} className="text-ink-faint transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </div>
                  <div className="mt-auto pt-12">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">{app.category}</span>
                      <span className={`px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${statusTone[app.status]}`}>{app.statusLabel}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-ink">{app.name}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">{app.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 border border-line-strong bg-canvas-muted p-8 sm:p-12">
              <p className="section-kicker">No matching apps</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Try a broader search.</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-ink-muted">Clear the search or choose another category to see the full Volimox catalog.</p>
              <button
                type="button"
                className="button-secondary mt-6"
                onClick={() => {
                  setQuery("")
                  setCategory("All apps")
                  setStatus("all")
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
