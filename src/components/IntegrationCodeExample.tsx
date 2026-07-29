import { Code, CopySimple, Key, ShieldCheck } from "@phosphor-icons/react/dist/ssr"
import type { IntegrationDefinition } from "@/config/integrationCatalog"
import { buildZapierSdkSnippet, integrationCodeExamples } from "@/config/integrationCodeExamples"

export function IntegrationCodeExample({ app }: { app: IntegrationDefinition }) {
  const config = integrationCodeExamples[app.slug as keyof typeof integrationCodeExamples]
  const snippet = buildZapierSdkSnippet(app.name, config)

  return (
    <section id="code" className="mt-16 scroll-mt-28 border-t border-line pt-8">
      <div className="flex items-start gap-4">
        <span className="pt-1 font-mono text-[10px] text-ink-faint">03</span>
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Detailed connection code.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-muted">
            This server-side TypeScript reference follows the same connection → action → mapped input pattern used by modern automation platforms. Provider credentials remain inside the approved connection; browser code never receives them.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-px bg-line-strong lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 bg-[#10100f] p-5 text-white sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-4">
            <div className="flex items-center gap-3">
              <Code size={19} weight="duotone" className="text-signal" aria-hidden="true" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">TypeScript · server only</p>
                <p className="mt-1 text-sm font-semibold">{config.actionLabel}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
              <CopySimple size={14} aria-hidden="true" />
              Copy-ready reference
            </span>
          </div>
          <pre className="mt-5 overflow-x-auto text-[12px] leading-6 text-white/72">
            <code>{snippet}</code>
          </pre>
        </div>

        <aside className="bg-white p-6 sm:p-7">
          <p className="section-kicker">Install</p>
          <code className="mt-3 block break-all bg-canvas-muted p-3 font-mono text-[11px] leading-5 text-ink">npm install @zapier/zapier-sdk</code>

          <div className="mt-7 border-t border-line pt-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Key size={17} className="text-signal" aria-hidden="true" />
              Required environment
            </div>
            <ul className="mt-4 space-y-2">
              {config.requiredEnv.map((name) => (
                <li key={name} className="font-mono text-[11px] text-ink-muted">{name}</li>
              ))}
            </ul>
          </div>

          <div className="mt-7 border-t border-line pt-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={17} className="text-signal" aria-hidden="true" />
              Production checks
            </div>
            <ul className="mt-4 space-y-3">
              {config.notes.map((note) => (
                <li key={note} className="text-xs leading-5 text-ink-muted">{note}</li>
              ))}
            </ul>
          </div>

          <p className="mt-7 border-t border-line pt-5 text-xs leading-5 text-ink-faint">{config.connectionHint}</p>
        </aside>
      </div>

      <div className="mt-5 border-l-2 border-signal bg-canvas-muted p-5 text-xs leading-6 text-ink-muted">
        Action identifiers and available fields can vary by provider account, connector version, and plan. Validate the selected action in a sandbox connection before production activation.
      </div>
    </section>
  )
}
