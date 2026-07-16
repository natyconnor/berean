import { createFileRoute } from "@tanstack/react-router";

import { MemoryPracticePage } from "@/components/routes/memory-practice-page";
import { validateMemoryPracticeSearch } from "@/lib/memory-practice-search";

export const Route = createFileRoute("/memory/practice")({
  validateSearch: validateMemoryPracticeSearch,
  component: MemoryPracticePage,
});
