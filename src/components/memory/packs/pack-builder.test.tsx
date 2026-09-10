import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { HEART_SCOPE_ACTION_LABEL } from "@/lib/heart-scope-copy";
import {
  memoryPackSearchAfterCreate,
  validateMemoryPackSearch,
} from "@/lib/memory-pack-search";

import { PackBuilder } from "./pack-builder";

const john3Scope = {
  books: ["John"],
  chapterRanges: [{ book: "John", startChapter: 3, endChapter: 3 }],
  tags: [] as string[],
  tagMatchMode: "any" as const,
};

const multiBookScope = {
  books: ["John", "Acts"],
  chapterRanges: [
    { book: "John", startChapter: 1, endChapter: 1 },
    { book: "Acts", startChapter: 1, endChapter: 1 },
  ],
  tags: [] as string[],
  tagMatchMode: "any" as const,
};

const { queryResults, mutationMocks, navigateMock, scopeFormState } =
  vi.hoisted(() => ({
    queryResults: new Map<string, unknown>(),
    mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
    navigateMock: vi.fn(),
    scopeFormState: {
      isComplete: true,
      scope: {
        books: ["John"],
        chapterRanges: [{ book: "John", startChapter: 3, endChapter: 3 }],
        tags: [] as string[],
        tagMatchMode: "any" as const,
      },
      summaryText: "John 3",
      selectedBooks: ["John"] as string[],
    },
  }));

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn();
  mutationMocks.set(name, created);
  return created;
}

function resetEligibleJohn3() {
  scopeFormState.isComplete = true;
  scopeFormState.scope = john3Scope;
  scopeFormState.summaryText = "John 3";
  scopeFormState.selectedBooks = ["John"];
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

vi.mock("@/components/study/scope-form", () => ({
  ScopeForm: () => <div>scope form</div>,
}));

vi.mock("@/components/study/use-scope-form", () => ({
  useScopeForm: () => ({
    selectedBooks: scopeFormState.selectedBooks,
    chapterRanges: new Map(
      scopeFormState.scope.chapterRanges.map((range) => [
        range.book,
        { start: range.startChapter, end: range.endChapter },
      ]),
    ),
    selectedTags: [] as string[],
    tagMatchMode: "any" as const,
    onToggleBook: vi.fn(),
    onSetBooks: vi.fn(),
    onSetChapterRange: vi.fn(),
    onSelectPreset: vi.fn(),
    onToggleTag: vi.fn(),
    onClearTags: vi.fn(),
    onSetTagMatchMode: vi.fn(),
    scope: scopeFormState.scope,
    scopeForPreview: scopeFormState.scope,
    summaryText: scopeFormState.summaryText,
    isComplete: scopeFormState.isComplete,
  }),
}));

function renderBuilder() {
  return render(
    <TooltipProvider delayDuration={0}>
      <PackBuilder />
    </TooltipProvider>,
  );
}

describe("PackBuilder", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    queryResults.set("packs.previewScopeCount", {
      verseCount: 36,
      dueCount: 0,
    });
    mutationMock("packs.create").mockResolvedValue("pack_new");
    resetEligibleJohn3();
  });

  it("creates an eligible scope pack as a collection without auto-start", async () => {
    renderBuilder();

    expect(
      screen.getByRole("button", { name: "Create and start passage learning" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: HEART_SCOPE_ACTION_LABEL }),
    ).not.toBeInTheDocument();

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
        search: {},
      });
    });
    expect(navigateMock.mock.calls[0]?.[0]).not.toMatchObject({
      search: { startPassage: true },
    });
    expect(navigateMock.mock.calls[0]?.[0]).not.toMatchObject({
      search: { heartHint: true },
    });
  });

  it("offers a shortcut that lands with startPassage", async () => {
    renderBuilder();

    await userEvent.click(
      screen.getByRole("button", { name: "Create and start passage learning" }),
    );

    await waitFor(() => {
      expect(mutationMock("packs.create")).toHaveBeenCalledTimes(1);
    });
    expect(mutationMocks.get("savedVerses.heartMany")).toBeUndefined();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId",
        params: { packId: "pack_new" },
        search: { startPassage: true },
      });
    });
  });

  it("keeps heartHint auto-heart for an ineligible multi-book scope", async () => {
    scopeFormState.scope = multiBookScope;
    scopeFormState.summaryText = "John 1, Acts 1";
    scopeFormState.selectedBooks = ["John", "Acts"];
    renderBuilder();

    expect(
      screen.queryByRole("button", {
        name: "Create and start passage learning",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: HEART_SCOPE_ACTION_LABEL }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create pack" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId",
        params: { packId: "pack_new" },
        search: { heartHint: true },
      });
    });
    expect(mutationMocks.get("savedVerses.heartMany")).toBeUndefined();
  });

  it("does not create until every selected book has a chapter range", () => {
    scopeFormState.isComplete = false;
    renderBuilder();

    expect(screen.getByRole("button", { name: "Create pack" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create and start passage learning" }),
    ).toBeDisabled();
    expect(screen.getByText("Select chapters to continue")).toBeInTheDocument();
  });
});

describe("memoryPackSearchAfterCreate", () => {
  it("omits flags for a default eligible create", () => {
    expect(
      memoryPackSearchAfterCreate({ kind: "scope", allowsPassage: true }),
    ).toEqual({});
  });

  it("sets startPassage for the eligible shortcut", () => {
    expect(
      memoryPackSearchAfterCreate({
        kind: "scope",
        allowsPassage: true,
        startPassage: true,
      }),
    ).toEqual({ startPassage: true });
  });

  it("keeps heartHint for ineligible scopes and ignores startPassage", () => {
    expect(
      memoryPackSearchAfterCreate({
        kind: "scope",
        allowsPassage: false,
        startPassage: true,
      }),
    ).toEqual({ heartHint: true });
  });

  it("sends no flags for custom packs", () => {
    expect(
      memoryPackSearchAfterCreate({ kind: "custom", allowsPassage: false }),
    ).toEqual({});
  });
});

describe("validateMemoryPackSearch", () => {
  it("still parses heartHint for old links", () => {
    expect(validateMemoryPackSearch({ heartHint: "1" })).toEqual({
      heartHint: true,
    });
  });

  it("parses startPassage", () => {
    expect(validateMemoryPackSearch({ startPassage: true })).toEqual({
      startPassage: true,
    });
  });
});
