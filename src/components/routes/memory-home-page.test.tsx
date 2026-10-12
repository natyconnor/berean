import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StagedOnboardingProvider } from "@/components/tutorial/staged-onboarding-provider";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";

import { MemoryHomePage } from "./memory-home-page";

const mutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mutationMock,
}));

vi.mock("@/lib/dev-log", () => ({
  logInteraction: vi.fn(),
}));

vi.mock("@/components/memory/memory-home", () => ({
  MemoryHome: () => <div>Memory home stub</div>,
}));

vi.mock("@/routes/memory/index", () => ({
  Route: { useSearch: () => ({ panel: "verses" }) },
}));

vi.mock("@/components/memory/drawer/memory-panel-host", () => ({
  MemoryPanelHost: ({ panel }: { panel?: string }) => (
    <div>Panel host: {panel}</div>
  ),
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

function renderPage() {
  function Wrapper({ children }: { children: ReactNode }) {
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

  return render(<MemoryHomePage />, { wrapper: Wrapper });
}

describe("MemoryHomePage", () => {
  beforeEach(() => {
    mutationMock.mockReset();
    mutationMock.mockResolvedValue(null);
  });

  it("still mounts the first-visit Memory explainer", async () => {
    renderPage();

    expect(screen.getByText("Memory home stub")).toBeInTheDocument();
    expect(screen.getByText("Panel host: verses")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Welcome to Memory" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Memory is here" }),
    ).not.toBeInTheDocument();
  });
});
