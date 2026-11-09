import { createFileRoute } from "@tanstack/react-router";

import { MemoryPackPracticePage } from "@/components/routes/memory-pack-practice-page";
import { validateMemoryPackSessionSearch } from "@/lib/memory-pack-search";

export const Route = createFileRoute("/memory_/$packId/practice")({
  validateSearch: validateMemoryPackSessionSearch,
  component: MemoryPackPracticePage,
});
