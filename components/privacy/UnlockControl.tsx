"use client"

import { useState } from "react"
import { useResume } from "@/components/shell/ResumeProvider"

export function UnlockControl() {
  const { unlocked, unlock, lock } = useResume()
  const [passphrase, setPassphrase] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (unlocked) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span role="status">Private details unlocked.</span>
        <button type="button" onClick={lock} className="underline underline-offset-4">
          Lock
        </button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setError(null)
        try {
          await unlock(passphrase.trim())
          setPassphrase("")
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Unlock failed.")
        } finally {
          setPending(false)
        }
      }}
    >
      <label htmlFor="passphrase">Passphrase</label>
      <input
        id="passphrase"
        name="passphrase"
        type="password"
        autoComplete="off"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
      />
      <button
        type="submit"
        disabled={pending || passphrase.trim() === ""}
        className="rounded border border-[var(--border)] px-3 py-1 disabled:opacity-50"
      >
        {pending ? "Unlocking…" : "Unlock"}
      </button>
      {error ? (
        <span role="alert" className="text-[var(--muted)]">
          {error}
        </span>
      ) : null}
    </form>
  )
}
