import type { IntegrationDefinition } from "@/config/integrationCatalog"

type AppLogoProps = {
  app: Pick<IntegrationDefinition, "name" | "logo">
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "h-10 w-10 rounded-[0.55rem] p-1",
  md: "h-14 w-14 rounded-[0.7rem] p-1.5",
  lg: "h-20 w-20 rounded-[0.95rem] p-2",
} as const

export function AppLogo({ app, size = "md" }: AppLogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border border-line-strong bg-white ${sizeClasses[size]}`}
    >
      <img
        src={app.logo.src}
        alt={`${app.name} logo`}
        className="h-full w-full object-contain"
        loading="eager"
      />
    </span>
  )
}
