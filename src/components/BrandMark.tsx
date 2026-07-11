import { cn } from "@/lib/utils"

type BrandMarkProps = {
  compact?: boolean
  inverted?: boolean
  className?: string
}

export function BrandMark({ compact = false, inverted = false, className }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)} aria-label="Volimox home">
      <span className="brand-symbol" aria-hidden="true">
        <span className="brand-rail brand-rail-left" />
        <span className="brand-rail brand-rail-right" />
        <span className="brand-node" />
      </span>
      {!compact && (
        <span
          className={cn(
            "text-[0.84rem] font-semibold uppercase tracking-[0.34em]",
            inverted ? "text-white" : "text-ink",
          )}
        >
          Volimox
        </span>
      )}
    </span>
  )
}
