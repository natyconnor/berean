import { createFileRoute } from "@tanstack/react-router";
import { MemoryVersePage } from "@/components/routes/memory-verse-page";
import { validateMemoryPanelPageSearch } from "@/lib/memory-panel";

export const Route = createFileRoute("/memory/verse/$verseRefId")({
  validateSearch: validateMemoryPanelPageSearch,
  component: MemoryVersePage,
});
