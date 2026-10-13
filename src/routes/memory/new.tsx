import { createFileRoute } from "@tanstack/react-router";
import { MemoryPackNewPage } from "@/components/routes/memory-pack-new-page";
import { validateMemoryNewPackSearch } from "@/lib/memory-new-pack";

export const Route = createFileRoute("/memory/new")({
  validateSearch: validateMemoryNewPackSearch,
  component: MemoryPackNewPage,
});
