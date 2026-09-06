import type { Metadata } from "next"
import { loadResume } from "@/lib/resume/load"
import { jsonLdScript } from "@/lib/seo/jsonld"
import { PREPAINT_SCRIPT, themeCss } from "@/lib/theme/themes"
import "./globals.css"

const SITE = "https://hynding.github.io"

export const metadata: Metadata = {
  // Without this, Next emits og:image as http://localhost:3000/... The build
  // succeeds, the site looks correct, and every Slack and LinkedIn preview is
  // broken. Verified by spike on 2026-09-03.
  metadataBase: new URL(SITE),
  alternates: { canonical: "/" },
  title: "Steve Hynding — Lead Full-Stack Engineer",
  description:
    "Resume and portfolio of Steve Hynding, Lead Full-Stack Engineer in Los Angeles — two decades shipping web products for EA, Sony, BCG X and venture clients in TypeScript, React, Node and Next.js.",
  openGraph: {
    type: "website",
    url: SITE,
    title: "Steve Hynding — Lead Full-Stack Engineer",
    description:
      "Resume and portfolio of Steve Hynding, Lead Full-Stack Engineer in Los Angeles — two decades shipping web products for EA, Sony, BCG X and venture clients in TypeScript, React, Node and Next.js.",
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(loadResume()) }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
