import { createFileRoute } from "@tanstack/react-router";
import { MemoryHomePage } from "@/components/routes/memory-home-page";

export const Route = createFileRoute("/memory/")({
  component: MemoryHomePage,
});
