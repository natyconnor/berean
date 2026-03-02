import { motion } from "framer-motion"
import type { Tab } from "@/lib/tab-types"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onActivate: () => void
  onClose: () => void
}

export function TabItem({ tab, isActive, onActivate, onClose }: TabItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: "auto" }}
      exit={{ opacity: 0, width: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "group flex items-center gap-1 h-10 px-4 border-r cursor-pointer select-none text-sm transition-colors",
        isActive
          ? "bg-background text-foreground border-b-2 border-b-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      onClick={onActivate}
    >
      <span className="truncate max-w-[140px]">{tab.label}</span>
      <button
        className={cn(
          "ml-1 rounded-sm p-0.5 hover:bg-muted-foreground/20 transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  )
}
