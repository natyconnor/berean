import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import type { EsvChapterData } from "../../../../shared/esv-api";

import { PackBuilder } from "./pack-builder";

const { queryResults, mutationMocks, navigateMock, fetchChaptersBatchMock } =
  vi.hoisted(() => ({
    queryResults: new Map<string, unknown>(),
    mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    navigateMock: vi.fn(),
    fetchChaptersBatchMock: vi.fn(),
  }));

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn();
  mutationMocks.set(name, created);
  return created;
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutationMock(name),
  useQuery: (name: string, args: unknown) =>
    args === "skip" ? undefined : queryResults.get(name),
  useAction: () => fetchChaptersBatchMock,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/memory">{children}</a>
  ),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    esv: { getChaptersBatch: "esv.getChaptersBatch" },
    packs: {
      addVerse: "packs.addVerse",
      create: "packs.create",
      previewScopeCount: "packs.previewScopeCount",
    },
    savedVerses: {
      listAll: "savedVerses.listAll",
      heartMany: "savedVerses.heartMany",
    },
  },
}));

vi.mock("@/components/study/scope-form", () => ({
  ScopeForm: () => <div>scope form</div>,
}));

const psalm1Scope = {
  books: ["Psalms"],
  chapterRanges: [{ book: "Psalms", startChapter: 1, endChapter: 1 }],
  tags: [] as string[],
  tagMatchMode: "any" as const,
};

vi.mock("@/components/study/use-scope-form", () => ({
  useScopeForm: () => ({
    selectedBooks: ["Psalms"],
    chapterRanges: new Map([["Psalms", { start: 1, end: 1 }]]),
    selectedTags: [] as string[],
    tagMatchMode: "any" as const,
    onToggleBook: vi.fn(),
    onSetBooks: vi.fn(),
    onSetChapterRange: vi.fn(),
    onSelectPreset: vi.fn(),
    onToggleTag: vi.fn(),
    onClearTags: vi.fn(),
    onSetTagMatchMode: vi.fn(),
    scope: psalm1Scope,
    scopeForPreview: psalm1Scope,
    summaryText: "Psalm 1",
  }),
}));

const psalm1Text: EsvChapterData = {
  canonical: "Psalm 1",
  copyright: "test",
  verses: [
    { number: 1, text: "Blessed is the man." },
    { number: 2, text: "But his delight is in the law of the Lord." },
    { number: 3, text: "He is like a tree planted by streams of water." },
    { number: 4, text: "The wicked are not so." },
    { number: 5, text: "Therefore the wicked will not stand." },
    { number: 6, text: "For the Lord knows the way of the righteous." },
  ],
};

describe("PackBuilder", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    sessionStorage.clear();
    fetchChaptersBatchMock.mockReset();
    fetchChaptersBatchMock.mockResolvedValue([
      { chapter: 1, data: psalm1Text },
    ]);
    queryResults.set("packs.previewScopeCount", {
      verseCount: 6,
      dueCount: 0,
    });
    queryResults.set("savedVerses.listAll", []);
    mutationMock("packs.create").mockResolvedValue("pack_new");
    mutationMock("savedVerses.heartMany").mockResolvedValue({
      added: 4,
      skippedExact: 0,
      skippedOverlap: 0,
    });
  });

  it("prompts to heart the whole scope when none of it is hearted", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PackBuilder />
      </TooltipProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create pack" }));

    expect(
      await screen.findByRole("heading", { name: "Heart all verses" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "None of these 6 verses are hearted yet. Heart them as short memory units so you can start learning.",
      ),
    ).toBeVisible();

    const heart = await screen.findByRole("button", {
      name: /^Heart \d+ new units?$/,
    });
    await userEvent.click(heart);

    await waitFor(() => {
      expect(mutationMock("packs.create")).toHaveBeenCalledTimes(1);
    });
    const heartMany = mutationMock("savedVerses.heartMany");
    await waitFor(() => {
      expect(heartMany).toHaveBeenCalled();
    });
    const [heartArgs] = heartMany.mock.calls[0] as [
      { spans: VerseSpan[]; now: number },
    ];
    expect(heartArgs.now).toBe(getSessionNow());
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId",
        params: { packId: "pack_new" },
      });
    });
  });

  it("lets the user create the pack without hearting", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PackBuilder />
      </TooltipProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create pack" }));
    await screen.findByRole("heading", { name: "Heart all verses" });
    await userEvent.click(
      screen.getByRole("button", { name: "Create without hearting" }),
    );

    await waitFor(() => {
      expect(mutationMock("packs.create")).toHaveBeenCalledTimes(1);
    });
    expect(mutationMock("savedVerses.heartMany")).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId",
        params: { packId: "pack_new" },
      });
    });
  });

  it("names remaining verses when some of the scope is already hearted", async () => {
    queryResults.set("savedVerses.listAll", [
      {
        verseRefId: "ref_1",
        book: "Psalms",
        chapter: 1,
        startVerse: 1,
        endVerse: 2,
      },
    ]);

    render(
      <TooltipProvider delayDuration={0}>
        <PackBuilder />
      </TooltipProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create pack" }));

    expect(
      await screen.findByRole("heading", { name: "Heart remaining verses" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "2 of 6 verses are already hearted. Heart the rest as short memory units.",
      ),
    ).toBeVisible();
  });
});
