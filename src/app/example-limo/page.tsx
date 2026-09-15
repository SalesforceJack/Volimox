import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import { ExampleLimoWalkthrough } from "@/components/ExampleLimoWalkthrough"
import { ProtonLiveBooking } from "@/components/ProtonLiveBooking"
import { SiteHeader } from "@/components/SiteHeader"
import { VolimoxFooter } from "@/components/VolimoxFooter"

export const metadata: Metadata = {
  title: "Example Limo booking walkthrough",
  description: "Explore trip intake, vehicle pricing, customer approval and the booking handoff in Volimox.",
}

export const dynamic = "force-dynamic"

export default function ExampleLimoPage() {
  const localPreview = process.env.NODE_ENV !== "production" && process.env.VOLIMOX_LOCAL_DEMO === "true"
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <SiteHeader homePage={false} />
      <div className="pt-[72px]">
        <div className="mx-auto max-w-[1440px] px-5 pt-8 sm:px-8 lg:px-12">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft size={16} /> Back to Volimox
          </Link>
        </div>
        {localPreview ? <ExampleLimoWalkthrough /> : <ProtonLiveBooking />}
      </div>
      <VolimoxFooter />
    </main>
  )
}
