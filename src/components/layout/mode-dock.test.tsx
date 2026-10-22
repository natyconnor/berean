import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnsureInMemoryBackfillForTests } from "@/hooks/use-ensure-in-memory-backfill";
import { clearModeLastLocations } from "@/lib/mode-last-location";
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

vi.mock("@/components/tutorial/feature-callout", () => ({
  FeatureCallout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("ModeDock last-mode restore", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.useQuery.mockClear();
    mocks.useLocation.mockReturnValue({
      pathname: "/passage/John-1",
      href: "/passage/John-1",
    });
    clearModeLastLocations();
  });

  afterEach(() => {
    clearModeLastLocations();
  });

  it("restores the last Memory href after switching back from Notes", async () => {
    const user = userEvent.setup();
    mocks.useLocation.mockReturnValue({
      pathname: "/memory/pack-abc",
      href: "/memory/pack-abc",
    });
    const { rerender } = render(<ModeDock />);

    mocks.useLocation.mockReturnValue({
      pathname: "/passage/John-3",
      href: "/passage/John-3?startVerse=16",
    });
    rerender(<ModeDock />);

    const memoryLink = screen.getByRole("link", { name: "Memory" });
    expect(memoryLink).toHaveAttribute("href", "/memory/pack-abc");

    await user.click(memoryLink);
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/memory/$packId",
      params: { packId: "pack-abc" },
      search: {},
    });
  });

  it("opens Today after a session that the reader sent into Memory", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ModeDock />);

    mocks.useLocation.mockReturnValue({
      pathname: "/memory/learn",
      href: "/memory/learn?book=john&chapter=2&startverse=5&endverse=5&return=%2Fpassage%2Fjohn-2",
    });
    rerender(<ModeDock />);

    mocks.useLocation.mockReturnValue({
      pathname: "/passage/john-2",
      href: "/passage/john-2",
    });
    rerender(<ModeDock />);

    const memoryLink = screen.getByRole("link", { name: "Memory" });
    expect(memoryLink).toHaveAttribute("href", "/memory");
    await user.click(memoryLink);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/memory" });
  });

  it("restores the last Notes href, including search, after leaving Memory", async () => {
    const user = userEvent.setup();
    mocks.useLocation.mockReturnValue({
      pathname: "/passage/Romans-8",
      href: "/passage/Romans-8?startVerse=28&mode=compose",
    });
    const { rerender } = render(<ModeDock />);

    mocks.useLocation.mockReturnValue({
      pathname: "/memory",
      href: "/memory",
    });
    rerender(<ModeDock />);

    const notesLink = screen.getByRole("link", { name: "Notes" });
    expect(notesLink).toHaveAttribute(
      "href",
      "/passage/Romans-8?startVerse=28&mode=compose",
    );

    await user.click(notesLink);
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/passage/$passageId",
      params: { passageId: "Romans-8" },
      search: {
        startVerse: 28,
        endVerse: 28,
        mode: "compose",
      },
    });
  });

  it("does not treat settings as a Notes location after leaving Settings", () => {
    mocks.useLocation.mockReturnValue({
      pathname: "/passage/John-1",
      href: "/passage/John-1",
    });
    const { rerender } = render(<ModeDock />);

    mocks.useLocation.mockReturnValue({
      pathname: "/settings",
      href: "/settings",
    });
    rerender(<ModeDock />);

    mocks.useLocation.mockReturnValue({
      pathname: "/memory",
      href: "/memory",
    });
    rerender(<ModeDock />);

    expect(screen.getByRole("link", { name: "Notes" })).toHaveAttribute(
      "href",
      "/passage/John-1",
    );
    expect(screen.getByRole("link", { name: "Memory" })).toHaveAttribute(
      "href",
      "/memory",
    );
  });
});

