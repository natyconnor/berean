import { MemoryPanelPage } from "@/components/memory/drawer/memory-panel-host";
import { Route } from "@/routes/memory/verse.$verseRefId";

export function MemoryVersePage() {
  const { verseRefId } = Route.useParams();
  const { from } = Route.useSearch();
  return <MemoryPanelPage panel={{ kind: "verse", verseRefId }} from={from} />;
}
