import { MemoryPanelPage } from "@/components/memory/drawer/memory-panel-host";
import { Route } from "@/routes/memory/$packId";

export function MemoryPackPage() {
  const { packId } = Route.useParams();
  const { from } = Route.useSearch();
  return <MemoryPanelPage panel={{ kind: "pack", packId }} from={from} />;
}
