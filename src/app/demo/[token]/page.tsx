import { notFound } from "next/navigation"
import { ArrowUpRight, CheckCircle, Lightning, Path, Wrench } from "@phosphor-icons/react/dist/ssr"
import { BrandMark } from "@/components/BrandMark"
import { DemoContinuationForm } from "@/components/DemoContinuationForm"
import { readDemoToken } from "@/lib/volimox-demo"

export const dynamic = "force-dynamic"

export default async function DemoContinuationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const demo = readDemoToken(token)
  if (!demo) notFound()

  const routeSummary = `${demo.distanceMiles.toFixed(1)} miles, ${demo.durationMinutes} minutes, and an illustrative $${demo.estimatedValueUsd.toFixed(2)} operational outcome`

  return (
    <main className="min-h-[100dvh] bg-ink text-white">
      <header className="border-b border-white/15">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8">
          <BrandMark inverted />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">Volimox live continuation</span>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1240px] gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.76fr_1.24fr] lg:py-28">
        <div>
          <p className="section-kicker text-signal">Your live system run</p>
          <h1 className="mt-5 text-[clamp(3rem,7vw,5.9rem)] font-semibold leading-[0.92] tracking-[-0.065em]">You saw the tools move.</h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-white/55">Now show us the operation that should move this way in your business.</p>

          <div className="mt-12 space-y-4 border-t border-white/15 pt-6">
            <RunFact icon={Path} title="Route intelligence" copy={`${demo.distanceMiles.toFixed(1)} miles and ${demo.durationMinutes} minutes resolved by a live routing tool.`} />
            <RunFact icon={Lightning} title="Decision logic" copy={`A mile-price engine returned an illustrative $${demo.estimatedValueUsd.toFixed(2)} outcome without a human calculation.`} />
            <RunFact icon={Wrench} title="Reusable system" copy="The same pattern can qualify, schedule, quote, collect, and record work for your industry." />
          </div>
        </div>

        <div className="border border-white/15 bg-white/[0.035] p-5 sm:p-8 lg:p-10">
          <div className="mb-8 flex items-start justify-between gap-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Make it yours</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">What should your agent complete?</h2>
            </div>
            <ArrowUpRight size={22} weight="bold" className="shrink-0 text-signal" />
          </div>
          <DemoContinuationForm token={token} routeSummary={routeSummary} />
        </div>
      </section>

      <footer className="border-t border-white/15 px-5 py-6 sm:px-8"><p className="mx-auto flex max-w-[1240px] items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/35"><CheckCircle size={14} weight="fill" className="text-signal" />No payment was taken in this demonstration.</p></footer>
    </main>
  )
}

function RunFact({ icon: Icon, title, copy }: { icon: typeof Path; title: string; copy: string }) {
  return <div className="flex gap-3"><Icon size={20} weight="duotone" className="mt-0.5 shrink-0 text-signal" /><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-white/45">{copy}</p></div></div>
}
