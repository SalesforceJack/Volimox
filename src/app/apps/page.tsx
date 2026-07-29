import type { Metadata } from "next"
import { AppDirectory } from "@/components/AppDirectory"
import { SiteHeader } from "@/components/SiteHeader"
import { VolimoxFooter } from "@/components/VolimoxFooter"

export const metadata: Metadata = {
  title: "Apps and connections",
  description: "Browse the customer apps Volimox can connect to intake, booking, dispatch, payment, and follow-up workflows.",
}

export default function AppsPage() {
  return (
    <main className="min-h-screen overflow-clip bg-canvas text-ink">
      <SiteHeader homePage={false} />
      <div className="pt-[72px]">
        <AppDirectory />
      </div>
      <VolimoxFooter />
    </main>
  )
}
