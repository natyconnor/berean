import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HUNDRED_VERSES_PRESET_ID,
  getMemoryPreset,
} from "../../../../shared/memory-presets";

import { PresetBrowser } from "./preset-browser";

let progress: Array<{
  presetId: string;
  packId: string | null;
  heartedPassageIds: string[];
}> = [];

vi.mock("convex/react", () => ({
  useQuery: () => progress,
  useMutation: () => vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { packId?: string; presetId?: string };
  }) => (
    <a
      href={
        params?.packId
          ? `/memory/${params.packId}`
          : params?.presetId
            ? `/memory/presets/${params.presetId}`
            : to
      }
    >
      {children}
    </a>
  ),
}));

function collection() {
  const preset = getMemoryPreset(HUNDRED_VERSES_PRESET_ID);
  if (preset?.kind !== "collection") throw new Error("missing collection");
  return preset;
}

describe("PresetBrowser collections", () => {
  beforeEach(() => {
    progress = [];
  });

  it("offers Open when the collection has not been added", () => {
    render(<PresetBrowser />);

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      `/memory/presets/${HUNDRED_VERSES_PRESET_ID}`,
    );
    expect(screen.queryByText("Added")).not.toBeInTheDocument();
  });

  it("continues an existing preset pack instead of offering it again", () => {
    progress = [
      {
        presetId: HUNDRED_VERSES_PRESET_ID,
        packId: "pack_100",
        heartedPassageIds: collection().passages.map((passage) => passage.id),
      },
    ];
    render(<PresetBrowser />);

    expect(
      screen.getByText("This collection is already a pack."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/memory/pack_100",
    );
    expect(
      screen.queryByRole("link", { name: "Open" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a collection whose passages are all already hearted", () => {
    progress = [
      {
        presetId: HUNDRED_VERSES_PRESET_ID,
        packId: null,
        heartedPassageIds: collection().passages.map((passage) => passage.id),
      },
    ];
    render(<PresetBrowser />);

    expect(
      screen.getByText(
        "Every passage in this collection is already in your library.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open" }),
    ).not.toBeInTheDocument();
  });
});
