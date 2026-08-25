import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { PackBuilder } from "./pack-builder";

const { queryResults, mutationMocks, navigateMock } = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  navigateMock: vi.fn(),
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
  useAction: () => vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/memory">{children}</a>
  ),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    packs: {
      addVerse: "packs.addVerse",
      create: "packs.create",
      previewScopeCount: "packs.previewScopeCount",
    },
    savedVerses: {
      listAll: "savedVerses.listAll",
    },
  },
}));

const psalm1Scope = {
  books: ["Psalms"],
  chapterRanges: [{ book: "Psalms", startChapter: 1, endChapter: 1 }],
  tags: [] as string[],
  tagMatchMode: "any" as const,
};

vi.mock("@/components/study/scope-form", () => ({
  ScopeForm: () => <div>scope form</div>,
}));

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

describe("PackBuilder", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    queryResults.set("packs.previewScopeCount", {
      verseCount: 6,
      dueCount: 0,
    });
    mutationMock("packs.create").mockResolvedValue("pack_new");
  });

  it("creates a scope pack and points at Heart all on the pack page", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PackBuilder />
      </TooltipProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Create pack" }));

    await waitFor(() => {
      expect(mutationMock("packs.create")).toHaveBeenCalledTimes(1);
    });
    expect(mutationMocks.get("savedVerses.heartMany")).toBeUndefined();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId",
        params: { packId: "pack_new" },
        search: { heartHint: true },
      });
    });
  });
});
