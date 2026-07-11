import type { SimpleIcon } from "simple-icons"
import {
  siAirtable,
  siCalendly,
  siGmail,
  siGooglemaps,
  siHubspot,
  siShopify,
  siStripe,
  siZendesk,
} from "simple-icons"

const platforms: Array<{ name: string; icon: SimpleIcon }> = [
  { name: "Google Maps", icon: siGooglemaps },
  { name: "Stripe", icon: siStripe },
  { name: "HubSpot", icon: siHubspot },
  { name: "Gmail", icon: siGmail },
  { name: "Airtable", icon: siAirtable },
  { name: "Calendly", icon: siCalendly },
  { name: "Zendesk", icon: siZendesk },
  { name: "Shopify", icon: siShopify },
]

export function IntegrationMarquee() {
  return (
    <section className="border-b border-line bg-white py-8 sm:py-10" aria-labelledby="integration-marquee-title">
      <p
        id="integration-marquee-title"
        className="px-5 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
      >
        Built to orchestrate the tools your team already uses
      </p>

      <div className="integration-marquee mt-8 overflow-hidden sm:mt-10">
        <div className="integration-marquee-track">
          <LogoGroup />
          <div className="integration-marquee-copy" aria-hidden="true">
            <LogoGroup />
          </div>
        </div>
      </div>
    </section>
  )
}

function LogoGroup() {
  return (
    <div className="integration-logo-group">
      {platforms.map(({ name, icon }) => (
        <div key={name} className="integration-logo" aria-label={name}>
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path d={icon.path} fill="currentColor" />
          </svg>
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}
