"use client"

import { useResume } from "@/components/shell/ResumeProvider"
import { AtsTemplate } from "@/components/document/templates/ats"

export function DocumentView() {
  const { resume } = useResume()
  return <AtsTemplate resume={resume} />
}
