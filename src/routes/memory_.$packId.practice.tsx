import { createFileRoute } from "@tanstack/react-router";

import { MemoryPackPracticePage } from "@/components/routes/memory-pack-practice-page";
import { validateMemoryPackPracticeSearch } from "@/lib/memory-return";

export const Route = createFileRoute("/memory_/$packId/practice")({
  validateSearch: validateMemoryPackPracticeSearch,
  component: MemoryPackPracticePage,
});
