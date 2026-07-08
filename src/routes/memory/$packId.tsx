import { createFileRoute } from "@tanstack/react-router";
import { MemoryPackPage } from "@/components/routes/memory-pack-page";

export const Route = createFileRoute("/memory/$packId")({
  component: MemoryPackPage,
});
