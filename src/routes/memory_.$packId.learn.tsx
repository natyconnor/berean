import { createFileRoute } from "@tanstack/react-router";

import { MemoryPackLearnPage } from "@/components/routes/memory-pack-learn-page";

export const Route = createFileRoute("/memory_/$packId/learn")({
  component: MemoryPackLearnPage,
});
