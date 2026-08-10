import { createFileRoute } from "@tanstack/react-router";

import { MemoryLearnPage } from "@/components/routes/memory-learn-page";
import { validateMemoryLearnSearch } from "@/lib/memory-learn-search";

export const Route = createFileRoute("/memory/learn")({
  validateSearch: validateMemoryLearnSearch,
  component: MemoryLearnPage,
});
