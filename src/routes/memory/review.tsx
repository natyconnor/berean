import { createFileRoute } from "@tanstack/react-router";

import { MemoryReviewPage } from "@/components/routes/memory-review-page";
import { validateMemoryReviewSearch } from "@/lib/memory-review-search";

export const Route = createFileRoute("/memory/review")({
  validateSearch: validateMemoryReviewSearch,
  component: MemoryReviewPage,
});
