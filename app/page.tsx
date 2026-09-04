import { loadAudiences, loadResume } from "@/lib/resume/load"
import { ResumeProvider } from "@/components/shell/ResumeProvider"
import { UnlockControl } from "@/components/privacy/UnlockControl"
import { DocumentView } from "@/components/document/DocumentView"

export default function Page() {
  return (
    <ResumeProvider resume={loadResume()} audiences={Object.keys(loadAudiences())}>
      <header className="mx-auto flex max-w-3xl justify-end px-6 pt-6">
        <UnlockControl />
      </header>
      <main>
        <DocumentView />
      </main>
    </ResumeProvider>
  )
}
