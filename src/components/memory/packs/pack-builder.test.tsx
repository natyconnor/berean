import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

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

const {
  queryResults,
  mutationMocks,
  navigateMock,
  startPassageForPackMock,
  scopeFormState,
} = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  navigateMock: vi.fn(),
  startPassageForPackMock: vi.fn(),
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
    esv: { getChaptersBatch: "esv.getChaptersBatch" },
    packs: {
      addVerse: "packs.addVerse",
      create: "packs.create",
      previewScopeCount: "packs.previewScopeCount",
    },
    passageMemory: { start: "passageMemory.start" },
    savedVerses: {
      listAll: "savedVerses.listAll",
    },
  },
}));

vi.mock("@/hooks/use-start-passage", () => ({
  startPassageForPack: startPassageForPackMock,
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

async function advanceToNameStep() {
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Pack name")).toBeInTheDocument();
}

describe("PackBuilder", () => {
  beforeEach(() => {
    queryResults.clear();
    mutationMocks.clear();
    navigateMock.mockReset();
    startPassageForPackMock.mockReset();
    startPassageForPackMock.mockResolvedValue(null);
    queryResults.set("packs.previewScopeCount", {
      verseCount: 36,
      dueCount: 0,
    });
    mutationMock("packs.create").mockResolvedValue("pack_new");
    resetEligibleJohn3();
  });

  it("offers preset as a peer choice that opens the preset browser", async () => {
    renderBuilder();

    const preset = screen.getByRole("button", {
      name: /^Preset/,
    });
    expect(preset.querySelector("svg")).toBeInTheDocument();
    expect(preset).toHaveClass("rounded-xl", "border");
    expect(screen.getByRole("button", { name: /^Scope/ })).toHaveClass(
      "rounded-xl",
      "border",
    );
    expect(screen.getByRole("button", { name: /^Custom/ })).toHaveClass(
      "rounded-xl",
      "border",
    );

    await userEvent.click(preset);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/memory/presets" });
  });

  it("walks type → scope → name before create actions", async () => {
    renderBuilder();

    expect(
      screen.getByText("What kind of pack are you making?"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create pack" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("scope form")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create pack" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Pack name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create pack" }),
    ).toBeInTheDocument();
  });

  it("creates an eligible scope pack as a collection without auto-start", async () => {
    renderBuilder();
    await advanceToNameStep();

    expect(
      screen.getByRole("button", { name: "Create and memorize as a whole" }),
    ).toBeInTheDocument();

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
    expect(startPassageForPackMock).not.toHaveBeenCalled();
  });

  it("starts the passage before landing for the shortcut", async () => {
    renderBuilder();
    await advanceToNameStep();

    await userEvent.click(
      screen.getByRole("button", { name: "Create and memorize as a whole" }),
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId",
        params: { packId: "pack_new" },
        search: {},
      });
    });
    expect(mutationMock("packs.create")).toHaveBeenCalledTimes(1);
    expect(startPassageForPackMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ packId: "pack_new", scope: john3Scope }),
    );
    expect(mutationMocks.get("savedVerses.heartMany")).toBeUndefined();
  });

  it("still lands on the pack when the shortcut's start fails", async () => {
    startPassageForPackMock.mockRejectedValue(new Error("offline"));
    renderBuilder();
    await advanceToNameStep();

    await userEvent.click(
      screen.getByRole("button", { name: "Create and memorize as a whole" }),
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId",
        params: { packId: "pack_new" },
        search: {},
      });
    });
  });

  it("offers no passage shortcut for an ineligible multi-book scope", async () => {
    scopeFormState.scope = multiBookScope;
    scopeFormState.summaryText = "John 1, Acts 1";
    scopeFormState.selectedBooks = ["John", "Acts"];
    renderBuilder();
    await advanceToNameStep();

    expect(
      screen.queryByRole("button", {
        name: "Create and memorize as a whole",
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create pack" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/memory/$packId",
        params: { packId: "pack_new" },
        search: {},
      });
    });
    expect(mutationMocks.get("savedVerses.heartMany")).toBeUndefined();
  });

  it("does not continue from scope until every selected book has a chapter range", async () => {
    scopeFormState.isComplete = false;
    renderBuilder();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByText("Select books to continue")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create pack" }),
    ).not.toBeInTheDocument();
  });
});
