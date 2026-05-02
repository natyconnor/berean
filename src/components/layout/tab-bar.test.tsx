import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { StagedOnboardingContext } from "@/components/tutorial/staged-onboarding-context";
import {
  SEARCH_MIN_NOTES_TOTAL,
  STUDY_MIN_HEARTS,
} from "@/lib/staged-onboarding-thresholds";
import { TabBar } from "./tab-bar";

function StagedOnboardingTestProvider({ children }: { children: ReactNode }) {
  return (
    <StagedOnboardingContext.Provider
      value={{
        milestones: {
          notesCount: SEARCH_MIN_NOTES_TOTAL,
          taggedNotesCount: 0,
          distinctTagCount: 0,
          heartsCount: STUDY_MIN_HEARTS,
          hasInlineVerseLink: false,
          hasExplicitVerseLink: false,
          starterTagCount: 0,
          customTagCount: 0,
        },
        isHintCompleted: () => false,
        isHintDismissed: () => false,
        isHintShown: () => false,
        isHintPending: () => false,
        isHintDisplayActive: () => false,
        requestHintDisplay: () => {},
        markShown: () => {},
        complete: () => {},
        dismiss: () => {},
        isLoading: false,
      }}
    >
      {children}
    </StagedOnboardingContext.Provider>
  );
}

const mocks = vi.hoisted(() => ({
  closeTab: vi.fn(),
  navigate: vi.fn(),
  setActiveTab: vi.fn(),
  signOut: vi.fn(),
  useLocation: vi.fn(() => ({ pathname: "/passage/John-1" })),
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({
    tabs: [{ id: "john-1", passageId: "John-1", label: "John 1" }],
    activeTabId: "john-1",
    setActiveTab: mocks.setActiveTab,
    closeTab: mocks.closeTab,
  }),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signOut: mocks.signOut,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: mocks.useLocation,
  useNavigate: () => mocks.navigate,
}));

vi.mock("./tab-item", () => ({
  TabItem: ({ tab }: { tab: { label: string } }) => (
    <button>{tab.label}</button>
  ),
}));

vi.mock("./theme-dropdown", () => ({
  ThemeDropdown: () => <div data-testid="theme-dropdown" />,
}));

vi.mock("@/components/notes/search-dialog", () => ({
  SearchDialog: () => null,
}));

vi.mock("@/components/bible/passage-navigator", () => ({
  PassageNavigator: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

describe("TabBar", () => {
  beforeEach(() => {
    mocks.closeTab.mockReset();
    mocks.navigate.mockReset();
    mocks.setActiveTab.mockReset();
    mocks.signOut.mockReset();
    mocks.useLocation.mockReturnValue({ pathname: "/passage/John-1" });
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  it("shows the search shortcut in the tooltip once the milestone is reached", async () => {
    const user = userEvent.setup();

    render(
      <StagedOnboardingTestProvider>
        <TooltipProvider delayDuration={0}>
          <TabBar />
        </TooltipProvider>
      </StagedOnboardingTestProvider>,
    );

    await user.hover(
      screen.getByRole("link", { name: "Open search workspace" }),
    );
    expect(
      await screen.findByRole("tooltip", {
        name: "Open search workspace (\u2318K)",
      }),
    ).toBeInTheDocument();
  });

  it("hides the search and study buttons until the staged onboarding milestones fire", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <TabBar />
      </TooltipProvider>,
    );

    expect(
      screen.queryByRole("link", { name: "Open search workspace" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: "Open study" })).toBeNull();
  });

  it("shows the passage shortcut in the tooltip", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider delayDuration={0}>
        <TabBar />
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole("button", { name: "Go to passage" }));
    expect(
      await screen.findByRole("tooltip", { name: "Go to passage (\u2318G)" }),
    ).toBeInTheDocument();
  });

  it("shows the settings shortcut in the tooltip", async () => {
    const user = userEvent.setup();

    render(
      <TooltipProvider delayDuration={0}>
        <TabBar />
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole("link", { name: "Open settings" }));
    expect(
      await screen.findByRole("tooltip", { name: "Open settings (\u2318,)" }),
    ).toBeInTheDocument();
  });

  it("opens settings with ctrl-comma", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <TabBar />
      </TooltipProvider>,
    );

    fireEvent.keyDown(document, { key: ",", ctrlKey: true });

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/settings" });
  });
});
