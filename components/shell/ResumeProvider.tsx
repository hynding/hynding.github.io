"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { resumeSchema, type Resume } from "@/lib/resume/schema"
import { merge } from "@/lib/resume/merge"
import { openVault, type VaultBlob } from "@/lib/vault/crypto"

const STORAGE_KEY = "vault-patch"

interface ResumeContextValue {
  resume: Resume
  unlocked: boolean
  unlock: (passphrase: string, audience?: string) => Promise<void>
  lock: () => void
}

const ResumeContext = createContext<ResumeContextValue | null>(null)

export function useResume(): ResumeContextValue {
  const context = useContext(ResumeContext)
  if (!context) throw new Error("useResume must be used inside ResumeProvider")
  return context
}

async function fetchAndOpen(audience: string, passphrase: string): Promise<unknown> {
  const response = await fetch(`/vault/${audience}.json`)
  if (!response.ok) throw new Error("no vault published for this audience")
  return openVault((await response.json()) as VaultBlob, passphrase)
}

export function ResumeProvider({
  resume,
  audiences,
  children,
}: {
  resume: Resume
  audiences: string[]
  children: React.ReactNode
}) {
  const [patch, setPatch] = useState<unknown>(null)

  /** Merge then validate: a partial patch cannot be validated on its own. */
  const applyPatch = useCallback(
    (candidate: unknown): Resume => resumeSchema.parse(merge(resume, candidate)),
    [resume],
  )

  const unlock = useCallback(
    async (passphrase: string, audience?: string) => {
      const candidates = audience ? [audience] : audiences
      let opened: unknown = null

      for (const name of candidates) {
        try {
          opened = await fetchAndOpen(name, passphrase)
          break
        } catch {
          // Wrong passphrase or no such blob; indistinguishable on purpose.
        }
      }

      if (opened === null) throw new Error("That passphrase did not work.")

      // Validate before storing anything. The decrypted blob is untrusted
      // input even though we authored it — the build is the only trusted
      // execution context in a static site. Surface a generic message: Zod's
      // internal text is a developer concern, and putting schema detail in
      // front of the one person holding the passphrase is exactly the wrong
      // audience for it.
      try {
        applyPatch(opened)
      } catch (caught) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[vault] decrypted payload failed validation", caught)
        }
        throw new Error("That link is out of date — ask for a new one.")
      }

      setPatch(opened)
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(opened))
      } catch {
        // Private browsing or blocked storage: unlocked for this render only.
      }
    },
    [applyPatch, audiences],
  )

  const lock = useCallback(() => {
    setPatch(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clear.
    }
  }, [])

  // Restore a session, or consume a #k=<audience>.<passphrase> share link.
  useEffect(() => {
    const fragment = window.location.hash
    const match = /^#k=([^.]+)\.(.+)$/.exec(fragment)

    if (match) {
      // Strip before awaiting so the passphrase never lingers in the address
      // bar or in history, even if decryption is slow or fails.
      history.replaceState(null, "", window.location.pathname + window.location.search)
      void unlock(decodeURIComponent(match[2]), decodeURIComponent(match[1])).catch(() => {})
      return
    }

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed: unknown = JSON.parse(stored)
      applyPatch(parsed)
      setPatch(parsed)
    } catch {
      // Stale or corrupt session data: stay locked.
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        // Nothing to clear.
      }
    }
  }, [applyPatch, unlock])

  const value = useMemo<ResumeContextValue>(() => {
    let merged = resume
    if (patch !== null) {
      try {
        merged = applyPatch(patch)
      } catch {
        merged = resume
      }
    }
    return { resume: merged, unlocked: patch !== null, unlock, lock }
  }, [applyPatch, lock, patch, resume, unlock])

  return <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>
}
