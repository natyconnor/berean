import { MemoryAllSessionPage } from "@/components/routes/memory-practice-page";
import { Route } from "@/routes/memory/learn";

export function MemoryLearnPage() {
  const search = Route.useSearch();

  return <MemoryAllSessionPage kind="learning" search={search} />;
}
