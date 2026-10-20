import { NewPack } from "@/components/memory/packs/new-pack";
import { newPackStartSpan } from "@/lib/memory-new-pack";
import { Route } from "@/routes/memory/new";

export function MemoryPackNewPage() {
  const search = Route.useSearch();
  return (
    <NewPack startSpan={newPackStartSpan(search)} returnTo={search.return} />
  );
}
