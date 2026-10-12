import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HUNDRED_VERSES_PRESET_ID,
  chapterPresets,
  formatPresetPassage,
  getMemoryPreset,
  type PresetPassage,
} from "../../../../shared/memory-presets";

import { CollectionPresetPage } from "./collection-preset-page";

const mocks = vi.hoisted(() => ({
  openSheet: vi.fn(),
  presetId: "",
  progress: [] as Array<{
    presetId: string;
    packId: string | null;
    memorizedPassageIds: string[];
  }>,
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.progress,
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ presetId: mocks.presetId }),
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { packId?: string };
  }) => (
    <a href={params?.packId ? `/memory/${params.packId}` : to}>{children}</a>
  ),
}));

function collection() {
  const preset = getMemoryPreset(HUNDRED_VERSES_PRESET_ID);
  if (preset?.kind !== "collection") throw new Error("missing collection");
  return preset;
}

function span(passage: PresetPassage) {
  return {
    book: passage.book,
    chapter: passage.chapter,
    startVerse: passage.startVerse,
    endVerse: passage.endVerse,
  };
}

function passageAt(index: number): PresetPassage {
  const passage = collection().passages[index];
  if (!passage) throw new Error(`missing passage ${index}`);
  return passage;
}

describe("CollectionPresetPage", () => {
  beforeEach(() => {
    mocks.openSheet.mockReset();
    mocks.presetId = HUNDRED_VERSES_PRESET_ID;
    mocks.progress = [];
  });

  it("memorizes the whole collection as one pack named for it", async () => {
    render(<CollectionPresetPage />);

    await userEvent.click(screen.getByRole("button", { name: "Memorize all" }));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: collection().passages.map(span),
      title: collection().title,
    });
  });

  it("memorizes the chosen passages in collection order", async () => {
    const first = passageAt(0);
    const second = passageAt(1);
    render(<CollectionPresetPage />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: formatPresetPassage(second) }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: formatPresetPassage(first) }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Memorize 2" }));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: [span(first), span(second)],
      title: collection().title,
    });
  });

  it("titles a single chosen passage by its reference", async () => {
    const first = passageAt(0);
    render(<CollectionPresetPage />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: formatPresetPassage(first) }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Memorize 1" }));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: [span(first)],
    });
  });

  it("opens an existing collection pack", () => {
    mocks.progress = [
      {
        presetId: HUNDRED_VERSES_PRESET_ID,
        packId: "pack_100",
        memorizedPassageIds: [],
      },
    ];
    render(<CollectionPresetPage />);

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/memory/pack_100",
    );
  });

  it("memorizes a chapter suggestion as a passage", async () => {
    const preset = chapterPresets()[0];
    if (!preset) throw new Error("missing chapter preset");
    mocks.presetId = preset.id;
    render(<CollectionPresetPage />);

    await userEvent.click(screen.getByRole("button", { name: "Memorize" }));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "chapters",
      book: preset.book,
      startChapter: preset.startChapter,
      endChapter: preset.endChapter,
      presetId: preset.id,
    });
  });
});
