import { loadResume } from "@/lib/resume/load"
import { AtsTemplate } from "@/components/document/templates/ats"

export default function Page() {
  return (
    <main>
      <AtsTemplate resume={loadResume()} />
    </main>
  )
}
