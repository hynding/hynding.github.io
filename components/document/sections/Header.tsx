import type { Resume } from "@/lib/resume/schema"
import { PrivateValue } from "@/components/privacy/PrivateValue"

export function Header({ basics }: { basics: Resume["basics"] }) {
  return (
    <header className="border-b border-[var(--rule)] pb-4">
      <h1 className="text-3xl font-semibold tracking-tight">{basics.name}</h1>
      <p className="text-[var(--muted)]">{basics.role}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li><PrivateValue field={basics.email} /></li>
        <li><PrivateValue field={basics.phone} /></li>
        <li><a href={basics.website} className="text-[var(--accent)]">{basics.website}</a></li>
      </ul>
    </header>
  )
}
