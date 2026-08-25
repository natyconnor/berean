import { createFileRoute } from "@tanstack/react-router";
import { MemoryPackPage } from "@/components/routes/memory-pack-page";
import { validateMemoryPackSearch } from "@/lib/memory-pack-search";

export const Route = createFileRoute("/memory/$packId")({
  validateSearch: validateMemoryPackSearch,
  component: MemoryPackPage,
});
