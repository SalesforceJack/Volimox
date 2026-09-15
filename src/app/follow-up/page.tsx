import type { Metadata } from "next"
import { MoxFollowUpDemo } from "@/components/MoxFollowUpDemo"
import { SiteHeader } from "@/components/SiteHeader"
import { VolimoxFooter } from "@/components/VolimoxFooter"

export const metadata: Metadata = {
  title: "Mox Follow-Up | Volimox",
  description: "Recover missed calls with a text-back workflow that qualifies the request and prepares a lead for follow-up.",
}

export default function FollowUpPage() {
  return (
    <main className="bg-canvas text-ink">
      <SiteHeader homePage={false} />
      <div className="pt-[72px]">
        <MoxFollowUpDemo contactHref="/#contact" />
      </div>
      <VolimoxFooter />
    </main>
  )
}
