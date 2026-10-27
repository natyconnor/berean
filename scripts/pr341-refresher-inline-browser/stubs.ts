export function useNavigate() {
  return () => {};
}

export function useMutation() {
  return async () => lapseSchedule();
}

export function useAction() {
  return async () => [];
}

export function useQuery(name?: string, args?: unknown) {
  if (args === "skip") return undefined;
  if (name === "savedVerses.listRecordingIds") return [];
  return { stale: false, lastReviews: [] };
}

export function usePaginatedQuery() {
  return { results: [], status: "Exhausted", loadMore: () => {} };
}

export const api = {
  packs: {
    recordUnifiedReview: "packs.recordUnifiedReview",
    acceptRetryHold: "packs.acceptRetryHold",
  },
  passageMemory: {
    recordAttempt: "passageMemory.recordAttempt",
    acceptRetryHold: "passageMemory.acceptRetryHold",
  },
  verseMemory: {
    recordAttempt: "verseMemory.recordAttempt",
    acceptRetryHold: "verseMemory.acceptRetryHold",
    finishRefresh: "verseMemory.finishRefresh",
    reviewFreshness: "verseMemory.reviewFreshness",
  },
  savedVerses: {
    listRecordingIds: "savedVerses.listRecordingIds",
  },
};

const NOW = Date.UTC(2026, 9, 12, 18);

function lapseSchedule() {
  return {
    status: "reviewing" as const,
    learnStage: 3,
    stageReps: 0,
    ease: 2.3,
    intervalDays: 2,
    dueAt: NOW + 2 * 24 * 60 * 60 * 1000,
    consecutiveCorrect: 0,
    lapses: 1,
    earlyReviewApplied: false,
  };
}

export function useLiveNow() {
  return NOW;
}

export function useFirstMasteredToast() {
  return () => {};
}

export function useVersePracticeAttempt() {
  return {
    resolveVerseRefId: () => "vr_119_105",
    recordWithSeqAdopt: async (
      _key: string,
      _args: unknown,
      onAdopt: (next: ReturnType<typeof lapseSchedule>) => void,
    ) => {
      const delayMs = Number(
        new URLSearchParams(window.location.search).get("delay") ?? "0",
      );
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      const next = lapseSchedule();
      onAdopt(next);
      return next;
    },
  };
}

const PSALM_119_105 = "Your word is a lamp to my feet and a light to my path.";
const PSALM_23_V1 = "The Lord is my shepherd; I shall not want.";

export function useEsvReference(
  ref: {
    book?: string;
    chapter?: number;
    startVerse?: number;
  } | null,
) {
  const text = ref?.chapter === 119 ? PSALM_119_105 : PSALM_23_V1;
  return {
    data: {
      canonical: `Psalm ${ref?.chapter ?? 23}`,
      copyright: "test",
      verses: [{ number: ref?.startVerse ?? 1, text }],
    },
    loading: false,
    error: null,
    retry: () => {},
  };
}

export function useEsvCompositePassage() {
  return {
    text: PSALM_23,
    segments: [],
    loading: false,
    error: null,
    retry: () => {},
  };
}

export const PSALM_23 = [
  "The Lord is my shepherd; I shall not want.",
  "He makes me lie down in green pastures. He leads me beside still waters.",
  "He restores my soul. He leads me in paths of righteousness for his name's sake.",
  "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
  "You prepare a table before me in the presence of my enemies; you anoint my head with oil; my cup overflows.",
  "Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the Lord forever.",
].join(" ");

export const PSALM_119 = PSALM_119_105;
