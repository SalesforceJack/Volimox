import { ArrowLeft, Check } from "@phosphor-icons/react/dist/ssr"
import { BrandMark } from "@/components/BrandMark"

export const metadata = {
  title: "Operation brief received",
  description: "Your Volimox operation brief has been received.",
}

export default function ThankYouPage() {
  return (
    <main className="flex min-h-[100dvh] items-center bg-canvas px-5 py-16 text-ink">
      <div className="mx-auto w-full max-w-3xl border border-line-strong bg-white p-7 sm:p-12">
        <BrandMark />
        <div className="mt-16 flex h-14 w-14 items-center justify-center bg-signal">
          <Check size={26} weight="bold" />
        </div>
        <p className="section-kicker mt-8">Operation brief received</p>
        <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl">We have the starting point.</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted">
          We will review the workflow, identify the decision and fulfillment layers, and follow up with a practical next step.
        </p>
        <a href="/" className="button-primary mt-10">
          <ArrowLeft size={16} weight="bold" />
          Return to Volimox
        </a>
      </div>
    </main>
  )
}
