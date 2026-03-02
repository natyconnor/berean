import { useQuery } from "convex-helpers/react/cache"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "../../../convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { useTabs } from "@/lib/use-tabs"
import { toPassageId } from "@/lib/verse-ref-utils"
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface GospelParallelBannerProps {
  book: string
  chapter: number
}

export function GospelParallelBanner({
  book,
  chapter,
}: GospelParallelBannerProps) {
  const parallels = useQuery(api.gospelParallels.findParallels, {
    book,
    chapter,
  })
  const [expanded, setExpanded] = useState(false)
  const { openTab } = useTabs()

  if (!parallels || parallels.length === 0) return null

  const initialItems = parallels.slice(0, 3)
  const extraItems = parallels.slice(3)
  const hasMore = parallels.length > 3

  return (
    <div className="border rounded-lg bg-muted/30 px-3 py-2 mb-3">
      <button
        className="flex items-center gap-2 w-full text-left text-sm font-medium text-muted-foreground cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        <span>Synoptic Parallels ({parallels.length})</span>
        {hasMore &&
          (expanded ? (
            <ChevronUp className="h-3.5 w-3.5 ml-auto" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-auto" />
          ))}
      </button>

      <div className="mt-2 space-y-1.5">
        {initialItems.map((parallel) => (
          <ParallelItem
            key={parallel._id}
            parallel={parallel}
            book={book}
            chapter={chapter}
            openTab={openTab}
          />
        ))}
        <AnimatePresence initial={false}>
          {expanded &&
            extraItems.map((parallel, index) => (
              <motion.div
                key={parallel._id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15, delay: index * 0.03 }}
              >
                <ParallelItem
                  parallel={parallel}
                  book={book}
                  chapter={chapter}
                  openTab={openTab}
                />
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ParallelItem({
  parallel,
  book,
  chapter,
  openTab,
}: {
  parallel: { _id: string; label: string; passages: Array<{ book: string; chapter: number; startVerse: number; endVerse: number }> }
  book: string
  chapter: number
  openTab: (id: string, label: string) => void
}) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{parallel.label}: </span>
      <span className="flex flex-wrap gap-1 mt-0.5">
        {parallel.passages
          .filter((p) => !(p.book === book && p.chapter === chapter))
          .map((p) => {
            const label =
              p.startVerse === p.endVerse
                ? `${p.book} ${p.chapter}:${p.startVerse}`
                : `${p.book} ${p.chapter}:${p.startVerse}-${p.endVerse}`
            return (
              <Badge
                key={`${p.book}-${p.chapter}-${p.startVerse}`}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => {
                  const id = toPassageId(p.book, p.chapter)
                  openTab(id, `${p.book} ${p.chapter}`)
                }}
              >
                {label}
              </Badge>
            )
          })}
      </span>
    </div>
  )
}
