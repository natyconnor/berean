import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FEATURE_HINTS,
  HINT_QUEUE_COOLDOWN_MS,
  type FeatureHintId,
} from "@/lib/feature-hints";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";
import { StagedOnboardingProvider } from "./staged-onboarding-provider";
import { useFeatureHint, type FeatureHintState } from "./use-feature-hint";

const mutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mutationMock,
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

function TestProvider({ children }: { children: ReactNode }) {
  return (
    <StagedOnboardingProvider
      milestones={milestones}
      hints={[]}
      isLoading={false}
    >
      {children}
    </StagedOnboardingProvider>
  );
}

function HintProbe({
  hintId,
  label,
  trigger = true,
  useDisplayQueue = true,
}: {
  hintId: FeatureHintId;
  label: string;
  trigger?: boolean;
  useDisplayQueue?: boolean;
}) {
  const state: FeatureHintState = useFeatureHint(hintId, trigger, {
    useDisplayQueue,
  });

  return (
    <section aria-label={label}>
      <div data-testid={`${label}-pending`}>{String(state.pending)}</div>
      <button type="button" onClick={state.complete}>
        Complete {label}
      </button>
      <button type="button" onClick={state.dismiss}>
        Dismiss {label}
      </button>
    </section>
  );
}

describe("StagedOnboardingProvider hint queue", () => {
  beforeEach(() => {
    mutationMock.mockReset();
    mutationMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the highest-priority eligible hint instead of the first mounted hint", async () => {
    render(
      <TestProvider>
        <HintProbe
          hintId={FEATURE_HINTS.VERSE_LINKS_AFTER_NOTES}
          label="verse-links"
        />
        <HintProbe
          hintId={FEATURE_HINTS.STUDY_REVEAL_AFTER_FIRST_HEART}
          label="study"
        />
      </TestProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("study-pending")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("verse-links-pending")).toHaveTextContent(
      "false",
    );
  });

  it("waits for the cooldown before showing the next eligible hint", async () => {
    render(
      <TestProvider>
        <HintProbe
          hintId={FEATURE_HINTS.SEARCH_REVEAL_AFTER_LIBRARY}
          label="search"
        />
        <HintProbe hintId={FEATURE_HINTS.READING_MODE_REVEAL} label="reading" />
      </TestProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("search-pending")).toHaveTextContent("true");
    });

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Complete search" }));

    expect(screen.getByTestId("search-pending")).toHaveTextContent("false");
    expect(screen.getByTestId("reading-pending")).toHaveTextContent("false");

    act(() => {
      vi.advanceTimersByTime(HINT_QUEUE_COOLDOWN_MS - 1);
    });
    expect(screen.getByTestId("reading-pending")).toHaveTextContent("false");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.getByTestId("reading-pending")).toHaveTextContent("true");
  });

  it("lets destination explainers bypass the global hint queue", () => {
    render(
      <TestProvider>
        <HintProbe
          hintId={FEATURE_HINTS.SEARCH_REVEAL_AFTER_LIBRARY}
          label="search"
        />
        <HintProbe
          hintId={FEATURE_HINTS.STUDY_FIRST_OPEN_EXPLAINER}
          label="study-explainer"
          useDisplayQueue={false}
        />
      </TestProvider>,
    );

    expect(screen.getByTestId("study-explainer-pending")).toHaveTextContent(
      "true",
    );
  });
});
