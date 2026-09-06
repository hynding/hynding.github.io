import type { Resume } from "@/lib/resume/schema"
import { PrivateValue } from "@/components/privacy/PrivateValue"

export function Header({ basics }: { basics: Resume["basics"] }) {
  return (
    <header className="border-b border-[var(--rule)] pb-4">
      <h1 className="text-3xl font-semibold tracking-tight">{basics.name}</h1>
      <p className="text-[var(--muted)]">{basics.role}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {basics.location ? <li>{basics.location}</li> : null}
        <li><PrivateValue field={basics.email} /></li>
        <li><PrivateValue field={basics.phone} /></li>
        {(basics.profiles ?? []).map((profile) => (
          <li key={profile.id}>
            <a href={profile.url} className="text-[var(--accent)]" rel="me">
              {profile.network}
            </a>
          </li>
        ))}
      </ul>
    </header>
  )
}
