import { createFileRoute } from "@tanstack/react-router";
import { MemoryPackNewPage } from "@/components/routes/memory-pack-new-page";

export const Route = createFileRoute("/memory/new")({
  component: MemoryPackNewPage,
});
