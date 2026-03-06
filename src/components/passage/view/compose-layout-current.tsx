import type { ReactNode } from "react"
import type { FilteredVerse } from "./compose-layout-state"

interface ComposeLayoutCurrentProps {
  verses: FilteredVerse[]
  renderRow: (verse: FilteredVerse) => ReactNode
}

export function ComposeLayoutCurrent({
  verses,
  renderRow,
}: ComposeLayoutCurrentProps) {
  return <>{verses.map((verse) => renderRow(verse))}</>
}
