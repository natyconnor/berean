import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HUNDRED_VERSES_PRESET_ID,
  chapterPresets,
  getMemoryPreset,
} from "../../../../shared/memory-presets";

import { PresetBrowser } from "./preset-browser";

const mocks = vi.hoisted(() => ({ openSheet: vi.fn() }));

let progress: Array<{
  presetId: string;
  packId: string | null;
  memorizedPassageIds: string[];
}> = [];

vi.mock("convex/react", () => ({
  useQuery: () => progress,
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));

vi.mock("@tanstack/react-router", () => ({
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

function psalm23() {
  const preset = chapterPresets().find(
    (item) => item.book === "Psalms" && item.startChapter === 23,
  );
  if (!preset) throw new Error("missing Psalm 23");
  return preset;
}

function chapterRow(title: string) {
  const row = screen.getByText(title).closest("li");
  if (!row) throw new Error(`missing row for ${title}`);
  return within(row);
}

describe("PresetBrowser", () => {
  beforeEach(() => {
    progress = [];
  });

  it("is titled Suggestions with Passages and Packs sections", () => {
    render(<PresetBrowser />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Suggestions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Popular passages and verse packs to memorize."),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(["Passages", "Packs"]);
  });
});

describe("PresetBrowser packs", () => {
  beforeEach(() => {
    progress = [];
  });

  it("offers Open when the collection has not been added", () => {
    render(<PresetBrowser />);

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      `/memory/presets/${HUNDRED_VERSES_PRESET_ID}`,
    );
    expect(screen.queryByText("Memorizing")).not.toBeInTheDocument();
  });

  it("opens an existing preset pack instead of offering it again", () => {
    progress = [
      {
        presetId: HUNDRED_VERSES_PRESET_ID,
        packId: "pack_100",
        memorizedPassageIds: collection().passages.map((passage) => passage.id),
      },
    ];
    render(<PresetBrowser />);

    expect(screen.getByText("You already have this pack.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/memory/pack_100",
    );
    expect(
      screen.queryByRole("link", { name: "Continue" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer a collection whose passages are all already memorized", () => {
    progress = [
      {
        presetId: HUNDRED_VERSES_PRESET_ID,
        packId: null,
        memorizedPassageIds: collection().passages.map((passage) => passage.id),
      },
    ];
    render(<PresetBrowser />);

    expect(
      screen.getByText("You're already memorizing every verse in it."),
    ).toBeInTheDocument();
    expect(screen.getByText("Memorizing")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open" }),
    ).not.toBeInTheDocument();
  });
});

describe("PresetBrowser passages", () => {
  beforeEach(() => {
    progress = [];
    mocks.openSheet.mockReset();
  });

  it("opens the Memorize sheet for a chapter as a passage", async () => {
    const preset = psalm23();
    render(<PresetBrowser />);

    await userEvent.click(
      chapterRow(preset.title).getByRole("button", { name: "Memorize" }),
    );

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "chapters",
      book: "Psalms",
      startChapter: 23,
      endChapter: 23,
      presetId: preset.id,
    });
  });

  it("opens a chapter that is already a pack", () => {
    const preset = psalm23();
    progress = [
      { presetId: preset.id, packId: "pack_23", memorizedPassageIds: [] },
    ];
    render(<PresetBrowser />);

    const row = chapterRow(preset.title);
    expect(row.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/memory/pack_23",
    );
    expect(
      row.queryByRole("button", { name: "Memorize" }),
    ).not.toBeInTheDocument();
  });
});
