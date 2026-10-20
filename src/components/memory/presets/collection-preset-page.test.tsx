import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
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

function renderPage() {
  return render(
    <TooltipProvider delayDuration={0}>
      <CollectionPresetPage />
    </TooltipProvider>,
  );
}

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

function passageCheckbox(passage: PresetPassage) {
  return screen.getByRole("checkbox", { name: formatPresetPassage(passage) });
}

function memorizeButton(count: number) {
  return screen.getByRole("button", { name: `Memorize ${count}` });
}

function section(name: string) {
  return within(screen.getByRole("region", { name }));
}

function memorizing(ids: string[], packId: string | null = null) {
  mocks.progress = [
    { presetId: HUNDRED_VERSES_PRESET_ID, packId, memorizedPassageIds: ids },
  ];
}

describe("CollectionPresetPage", () => {
  beforeEach(() => {
    mocks.openSheet.mockReset();
    mocks.presetId = HUNDRED_VERSES_PRESET_ID;
    mocks.progress = [];
  });

  it("selects every passage by default and memorizes them as one pack", async () => {
    const total = collection().passages.length;
    renderPage();

    expect(screen.queryAllByRole("checkbox", { checked: false })).toEqual([]);
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeEnabled();

    await userEvent.click(memorizeButton(total));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: collection().passages.map(span),
      title: collection().title,
    });
  });

  it("leaves out passages already memorizing", async () => {
    const first = passageAt(0);
    const psalm = passageAt(12);
    memorizing([first.id, psalm.id]);
    renderPage();

    for (const passage of [first, psalm]) {
      const checkbox = passageCheckbox(passage);
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAccessibleDescription("Memorizing");
    }
    expect(passageCheckbox(passageAt(1))).toBeChecked();
    expect(
      screen.getByText("2 passages you're already memorizing are left out."),
    ).toBeInTheDocument();
    expect(section("Law").getByText("1 of 1 · 1 memorizing")).toBeVisible();

    await userEvent.click(memorizeButton(collection().passages.length - 2));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: collection()
        .passages.filter(
          (passage) => passage.id !== first.id && passage.id !== psalm.id,
        )
        .map(span),
      title: collection().title,
    });
  });

  it("deselects and reselects everything", async () => {
    const total = collection().passages.length;
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Deselect all" }));

    expect(screen.queryAllByRole("checkbox", { checked: true })).toEqual([]);
    const disabled = memorizeButton(0);
    expect(disabled).toBeDisabled();
    const wrapper = disabled.parentElement;
    if (!wrapper) throw new Error("missing tooltip trigger");
    await user.hover(wrapper);
    expect(
      await screen.findByRole("tooltip", {
        name: "Select at least one passage",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select all" }));

    expect(screen.queryAllByRole("checkbox", { checked: false })).toEqual([]);
    expect(memorizeButton(total)).toBeEnabled();
  });

  it("toggles a section and marks a partly chosen one as mixed", async () => {
    const total = collection().passages.length;
    const exodus = passageAt(0);
    const deuteronomy = passageAt(1);
    renderPage();

    const law = section("Law");
    const all = law.getByRole("checkbox", { name: "All passages in Law" });
    expect(all).toBeChecked();
    expect(law.getByText("2 of 2")).toBeVisible();

    await userEvent.click(passageCheckbox(exodus));

    expect(all).toBePartiallyChecked();
    expect(law.getByText("1 of 2")).toBeVisible();
    expect(memorizeButton(total - 1)).toBeEnabled();

    await userEvent.click(all);

    expect(all).toBeChecked();
    expect(all).not.toBePartiallyChecked();
    expect(passageCheckbox(exodus)).toBeChecked();

    await userEvent.click(all);

    expect(all).not.toBeChecked();
    expect(passageCheckbox(deuteronomy)).not.toBeChecked();
    expect(law.getByText("0 of 2")).toBeVisible();
    expect(
      section("History").getByRole("checkbox", {
        name: "All passages in History",
      }),
    ).toBeChecked();

    await userEvent.click(memorizeButton(total - 2));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: collection()
        .passages.filter(
          (passage) =>
            passage.id !== exodus.id && passage.id !== deuteronomy.id,
        )
        .map(span),
      title: collection().title,
    });
  });

  it("groups passages into Bible sections in canonical order", () => {
    renderPage();

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "Law",
      "History",
      "Wisdom & Poetry",
      "Prophets",
      "Gospels & Acts",
      "Letters",
      "Revelation",
    ]);
    expect(
      section("Revelation").getByRole("checkbox", { name: "Revelation 3:20" }),
    ).toBeChecked();
  });

  it("memorizes the chosen passages in collection order", async () => {
    const first = passageAt(0);
    const second = passageAt(1);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    await userEvent.click(passageCheckbox(second));
    await userEvent.click(passageCheckbox(first));
    await userEvent.click(memorizeButton(2));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: [span(first), span(second)],
      title: collection().title,
    });
  });

  it("titles a single chosen passage by its reference", async () => {
    const first = passageAt(0);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    await userEvent.click(passageCheckbox(first));
    await userEvent.click(memorizeButton(1));

    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: [span(first)],
    });
  });

  it("searches within sections and hides the empty ones", async () => {
    const total = collection().passages.length;
    const romansEight = collection().passages.filter((passage) =>
      formatPresetPassage(passage).startsWith("Romans 8:"),
    );
    renderPage();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search passages" }),
      "Romans 8",
    );

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Letters"]);
    const letters = section("Letters");
    expect(
      letters
        .getAllByRole("checkbox")
        .filter((box) => box.getAttribute("aria-label")?.startsWith("Romans")),
    ).toHaveLength(romansEight.length);
    expect(
      letters.getByText(`${romansEight.length} of ${romansEight.length}`),
    ).toBeVisible();
    expect(memorizeButton(total)).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: "Deselect all" }));

    expect(memorizeButton(total - romansEight.length)).toBeEnabled();
    expect(screen.getByRole("button", { name: "Select all" })).toBeEnabled();

    await userEvent.clear(
      screen.getByRole("searchbox", { name: "Search passages" }),
    );
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search passages" }),
      "Hezekiah",
    );

    expect(screen.queryAllByRole("region")).toEqual([]);
    expect(
      screen.getByText("No passages match that search."),
    ).toBeInTheDocument();
  });

  it("explains why Memorize is off when every passage is memorizing", async () => {
    const user = userEvent.setup();
    memorizing(collection().passages.map((passage) => passage.id));
    renderPage();

    const button = memorizeButton(0);
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select all" })).toBeDisabled();
    const wrapper = button.parentElement;
    if (!wrapper) throw new Error("missing tooltip trigger");
    await user.hover(wrapper);
    expect(
      await screen.findByRole("tooltip", {
        name: "You're already memorizing every passage here",
      }),
    ).toBeInTheDocument();
  });

  it("opens an existing collection pack", () => {
    memorizing([], "pack_100");
    renderPage();

    expect(screen.getByText("You already have this pack.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open pack" })).toHaveAttribute(
      "href",
      "/memory/pack_100",
    );
  });

  it("memorizes a chapter suggestion as a passage", async () => {
    const preset = chapterPresets()[0];
    if (!preset) throw new Error("missing chapter preset");
    mocks.presetId = preset.id;
    renderPage();

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
