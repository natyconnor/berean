import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_MS } from "@/lib/memory-scheduler";
import {
  buildTodayModel,
  emptyTodayModel,
  type TodayInput,
} from "@/lib/memory-today";

import { TodayPage } from "./today-page";

const NOW = Date.UTC(2026, 9, 12, 18);

const mocks = vi.hoisted(() => {
  const state: {
    today: unknown;
    cardProps: Array<{ hasMemory: boolean | undefined }>;
  } = { today: undefined, cardProps: [] };
  return state;
});

vi.mock("@/hooks/use-today-model", () => ({
  useTodayModel: () => mocks.today,
}));
vi.mock("@/components/memory/preview-memory-seed-card", () => ({
  PreviewMemorySeedCard: (props: { hasMemory: boolean | undefined }) => {
    mocks.cardProps.push(props);
    return null;
  },
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./doorway-cards", () => ({ DoorwayCards: () => null }));
vi.mock("./first-run", () => ({ FirstRun: () => null }));
vi.mock("./goal-grid", () => ({ GoalGrid: () => null }));
vi.mock("./memory-welcome-callout", () => ({
  MemoryWelcomeCallout: () => null,
}));
vi.mock("./start-something-new", () => ({ StartSomethingNew: () => null }));
vi.mock("./today-card", () => ({ TodayCard: () => null }));
vi.mock("@/hooks/use-live-now", () => ({ useLiveNow: () => NOW }));
vi.mock("@/lib/viewer-timezone", () => ({ getViewerTimeZone: () => "UTC" }));
vi.mock("@/lib/preview-test-tools", () => ({
  isPreviewTestToolsEnabled: () => true,
}));

/** Only a memorized Psalm 1 passage: no in-Memory verses at all. */
function passageOnlyModel() {
  const input: TodayInput = {
    now: NOW,
    tzOffsetMinutes: 0,
    verses: [],
    packs: [],
    passages: [
      {
        packId: "psalm1",
        title: "Psalm 1",
        status: "reviewing",
        pieces: [
          {
            index: 0,
            book: "Psalms",
            chapter: 1,
            startVerse: 1,
            endVerse: 1,
            sectionIndex: 0,
            attachment: "solid",
            learnStage: 3,
            stageReps: 0,
            dueAt: NOW - DAY_MS,
          },
        ],
        addsOnDay: 0,
        intervalDays: 4,
        stageReps: 0,
        ease: 2.3,
        dueAt: NOW + 2 * DAY_MS,
        createdAt: NOW - 20 * DAY_MS,
      },
    ],
    upNextByPackId: new Map(),
    upNextVerseRefIds: [],
    reviewTogether: new Map(),
    reviewTogetherVerseRefIds: new Set(),
    verseLogs: [],
    passageLogs: [],
  };
  return buildTodayModel(input);
}

function lastHasMemory() {
  return mocks.cardProps.at(-1)?.hasMemory;
}

describe("TodayPage sample-data emptiness (D18)", () => {
  beforeEach(() => {
    mocks.cardProps = [];
  });

  it("counts a passage-only account as not empty, so it isn't reseeded", () => {
    const model = passageOnlyModel();
    // No in-Memory verses: the old verse-total gate saw this as empty.
    expect(model.totalInMemory).toBe(0);
    mocks.today = model;
    render(<TodayPage />);
    expect(lastHasMemory()).toBe(true);
  });

  it("counts a truly empty account as empty, so it still auto-seeds", () => {
    mocks.today = emptyTodayModel();
    render(<TodayPage />);
    expect(lastHasMemory()).toBe(false);
  });

  it("is unknown while Today loads, so the seed waits", () => {
    mocks.today = undefined;
    render(<TodayPage />);
    expect(lastHasMemory()).toBeUndefined();
  });
});
