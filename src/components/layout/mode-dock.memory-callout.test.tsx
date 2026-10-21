import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StagedOnboardingProvider } from "@/components/tutorial/staged-onboarding-provider";
import { clearModeLastLocations } from "@/lib/mode-last-location";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";
import { ModeDock } from "./mode-dock";

const mocks = vi.hoisted(() => ({
  ensureInMemoryBackfill: vi.fn(() => Promise.resolve(null)),
  isAuthenticated: true,
  navigate: vi.fn(),
  useLocation: vi.fn(() => ({
    pathname: "/passage/John-1",
    href: "/passage/John-1",
  })),
  useQuery: vi.fn((_query: unknown, args?: unknown) => {
    if (args === "skip") return undefined;
    if (args && typeof args === "object" && "now" in args) return 3;
    return undefined;
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: mocks.useLocation,
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({ backPassageId: "John-1" }),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args?: unknown) => mocks.useQuery(query, args),
  useMutation: () => mocks.ensureInMemoryBackfill,
  useConvexAuth: () => ({
    isAuthenticated: mocks.isAuthenticated,
    isLoading: false,
  }),
}));

const freshMilestones: OnboardingMilestones = {
  notesCount: 0,
  taggedNotesCount: 0,
  distinctTagCount: 0,
  heartsCount: 0,
  hasInlineVerseLink: false,
  hasExplicitVerseLink: false,
  starterTagCount: 0,
  customTagCount: 0,
};

function renderFreshUserDock() {
  return render(
    <StagedOnboardingProvider
      milestones={freshMilestones}
      hints={[]}
      isLoading={false}
    >
      <ModeDock />
    </StagedOnboardingProvider>,
  );
}

describe("ModeDock Memory callout", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.useQuery.mockClear();
    mocks.useLocation.mockReturnValue({
      pathname: "/passage/John-1",
      href: "/passage/John-1",
    });
    clearModeLastLocations();
  });

  it("does not render Memory lives here for a fresh user with no hint rows", async () => {
    renderFreshUserDock();

    expect(
      await screen.findByRole("link", { name: "Memory" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByLabelText("3 verses due today")).toBeInTheDocument();

    await expect(
      screen.findByText("Memory lives here", undefined, { timeout: 250 }),
    ).rejects.toThrow();
    expect(
      screen.queryByRole("button", { name: "Open Memory" }),
    ).not.toBeInTheDocument();
  });
});
