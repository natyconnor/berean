import { createFileRoute } from "@tanstack/react-router";
import { CollectionPresetPage } from "@/components/memory/presets/collection-preset-page";

export const Route = createFileRoute("/memory/presets/$presetId")({
  component: CollectionPresetPage,
});
