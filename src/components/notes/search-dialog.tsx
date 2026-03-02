import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { useQuery } from "convex-helpers/react/cache"
import { api } from "../../../convex/_generated/api"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedTag, setSelectedTag] = useState<string | undefined>()

  // Keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const searchResults = useQuery(
    api.notes.search,
    query.trim().length >= 2
      ? { query: query.trim(), tag: selectedTag }
      : "skip"
  )

  const allTags = useQuery(api.notes.allTags)

  const handleSelectNote = useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  return (
    <>
      <button
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border bg-muted/30 hover:bg-muted cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search notes...</span>
        <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
          {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0">
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 shadow-none"
              autoFocus
            />
          </div>

          {allTags && allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 py-2 border-b">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={selectedTag === undefined ? "default" : "outline"}
                    className="text-xs cursor-pointer"
                    onClick={() => setSelectedTag(undefined)}
                  >
                    All
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Show all notes</TooltipContent>
              </Tooltip>
              {allTags.map((tag) => (
                <Tooltip key={tag}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={selectedTag === tag ? "default" : "outline"}
                      className="text-xs cursor-pointer"
                      onClick={() =>
                        setSelectedTag(selectedTag === tag ? undefined : tag)
                      }
                    >
                      {tag}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Filter by {tag}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          <ScrollArea className="max-h-80">
            {query.trim().length < 2 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search...
              </div>
            ) : searchResults === undefined ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            ) : (
              <div className="p-1">
                {searchResults.map((note, index) => (
                  <motion.div
                    key={note._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: index * 0.03 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="w-full text-left px-3 py-2 rounded-sm hover:bg-muted transition-colors cursor-pointer"
                          onClick={handleSelectNote}
                        >
                          <p className="text-sm line-clamp-2">
                            {note.content}
                          </p>
                          {note.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {note.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Open note</TooltipContent>
                    </Tooltip>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
