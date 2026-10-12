import { createFileRoute } from "@tanstack/react-router";
import { MemoryHomePage } from "@/components/routes/memory-home-page";
import { validateMemoryHomeSearch } from "@/lib/memory-panel";

export const Route = createFileRoute("/memory/")({
  validateSearch: validateMemoryHomeSearch,
  component: MemoryHomePage,
});
