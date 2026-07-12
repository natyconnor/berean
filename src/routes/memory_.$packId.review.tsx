import { createFileRoute } from "@tanstack/react-router";

import { MemoryPackReviewPage } from "@/components/routes/memory-pack-review-page";

export const Route = createFileRoute("/memory_/$packId/review")({
  component: MemoryPackReviewPage,
});
