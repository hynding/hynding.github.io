import type { Metadata } from "next"
import { PREPAINT_SCRIPT, themeCss } from "@/lib/theme/themes"
import "./globals.css"

export const metadata: Metadata = {
  title: "Steve Hynding — Full-stack Engineer",
  description: "Resume and portfolio of Steve Hynding, full-stack engineer and UX specialist.",
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
