import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecordVerseAttempt } from "./use-record-verse-attempt";
import type { Id } from "../../../convex/_generated/dataModel";

const { useQueryMock, recordAttemptMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  recordAttemptMock: vi.fn(),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args) as unknown,
}));

vi.mock("convex/react", () => ({
  useMutation: () => recordAttemptMock,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    savedVerses: { listRecordingIds: "savedVerses.listRecordingIds" },
    verseMemory: { recordAttempt: "verseMemory.recordAttempt" },
  },
}));

vi.mock("@/lib/viewer-timezone", () => ({
  getViewerTimeZone: () => "America/Los_Angeles",
}));

const VERSE_REF_ID = "vr_john_3_16" as Id<"verseRefs">;
const reference = {
  book: "John",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
};
const exactTokens = [{ text: "For", status: "match" as const }];
const schedule = {
  status: "learning" as const,
  learnStage: 1,
  stageReps: 0,
  ease: 2.3,
  intervalDays: 0,
  dueAt: 1,
  consecutiveCorrect: 1,
  lapses: 0,
  earlyReviewApplied: false,
};

describe("useRecordVerseAttempt", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    recordAttemptMock.mockReset();
    recordAttemptMock.mockResolvedValue(schedule);
  });

  it("records with the card verseRefId without waiting on the hearted list", async () => {
    useQueryMock.mockReturnValue(undefined);

    const { result } = renderHook(() => useRecordVerseAttempt());
    expect(result.current.heartedVersesReady).toBe(false);

    await act(async () => {
      await result.current.record({
        reference,
        verseRefId: VERSE_REF_ID,
        tokens: exactTokens,
        stage: 0,
        mode: "learn",
      });
    });

    expect(recordAttemptMock).toHaveBeenCalledTimes(1);
    expect(recordAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verseRefId: VERSE_REF_ID,
        mode: "learn",
        timeZone: "America/Los_Angeles",
      }),
    );
  });

  it("falls back to listRecordingIds when the card has no verseRefId", async () => {
    useQueryMock.mockReturnValue([
      {
        verseRefId: VERSE_REF_ID,
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
      },
    ]);

    const { result } = renderHook(() => useRecordVerseAttempt());
    expect(useQueryMock).toHaveBeenCalledWith(
      "savedVerses.listRecordingIds",
      {},
    );

    await act(async () => {
      await result.current.record({
        reference,
        tokens: exactTokens,
        stage: 0,
        mode: "practice",
      });
    });

    expect(recordAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verseRefId: VERSE_REF_ID,
        mode: "practice",
      }),
    );
  });

  it("does not subscribe to the mastery-ring listAll query", () => {
    useQueryMock.mockReturnValue([]);
    renderHook(() => useRecordVerseAttempt());
    expect(useQueryMock.mock.calls.flat()).not.toContain("savedVerses.listAll");
  });

  it("skips the hearted-id list when session cards already have verseRefId", async () => {
    useQueryMock.mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useRecordVerseAttempt({ skipLibraryIds: true }),
    );

    expect(useQueryMock).toHaveBeenCalledWith(
      "savedVerses.listRecordingIds",
      "skip",
    );
    expect(result.current.heartedVersesReady).toBe(true);

    await act(async () => {
      await result.current.record({
        reference,
        verseRefId: VERSE_REF_ID,
        tokens: exactTokens,
        stage: 0,
        mode: "practice",
      });
    });

    expect(recordAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verseRefId: VERSE_REF_ID,
        mode: "practice",
      }),
    );
  });

  it("does not record a skipLibraryIds attempt that has no verseRefId", async () => {
    useQueryMock.mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useRecordVerseAttempt({ skipLibraryIds: true }),
    );

    let recorded: unknown;
    await act(async () => {
      recorded = await result.current.record({
        reference,
        tokens: exactTokens,
        stage: 0,
        mode: "practice",
      });
    });

    expect(recorded).toBeNull();
    expect(recordAttemptMock).not.toHaveBeenCalled();
  });
});
