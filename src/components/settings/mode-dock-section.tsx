import { useMutation, useQuery } from "convex/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logInteraction } from "@/lib/dev-log";
import type { ModeDockPreference } from "@/components/layout/mode-dock";
import { api } from "../../../convex/_generated/api";

const MODE_DOCK_OPTIONS: Array<{
  value: ModeDockPreference;
  label: string;
  description: string;
}> = [
  {
    value: "auto-hide",
    label: "Auto-hide",
    description:
      "Slides away while you read and type, and returns when you scroll up.",
  },
  {
    value: "always",
    label: "Always show",
    description: "Keep the dock pinned in the bottom center at all times.",
  },
  {
    value: "off",
    label: "Off",
    description: "Hide the dock entirely. The Study icon stays in the toolbar.",
  },
];

export function ModeDockSection() {
  const preference = useQuery(api.userSettings.getModeDockPreference);
  const setPreference = useMutation(api.userSettings.setModeDockPreference);
  const current: ModeDockPreference = preference ?? "auto-hide";

  const handleSelect = (mode: ModeDockPreference) => {
    if (mode === current) return;
    logInteraction("settings", "mode-dock-preference-changed", { mode });
    void setPreference({ mode });
  };

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Mode dock</h2>
        <p className="text-xs text-muted-foreground">
          The floating Notes / Study pill at the bottom of the screen. Choose
          how it behaves while you work.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Mode dock behavior"
        className="flex flex-wrap gap-2"
      >
        {MODE_DOCK_OPTIONS.map((option) => {
          const selected = option.value === current;
          return (
            <Button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              size="sm"
              variant={selected ? "default" : "outline"}
              className={cn(!selected && "text-muted-foreground")}
              disabled={preference === undefined}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {MODE_DOCK_OPTIONS.find((option) => option.value === current)
          ?.description ?? ""}
      </p>
    </section>
  );
}