describe("ModeDock route visibility", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.useQuery.mockClear();
    mocks.useLocation.mockReturnValue({
      pathname: "/passage/John-1",
      href: "/passage/John-1",
    });
    clearModeLastLocations();
  });

  afterEach(() => {
    clearModeLastLocations();
  });

  it("does not render on Settings or nested settings routes", () => {
    for (const pathname of ["/settings", "/settings/tags"]) {
      mocks.useLocation.mockReturnValue({ pathname, href: pathname });
      const { unmount } = render(<ModeDock />);
      expect(
        screen.queryByRole("navigation", { name: "Mode" }),
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("does not render on terms, privacy, or license paths", () => {
    for (const pathname of ["/terms", "/privacy", "/license"]) {
      mocks.useLocation.mockReturnValue({ pathname, href: pathname });
      const { unmount } = render(<ModeDock />);
      expect(
        screen.queryByRole("navigation", { name: "Mode" }),
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("restores the dock after leaving Settings", () => {
    const { rerender } = render(<ModeDock />);
    expect(
      screen.getByRole("navigation", { name: "Mode" }),
    ).toBeInTheDocument();

    mocks.useLocation.mockReturnValue({
      pathname: "/settings",
      href: "/settings",
    });
    rerender(<ModeDock />);
    expect(
      screen.queryByRole("navigation", { name: "Mode" }),
    ).not.toBeInTheDocument();

    mocks.useLocation.mockReturnValue({
      pathname: "/passage/John-1",
      href: "/passage/John-1",
    });
    rerender(<ModeDock />);
    expect(
      screen.getByRole("navigation", { name: "Mode" }),
    ).toBeInTheDocument();
  });

  it("does not cycle modes with the dock shortcut on Settings", () => {
    mocks.useLocation.mockReturnValue({
      pathname: "/settings",
      href: "/settings",
    });
    render(<ModeDock />);

    fireEvent.keyDown(document, { key: "j", ctrlKey: true });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("cycles modes with the dock shortcut on Notes", () => {
    render(<ModeDock />);

    fireEvent.keyDown(document, { key: "j", ctrlKey: true });
    expect(mocks.navigate).toHaveBeenCalled();
  });

  it("goes to Memory home when the active Memory tab is clicked on a session", async () => {
    const user = userEvent.setup();
    mocks.useLocation.mockReturnValue({
      pathname: "/memory/review",
      href: "/memory/review",
    });
    render(<ModeDock />);

    const memoryLink = screen.getByRole("link", { name: "Memory" });
    expect(memoryLink).toHaveAttribute("href", "/memory");
    await user.click(memoryLink);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/memory", search: {} });
  });

  it("points the Memory tab at home on a pack page, matching a click", async () => {
    const user = userEvent.setup();
    mocks.useLocation.mockReturnValue({
      pathname: "/memory/pack-abc",
      href: "/memory/pack-abc",
    });
    render(<ModeDock />);

    const memoryLink = screen.getByRole("link", { name: "Memory" });
    expect(memoryLink).toHaveAttribute("href", "/memory");
    await user.click(memoryLink);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/memory", search: {} });
  });

  it("points the Memory tab at home during a session even when last Memory was a pack", () => {
    mocks.useLocation.mockReturnValue({
      pathname: "/memory/pack-abc",
      href: "/memory/pack-abc",
    });
    const { rerender } = render(<ModeDock />);

    mocks.useLocation.mockReturnValue({
      pathname: "/memory/learn",
      href: "/memory/learn?book=John&chapter=3&startVerse=16&endVerse=16&return=%2Fpassage%2FJohn-3",
    });
    rerender(<ModeDock />);

    expect(screen.getByRole("link", { name: "Memory" })).toHaveAttribute(
      "href",
      "/memory",
    );
  });

  it("does nothing when Memory is already home", async () => {
    const user = userEvent.setup();
    mocks.useLocation.mockReturnValue({
      pathname: "/memory",
      href: "/memory",
    });
    render(<ModeDock />);

    await user.click(screen.getByRole("link", { name: "Memory" }));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("closes a Memory drawer when the active Memory tab is clicked", async () => {
    const user = userEvent.setup();
    mocks.useLocation.mockReturnValue({
      pathname: "/memory",
      href: "/memory?panel=verses",
    });
    render(<ModeDock />);

    await user.click(screen.getByRole("link", { name: "Memory" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/memory", search: {} });
  });

  it("still restores the last Memory screen when cycling with the keyboard", () => {
    mocks.useLocation.mockReturnValue({
      pathname: "/memory/review",
      href: "/memory/review",
    });
    const { rerender } = render(<ModeDock />);

    mocks.useLocation.mockReturnValue({
      pathname: "/passage/John-1",
      href: "/passage/John-1",
    });
    rerender(<ModeDock />);
    mocks.navigate.mockClear();

    fireEvent.keyDown(document, { key: "j", ctrlKey: true });
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/memory/review",
      search: {},
    });
  });

  it("stays visible after downward scroll", () => {
    render(<ModeDock />);

    fireEvent.scroll(document, { target: { scrollTop: 400 } });
    fireEvent.scroll(window);

    expect(
      screen.getByRole("navigation", { name: "Mode" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notes" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Memory" })).toBeVisible();
  });
});

describe("ModeDock dueCount subscription", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.useQuery.mockClear();
    clearModeLastLocations();
  });

  afterEach(() => {
    clearModeLastLocations();
  });

  it("skips live dueCount on Learn, Practice, Review, and pack sessions", () => {
    const paths = [
      "/memory/learn",
      "/memory/practice",
      "/memory/review",
      "/memory/pack123/learn",
      "/memory/pack123/practice",
      "/memory/pack123/review",
    ];
    for (const pathname of paths) {
      mocks.useLocation.mockReturnValue({ pathname, href: pathname });
      mocks.useQuery.mockClear();
      const { unmount } = render(<ModeDock />);
      expect(mocks.useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
      unmount();
    }
  });

  it("subscribes to dueCount on Memory home and keeps the badge after entering a session", () => {
    mocks.useLocation.mockReturnValue({
      pathname: "/memory",
      href: "/memory",
    });
    const { rerender } = render(<ModeDock />);

    const dueArgs = mocks.useQuery.mock.calls
      .map((call) => call[1])
      .find(
        (args): args is { now: number; tzOffsetMinutes: number } =>
          typeof args === "object" &&
          args !== null &&
          "now" in args &&
          "tzOffsetMinutes" in args,
      );
    expect(dueArgs).toBeDefined();
    expect(typeof dueArgs?.now).toBe("number");
    expect(typeof dueArgs?.tzOffsetMinutes).toBe("number");
    expect(screen.getByLabelText("3 verses due today")).toBeInTheDocument();

    mocks.useLocation.mockReturnValue({
      pathname: "/memory/review",
      href: "/memory/review",
    });
    rerender(<ModeDock />);

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
    expect(screen.getByLabelText("3 verses due today")).toBeInTheDocument();
  });
});

describe("ModeDock inMemory backfill", () => {
  beforeEach(() => {
    resetEnsureInMemoryBackfillForTests();
    mocks.ensureInMemoryBackfill.mockClear();
    mocks.isAuthenticated = true;
    mocks.useLocation.mockReturnValue({
      pathname: "/passage/John-1",
      href: "/passage/John-1",
    });
    clearModeLastLocations();
  });

  afterEach(() => {
    mocks.isAuthenticated = true;
    clearModeLastLocations();
  });

  it("asks for the backfill once per session when signed in", () => {
    const first = render(<ModeDock />);
    first.rerender(<ModeDock />);
    first.unmount();
    render(<ModeDock />);

    expect(mocks.ensureInMemoryBackfill).toHaveBeenCalledTimes(1);
    expect(mocks.ensureInMemoryBackfill).toHaveBeenCalledWith({
      now: expect.any(Number) as number,
    });
  });

  it("waits until the user is signed in", () => {
    mocks.isAuthenticated = false;
    const { rerender } = render(<ModeDock />);
    expect(mocks.ensureInMemoryBackfill).not.toHaveBeenCalled();

    mocks.isAuthenticated = true;
    rerender(<ModeDock />);
    expect(mocks.ensureInMemoryBackfill).toHaveBeenCalledTimes(1);
  });

  it("asks again for the next account after signing out", () => {
    const { rerender } = render(<ModeDock />);
    expect(mocks.ensureInMemoryBackfill).toHaveBeenCalledTimes(1);

    mocks.isAuthenticated = false;
    rerender(<ModeDock />);
    mocks.isAuthenticated = true;
    rerender(<ModeDock />);
    expect(mocks.ensureInMemoryBackfill).toHaveBeenCalledTimes(2);
  });
});
