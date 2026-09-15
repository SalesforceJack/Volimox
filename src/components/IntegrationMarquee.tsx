import { integrationCatalog } from "@/config/integrationCatalog"

const featuredSlugs = ["twilio", "stripe", "google-calendar", "salesforce", "limo-anywhere"] as const
const platforms = featuredSlugs.flatMap((slug) => {
  const integration = integrationCatalog.find((item) => item.slug === slug)
  return integration ? [{ name: integration.name, src: integration.logo.src }] : []
})

export function IntegrationMarquee() {
  return (
    <section className="border-b border-line bg-white py-8 sm:py-10" aria-labelledby="integration-marquee-title">
      <p
        id="integration-marquee-title"
        className="px-5 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint"
      >
        Representative workflow connections
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
      {platforms.map(({ name, src }) => (
        <div key={name} className="integration-logo" aria-label={name}>
          <img src={src} alt="" aria-hidden="true" loading="eager" />
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}
