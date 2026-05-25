import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Volimox — Enterprise AI Automation Agency",
  description:
    "Full-stack autonomous conversational systems for logistics, manufacturing, real estate, and healthcare.",
  keywords: [
    "enterprise AI",
    "conversational AI",
    "autonomous dispatch",
    "B2B AI orchestration",
    "AI automation agency",
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.className} min-h-screen bg-zinc-950 text-white antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
