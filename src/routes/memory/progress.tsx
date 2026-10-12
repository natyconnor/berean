import { createFileRoute } from "@tanstack/react-router";
import { MemoryProgressPage } from "@/components/routes/memory-progress-page";
import { validateMemoryPanelPageSearch } from "@/lib/memory-panel";

export const Route = createFileRoute("/memory/progress")({
  validateSearch: validateMemoryPanelPageSearch,
  component: MemoryProgressPage,
});
