import { useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache";
import type { CSSProperties } from "react";

import { api } from "../../convex/_generated/api";
import {
  DEFAULT_STARTER_TAG_CATEGORY_COLORS,
  STARTER_TAG_CATEGORY_BY_TAG,
} from "@/lib/starter-tags";
import { normalizeTag } from "@/lib/tag-utils";

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }

  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function useStarterTagBadgeStyle() {
  const setupStatus = useQuery(api.userSettings.getTutorialStatus);

  const categoryColors = useMemo<Record<string, string>>(
    () => ({
      ...DEFAULT_STARTER_TAG_CATEGORY_COLORS,
      ...(setupStatus?.categoryColors ?? {}),
    }),
    [setupStatus?.categoryColors],
  );

  return useMemo(
    () =>
      (rawTag: string): CSSProperties | undefined => {
        const tag = normalizeTag(rawTag);
        const categoryId = STARTER_TAG_CATEGORY_BY_TAG[tag];
        if (!categoryId) return undefined;

        const color = categoryColors[categoryId];
        if (!color) return undefined;

        return {
          borderColor: color,
          backgroundColor: hexToRgba(color, 0.16),
          color,
        };
      },
    [categoryColors],
  );
}
