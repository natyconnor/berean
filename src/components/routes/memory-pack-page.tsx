import { PackView } from "@/components/memory/packs/pack-view";
import type { Id } from "../../../convex/_generated/dataModel";
import { Route } from "@/routes/memory/$packId";

export function MemoryPackPage() {
  const { packId } = Route.useParams();
  return <PackView packId={packId as Id<"packs">} />;
}
