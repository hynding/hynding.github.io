import type { Metadata } from "next"
import { PREPAINT_SCRIPT, themeCss } from "@/lib/theme/themes"
import "./globals.css"

const SITE = "https://hynding.github.io"

export const metadata: Metadata = {
  // Without this, Next emits og:image as http://localhost:3000/... The build
  // succeeds, the site looks correct, and every Slack and LinkedIn preview is
  // broken. Verified by spike on 2026-09-03.
  metadataBase: new URL(SITE),
  title: "Steve Hynding — Full-stack Engineer",
  description: "Resume and portfolio of Steve Hynding, full-stack engineer and UX specialist.",
  openGraph: {
    type: "website",
    url: SITE,
    title: "Steve Hynding — Full-stack Engineer",
    description: "Resume and portfolio of Steve Hynding, full-stack engineer and UX specialist.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Steve Hynding" }],
  },
  twitter: { card: "summary_large_image" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
