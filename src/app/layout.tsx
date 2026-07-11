import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google"
import "./globals.css"

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3f3ef",
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://volimox.com"),
  title: {
    default: "Volimox | Operational AI Systems",
    template: "%s | Volimox",
  },
  description: "Operational AI systems that turn customer conversations into completed work.",
  openGraph: {
    title: "Volimox | Conversation to completion",
    description: "Operational AI systems that quote, collect, schedule, dispatch, and update your business tools.",
    images: [{ url: "/brand/convergence-network.png", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Volimox | Conversation to completion",
    description: "Operational AI systems that turn customer conversations into completed work.",
    images: ["/brand/convergence-network.png"],
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  )
}
