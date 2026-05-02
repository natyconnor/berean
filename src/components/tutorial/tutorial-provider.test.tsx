import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readSearchWorkspaceState } from "@/lib/search-workspace-state";
import { TutorialProvider } from "./tutorial-provider";

const mocks = vi.hoisted(() => {
  const location = { pathname: "/passage/John-1" };

  return {
    location,
    navigate: vi.fn((args: { to: string; params?: { passageId: string } }) => {
      if (args.to === "/settings") {
        location.pathname = "/settings";
        return Promise.resolve();
      }

      if (args.to === "/passage/$passageId" && args.params) {
        location.pathname = `/passage/${args.params.passageId}`;
      }

      return Promise.resolve();
    }),
    completeMainTutorial: vi.fn(() => Promise.resolve({ completedAt: 1 })),
    completeAdvancedSearchTutorial: vi.fn(() =>
      Promise.resolve({ completedAt: 1 }),
    ),
    completeFocusModeTutorial: vi.fn(() => Promise.resolve({ completedAt: 1 })),
  };
});

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: mocks.location.pathname }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("convex/react", () => ({
  useMutation: (reference: string) => {
    switch (reference) {
      case "api.userSettings.completeMainTutorial":
        return mocks.completeMainTutorial;
      case "api.userSettings.completeAdvancedSearchTutorial":
        return mocks.completeAdvancedSearchTutorial;
      case "api.userSettings.completeFocusModeTutorial":
        return mocks.completeFocusModeTutorial;
      default:
        return vi.fn();
    }
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    userSettings: {
      completeMainTutorial: "api.userSettings.completeMainTutorial",
      completeAdvancedSearchTutorial:
        "api.userSettings.completeAdvancedSearchTutorial",
      completeFocusModeTutorial: "api.userSettings.completeFocusModeTutorial",
    },
  },
}));

function TutorialTargets() {
  return (
    <>
      <div data-tour-id="passage-verse-1">verse</div>
      <div data-tour-id="passage-add-note">add note</div>
      <div data-tour-id="note-editor-body">note body</div>
    </>
  );
}

type TutorialProviderStatus = Parameters<
  typeof TutorialProvider
>[0]["tutorialStatus"];

function SearchTutorialTargets() {
  return (
    <>
      <input data-tour-id="search-query-input" aria-label="Search query" />
      <div data-tour-id="search-tag-filter">tag filter</div>
      <div data-tour-id="search-match-mode">match mode</div>
      <div data-tour-id="search-demo-result">result</div>
      <div data-tour-id="search-demo-scripture-context">context</div>
      <div data-tour-id="search-demo-go-to-verse">go to verse</div>
    </>
  );
}

function renderProvider(
  children: ReactNode = <TutorialTargets />,
  tutorialStatus: Partial<TutorialProviderStatus> = {},
) {
  return render(
    <TutorialProvider
      tutorialStatus={{
        categoryColors: {},
        ...tutorialStatus,
      }}
    >
      {children}
    </TutorialProvider>,
  );
}

describe("TutorialProvider", () => {
  beforeEach(() => {
    mocks.location.pathname = "/passage/John-1";
    mocks.navigate.mockClear();
    mocks.completeMainTutorial.mockClear();
    mocks.completeAdvancedSearchTutorial.mockClear();
    mocks.completeFocusModeTutorial.mockClear();
    window.sessionStorage.clear();
    window.localStorage.clear();

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 120,
          bottom: 24,
          width: 120,
          height: 24,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("walks through the first-run tour and never opens settings", async () => {
    const user = userEvent.setup();

    renderProvider();

    expect(await screen.findByText("Welcome to Berean")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Add your first note")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Write what stood out")).toBeInTheDocument();
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(mocks.completeMainTutorial).toHaveBeenCalledWith({});
    });
    expect(
      mocks.navigate.mock.calls.some(
        ([args]) => (args as { to?: string }).to === "/settings",
      ),
    ).toBe(false);
  });

  it("does not redirect to settings when the main tutorial is skipped", async () => {
    const user = userEvent.setup();

    renderProvider();

    expect(await screen.findByText("Welcome to Berean")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Skip" }));

    await waitFor(() => {
      expect(mocks.completeMainTutorial).toHaveBeenCalledWith({});
    });
    expect(
      mocks.navigate.mock.calls.some(
        ([args]) => (args as { to?: string }).to === "/settings",
      ),
    ).toBe(false);
  });

  it("waits for passage targets before showing the first-run tour", async () => {
    renderProvider(<div>No passage content yet</div>);

    await waitFor(() => {
      expect(screen.queryByText("Welcome to Berean")).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText("Preparing this step..."),
    ).not.toBeInTheDocument();
  });

  it("clears persisted search params after the search tutorial finishes", async () => {
    const user = userEvent.setup();
    mocks.location.pathname = "/search";
    window.localStorage.setItem(
      "search_workspace_state_v1",
      JSON.stringify({
        params: { q: "jesus", tags: "love", mode: "any" },
        scrollTop: 40,
      }),
    );

    renderProvider(<SearchTutorialTargets />, {
      mainTutorialCompletedAt: 1,
    });

    expect(await screen.findByText("Text search")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(mocks.completeAdvancedSearchTutorial).toHaveBeenCalledWith({});
    });
    expect(readSearchWorkspaceState().params).toEqual({});
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/search",
      search: {},
      replace: true,
    });
  });
});
