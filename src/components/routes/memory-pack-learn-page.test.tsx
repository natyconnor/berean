import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import { DAY_MS } from "@/lib/memory-scheduler";
import type { EsvChapterData } from "../../../shared/esv-api";

import { MemoryPackLearnPage } from "./memory-pack-learn-page";

const { queryResults, actionMocks, mutationMocks } = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  actionMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
}));

function actionMock(name: string) {
  const existing = actionMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  actionMocks.set(name, created);
  return created;
}

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("convex/react", () => ({
  useQuery: (name: string) => queryResults.get(name),
  useMutation: (name: string) => mutationMock(name),
  useAction: (name: string) => actionMock(name),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string) => queryResults.get(name),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useCanGoBack: () => false,
  Link: () => null,
}));

vi.mock("@/routes/memory_.$packId.learn", () => ({
  Route: {
    useParams: () => ({ packId: "pack_1" }),
    useSearch: () => ({ return: "/memory?panel=pack:pack_1" }),
  },
}));

vi.mock("@/routes/memory_.$packId.practice", () => ({
  Route: { useParams: () => ({}), useSearch: () => ({}) },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    esv: { getChaptersBatch: "esv.getChaptersBatch", getPassage: "esv.get" },
    packs: {
      get: "packs.get",
      recordUnifiedReview: "packs.recordUnifiedReview",
      acceptRetryHold: "packs.acceptRetryHold",
      resolveMembers: "packs.resolveMembers",
    },
    savedVerses: { listRecordingIds: "savedVerses.listRecordingIds" },
    verseMemory: {
      recordAttempt: "verseMemory.recordAttempt",
      acceptRetryHold: "verseMemory.acceptRetryHold",
    },
    passageMemory: {
      getForPack: "passageMemory.getForPack",
      recordAttempt: "passageMemory.recordAttempt",
      acceptRetryHold: "passageMemory.acceptRetryHold",
    },
  },
}));

const psalm23: EsvChapterData = {
  canonical: "Psalm 23",
  copyright: "test",
  verses: [1, 2, 3, 4, 5, 6].map((number) => ({
    number,
    text: `Verse ${number} of the psalm.`,
  })),
};

function member(
  verse: number,
  status: "new" | "learning" | "reviewing",
  dueAt = getSessionNow(),
) {
  return {
    verseRefId: `ref_${verse}`,
    book: "Psalms",
    chapter: 23,
    startVerse: verse,
    endVerse: verse,
    status,
    learnStage: status === "new" ? 0 : status === "learning" ? 1 : 3,
    stageReps: 0,
    ease: 2.3,
    intervalDays: status === "reviewing" ? 4 : 0,
    consecutiveCorrect: 0,
    lapses: 0,
    dueAt,
    isDue: false,
  };
}

function renderLearn(members: ReturnType<typeof member>[]) {
  queryResults.set("packs.get", {
    _id: "pack_1",
    name: "Merced Team",
    kind: "custom",
    createdAt: 0,
    lastOpenedAt: 0,
  });
  queryResults.set("packs.resolveMembers", members);
  queryResults.set("passageMemory.getForPack", null);
  queryResults.set("savedVerses.listRecordingIds", []);
  return render(
    <TooltipProvider delayDuration={0}>
      <MemoryPackLearnPage />
    </TooltipProvider>,
  );
}

describe("MemoryPackLearnPage", () => {
  beforeEach(() => {
    queryResults.clear();
    actionMocks.clear();
    mutationMocks.clear();
    actionMock("esv.get").mockResolvedValue(psalm23);
    actionMock("esv.getChaptersBatch").mockResolvedValue([
      { chapter: 23, data: psalm23 },
    ]);
  });

  it("learns only the pack's paced Up-next verses, not every one", async () => {
    renderLearn([1, 2, 3, 4, 5].map((verse) => member(verse, "new")));

    expect(await screen.findByText("Verse 1 of 3")).toBeInTheDocument();
    for (const verse of [1, 2, 3]) {
      expect(
        screen.getByRole("button", {
          name: new RegExp(`^Psalm 23:${verse} \\(`),
        }),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("button", { name: /^Psalm 23:4 \(/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Psalm 23:5 \(/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps open learning verses and fills only the free slots", async () => {
    renderLearn([
      member(1, "learning", getSessionNow() - 1000),
      member(2, "learning", getSessionNow() + DAY_MS),
      member(3, "reviewing"),
      member(4, "new"),
      member(5, "new"),
    ]);

    expect(await screen.findByText("Verse 1 of 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Psalm 23:1 \(/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Psalm 23:4 \(/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Psalm 23:5 \(/ }),
    ).not.toBeInTheDocument();
  });
});
