import { useCallback } from "react";

import { MemoryPanelHost } from "@/components/memory/drawer/memory-panel-host";
import { TodayPage } from "@/components/memory/today/today-page";
import { parsePreviewSeedTokens } from "@/lib/preview-seed-set";
import { Route } from "@/routes/memory/index";

export function MemoryHomePage() {
  const { panel, from, previewSeed, previewReseed } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Drop only `previewReseed`, so a refresh keeps the set but doesn't reseed.
  const onPreviewReseeded = useCallback(() => {
    void navigate({
      search: (prev) => ({ ...prev, previewReseed: undefined }),
      replace: true,
    });
  }, [navigate]);
  return (
    <>
      <TodayPage
        previewSeedTokens={parsePreviewSeedTokens(previewSeed)}
        previewReseed={previewReseed === 1}
        onPreviewReseeded={onPreviewReseeded}
      />
      <MemoryPanelHost panel={panel} from={from} />
    </>
  );
}
