import { createFileRoute } from "@tanstack/react-router";

import { MemoryTodayPage } from "@/components/routes/memory-today-page";
import { validateMemoryTodaySearch } from "@/lib/memory-today-search";

export const Route = createFileRoute("/memory/today")({
  validateSearch: validateMemoryTodaySearch,
  component: MemoryTodayPage,
});
