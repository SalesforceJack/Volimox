import type { IntegrationDefinition } from "@/config/integrationCatalog"

type AppLogoProps = {
  app: Pick<IntegrationDefinition, "name" | "logo">
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
} as const

export function AppLogo({ app, size = "md" }: AppLogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[0.85rem] border border-line-strong bg-white p-2 shadow-[0_8px_24px_rgba(24,25,20,0.06)] ${sizeClasses[size]}`}
    >
      {app.logo.type === "simple" ? (
        <svg
          viewBox="0 0 24 24"
          role="img"
          aria-label={`${app.name} logo`}
          className="h-full w-full"
          style={{ color: `#${app.logo.icon.hex}` }}
        >
          <path d={app.logo.icon.path} fill="currentColor" />
        </svg>
      ) : (
        <img
          src={app.logo.src}
          alt={`${app.name} logo`}
          className="h-full w-full object-contain"
          loading="eager"
          referrerPolicy="no-referrer"
        />
      )}
    </span>
  )
}
