import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionComplete } from "@/components/memory/practice/session-complete";
import type { SessionCompleteVerse } from "@/components/memory/practice/session-complete";
import { TodaySessionSummary } from "@/components/memory/practice/today-session-summary";
import type { FeatureHintRecord } from "@/components/tutorial/staged-onboarding-context";
import { StagedOnboardingProvider } from "@/components/tutorial/staged-onboarding-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";

import { useFirstMasteredToast } from "./use-milestone-hint";

const mocks = vi.hoisted(() => ({
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  toastSuccess: vi.fn(),
}));

function mutation(name: string) {
  let fn = mocks.mutations.get(name);
  if (!fn) {
    fn = vi.fn().mockResolvedValue(null);
    mocks.mutations.set(name, fn);
  }
  return fn;
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutation(name),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    onboarding: {
      markHintShown: "onboarding.markHintShown",
      completeHint: "onboarding.completeHint",
      dismissHint: "onboarding.dismissHint",
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));

vi.mock("@/lib/dev-log", () => ({
  logInteraction: vi.fn(),
}));

const milestones: OnboardingMilestones = {
  notesCount: 0,
  taggedNotesCount: 0,
  distinctTagCount: 0,
  heartsCount: 0,
  hasInlineVerseLink: false,
  hasExplicitVerseLink: false,
  starterTagCount: 0,
  customTagCount: 0,
};

const MEMORIZED_LINE =
  "Psalm 23:1 is memorized. We'll bring it back tomorrow to keep it fresh.";

function verse(
  startVerse: number,
  extra: Partial<SessionCompleteVerse> = {},
): SessionCompleteVerse {
  return {
    id: `psalm-23-${startVerse}`,
    reference: {
      book: "Psalms",
      chapter: 23,
      startVerse,
      endVerse: startVerse,
    },
    learnStage: 3,
    status: "learning",
    ...extra,
  };
}

function Onboarding({
  hints = [],
  isLoading = false,
  children,
}: {
  hints?: FeatureHintRecord[];
  isLoading?: boolean;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <StagedOnboardingProvider
        milestones={milestones}
        hints={hints}
        isLoading={isLoading}
      >
        {children}
      </StagedOnboardingProvider>
    </TooltipProvider>
  );
}

function Summary({ verses }: { verses: SessionCompleteVerse[] }) {
  return <SessionComplete verses={verses} exitLabel="Done" onExit={() => {}} />;
}

beforeEach(() => {
  mocks.mutations.clear();
  mocks.toastSuccess.mockReset();
});

describe("first memorized verse banner", () => {
  it("names the verse once, on the session it moves into review", () => {
    const { rerender } = render(
      <Onboarding>
        <Summary
          key="first"
          verses={[
            verse(1, { status: "reviewing", justMemorized: true }),
            verse(2),
          ]}
        />
      </Onboarding>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(MEMORIZED_LINE);
    expect(mutation("onboarding.completeHint")).toHaveBeenCalledWith({
      hintId: FEATURE_HINTS.CELEBRATE_FIRST_VERSE,
    });

    // A later session that memorizes another verse stays quiet.
    rerender(
      <Onboarding>
        <Summary
          key="second"
          verses={[verse(2, { status: "reviewing", justMemorized: true })]}
        />
      </Onboarding>,
    );
    expect(screen.queryByText(/is memorized\./)).not.toBeInTheDocument();
  });

  it("stays hidden once celebrated, and while hints load", () => {
    const memorized = [verse(1, { status: "reviewing", justMemorized: true })];
    const { unmount } = render(
      <Onboarding
        hints={[
          {
            hintId: FEATURE_HINTS.CELEBRATE_FIRST_VERSE,
            completedAt: 1,
          },
        ]}
      >
        <Summary verses={memorized} />
      </Onboarding>,
    );
    expect(screen.queryByText(/is memorized\./)).not.toBeInTheDocument();
    unmount();

    render(
      <Onboarding isLoading>
        <Summary verses={memorized} />
      </Onboarding>,
    );
    expect(screen.queryByText(/is memorized\./)).not.toBeInTheDocument();
    expect(mutation("onboarding.completeHint")).not.toHaveBeenCalled();
  });

  it("ignores verses that were already memorized when the session began", () => {
    render(
      <Onboarding>
        <Summary verses={[verse(1, { status: "reviewing" })]} />
      </Onboarding>,
    );
    expect(screen.queryByText(/is memorized\./)).not.toBeInTheDocument();
  });

  it("shows on the blended Today summary too", () => {
    render(
      <Onboarding>
        <TodaySessionSummary
          passages={[]}
          learned={[verse(1, { status: "reviewing", justMemorized: true })]}
          attempts={[]}
          onDone={() => {}}
        />
      </Onboarding>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(MEMORIZED_LINE);
  });
});

describe("first mastered toast", () => {
  function renderToast(hints: FeatureHintRecord[] = []) {
    return renderHook(() => useFirstMasteredToast(), {
      wrapper: ({ children }) => (
        <Onboarding hints={hints}>{children}</Onboarding>
      ),
    });
  }

  it("toasts the first mastery once", () => {
    const { result, rerender } = renderToast();

    act(() => result.current("Psalm 1"));
    rerender();
    act(() => result.current("Romans 8:28"));

    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Psalm 1 is mastered.", {
      description: "A month between reviews and it's still yours.",
    });
    expect(mutation("onboarding.completeHint")).toHaveBeenCalledWith({
      hintId: FEATURE_HINTS.CELEBRATE_FIRST_MASTERED,
    });
  });

  it("stays quiet once celebrated", () => {
    const { result } = renderToast([
      { hintId: FEATURE_HINTS.CELEBRATE_FIRST_MASTERED, completedAt: 1 },
    ]);
    act(() => result.current("Psalm 1"));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
