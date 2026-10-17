import { createFileRoute } from "@tanstack/react-router";

import { MemoryPackLearnPage } from "@/components/routes/memory-pack-learn-page";
import { validateMemoryReturnSearch } from "@/lib/memory-return";

export const Route = createFileRoute("/memory_/$packId/learn")({
  validateSearch: validateMemoryReturnSearch,
  component: MemoryPackLearnPage,
});
