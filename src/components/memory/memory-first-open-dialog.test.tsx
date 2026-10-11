import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StagedOnboardingProvider } from "@/components/tutorial/staged-onboarding-provider";
import type { FeatureHintRecord } from "@/components/tutorial/staged-onboarding-context";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";

import { MemoryFirstOpenDialog } from "./memory-first-open-dialog";

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

function renderDialog(hints: FeatureHintRecord[] = []) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StagedOnboardingProvider
        milestones={milestones}
        hints={hints}
        isLoading={false}
      >
        {children}
      </StagedOnboardingProvider>
    );
  }

  return render(<MemoryFirstOpenDialog />, { wrapper: Wrapper });
}

describe("MemoryFirstOpenDialog", () => {
  beforeEach(() => {
    mutationMock.mockReset();
    mutationMock.mockResolvedValue(null);
  });

  it("shows the first-visit Memory explainer", async () => {
    renderDialog();

    expect(
      await screen.findByRole("heading", { name: "Welcome to Memory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Memory helps you store up your hearted verses and carry them with you.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Heart verses to see them here."),
    ).toBeInTheDocument();
  });

  it("does not show after the first-visit hint is completed", () => {
    renderDialog([
      {
        hintId: FEATURE_HINTS.MEMORY_FIRST_OPEN_EXPLAINER,
        completedAt: 1,
      },
    ]);

    expect(
      screen.queryByRole("heading", { name: "Welcome to Memory" }),
    ).not.toBeInTheDocument();
  });

  it("dismisses the first-visit explainer", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Got it" }));

    expect(
      screen.queryByRole("heading", { name: "Welcome to Memory" }),
    ).not.toBeInTheDocument();
  });
});
