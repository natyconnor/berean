import { createFileRoute } from "@tanstack/react-router";
import { MemoryVersesPage } from "@/components/routes/memory-verses-page";

export const Route = createFileRoute("/memory/verses")({
  component: MemoryVersesPage,
});
