import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"

const sans = localFont({
  src: "./fonts/space-grotesk-latin-variable.woff2",
  weight: "300 700",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
})

const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
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
    default: "Volimox | Voice and operations for limo businesses",
    template: "%s | Volimox",
  },
  description: "Voice for your existing limo booking system, or a branded website, booking flow, and operations portal managed by Volimox.",
  openGraph: {
    title: "Volimox | Voice and operations for limo businesses",
    description: "Voice for your existing booking system, or your own branded website, booking flow, and operations portal.",
    images: [{ url: "/brand/convergence-network.png", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Volimox | Voice and operations for limo businesses",
    description: "Voice, booking, and operations software for limo and black car businesses.",
    images: ["/brand/convergence-network.png"],
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  )
}
