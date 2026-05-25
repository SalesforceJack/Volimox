import * as React from "react"
import { cn } from "@/lib/utils"

type ButtonVariant = "default" | "outline" | "ghost" | "link"
type ButtonSize = "default" | "sm" | "lg"

interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  type?: "button" | "submit" | "reset"
  disabled?: boolean
  children?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

function Button({
  className,
  variant = "default" as ButtonVariant,
  size = "default" as ButtonSize,
  type = "button",
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-border bg-transparent hover:bg-muted hover:text-foreground",
    ghost: "hover:bg-muted hover:text-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  }
  const sizes: Record<string, string> = {
    default: "h-8 gap-1.5 px-4 text-sm",
    sm: "h-7 gap-1 px-3 text-xs",
    lg: "h-10 gap-2 px-6 text-base",
  }
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variants[variant] ?? variants.default,
        sizes[size] ?? sizes.default,
        className
      )}
      {...props}
    />
  )
}

export { Button }
