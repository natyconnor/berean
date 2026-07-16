import { createFileRoute } from "@tanstack/react-router";

import { MemoryPackPracticePage } from "@/components/routes/memory-pack-practice-page";

export const Route = createFileRoute("/memory_/$packId/practice")({
  component: MemoryPackPracticePage,
});
