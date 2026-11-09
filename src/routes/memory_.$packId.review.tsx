import { createFileRoute } from "@tanstack/react-router";

import { MemoryPackReviewPage } from "@/components/routes/memory-pack-review-page";
import { validateMemoryPackSessionSearch } from "@/lib/memory-pack-search";

export const Route = createFileRoute("/memory_/$packId/review")({
  validateSearch: validateMemoryPackSessionSearch,
  component: MemoryPackReviewPage,
});
