import { createFileRoute } from "@tanstack/react-router";

import { MemoryPackReviewPage } from "@/components/routes/memory-pack-review-page";
import { validateMemoryReturnSearch } from "@/lib/memory-return";

export const Route = createFileRoute("/memory_/$packId/review")({
  validateSearch: validateMemoryReturnSearch,
  component: MemoryPackReviewPage,
});
