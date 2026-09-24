import { createFileRoute } from "@tanstack/react-router";
import { PresetBrowser } from "@/components/memory/presets/preset-browser";

export const Route = createFileRoute("/memory/presets/")({
  component: PresetBrowser,
});
