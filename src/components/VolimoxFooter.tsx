import Link from "next/link"
import { ArrowUpRight, EnvelopeSimple, MapPin, Phone } from "@phosphor-icons/react/dist/ssr"
import { BrandMark } from "@/components/BrandMark"
import { SITE_CONTACT } from "@/config/siteContact"

const footerLinks = [
  { href: "/apps", label: "Apps" },
  { href: "/privacy", label: "Privacy" },
  { href: "/legal", label: "Legal" },
  { href: "/#contact", label: "Contact" },
]

export function VolimoxFooter() {
  return (
    <footer className="border-t border-line bg-ink text-white">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_0.8fr] lg:px-12">
        <div>
          <Link href="/" aria-label="Volimox home">
            <BrandMark inverted />
          </Link>
          <p className="mt-6 max-w-md text-sm leading-7 text-white/55">
            Operational AI systems that move service businesses from conversation to completed work.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/65">
            <a className="flex items-center gap-3 transition-colors hover:text-signal" href={"tel:" + SITE_CONTACT.phoneTel}>
              <Phone size={16} className="text-signal" aria-hidden="true" />
              <span>{SITE_CONTACT.phoneDisplay}</span>
            </a>
            <a className="flex items-center gap-3 transition-colors hover:text-signal" href={"mailto:" + SITE_CONTACT.email}>
              <EnvelopeSimple size={16} className="text-signal" aria-hidden="true" />
              <span>{SITE_CONTACT.email}</span>
            </a>
            <span className="flex items-start gap-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
              <span>{SITE_CONTACT.address}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-10">
          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-px bg-white/15">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex min-h-16 items-center justify-between bg-ink px-4 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
              >
                {link.label}
                <ArrowUpRight size={16} className="text-white/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal" />
              </Link>
            ))}
          </nav>
          <p className="max-w-sm text-xs leading-6 text-white/40">
            The website includes interactive demonstrations. Results shown in a demo are illustrative unless a separate agreement says otherwise.
          </p>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 border-t border-white/15 px-5 py-5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span>© {new Date().getFullYear()} Volimox</span>
        <span>AI systems for real operations</span>
      </div>
    </footer>
  )
}
