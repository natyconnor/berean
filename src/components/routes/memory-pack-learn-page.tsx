import { MemoryPackSessionPage } from "@/components/routes/memory-pack-practice-page";
import { Route } from "@/routes/memory_.$packId.learn";

import type { Id } from "../../../convex/_generated/dataModel";

export function MemoryPackLearnPage() {
  const { packId } = Route.useParams();
  const { return: returnTo } = Route.useSearch();

  return (
    <MemoryPackSessionPage
      kind="learning"
      packId={packId as Id<"packs">}
      returnTo={returnTo}
    />
  );
}
