"use client"

import { useState } from "react"
import { List, X } from "@phosphor-icons/react"
import { BrandMark } from "@/components/BrandMark"

const links = [
  { href: "#system", label: "How it works" },
  { href: "#capabilities", label: "Systems" },
  { href: "#proof", label: "Proof" },
  { href: "#guardrails", label: "Guardrails" },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/80 bg-canvas/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a href="#top" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
          <BrandMark />
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-muted lg:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        <a href="#contact" className="button-primary hidden sm:inline-flex" data-cta="header-operation-map">
          Map my operation
        </a>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-white text-ink sm:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} weight="bold" /> : <List size={22} weight="bold" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-menu" className="border-t border-line bg-canvas px-5 pb-6 pt-4 sm:hidden" aria-label="Mobile navigation">
          <div className="flex flex-col">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="border-b border-line py-4 text-lg font-medium text-ink"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a href="#contact" className="button-primary mt-5 justify-center" data-cta="mobile-operation-map" onClick={() => setOpen(false)}>
              Map my operation
            </a>
          </div>
        </nav>
      )}
    </header>
  )
}
