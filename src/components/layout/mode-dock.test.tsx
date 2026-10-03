import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearModeLastLocations } from "@/lib/mode-last-location";
import { ModeDock } from "./mode-dock";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useLocation: vi.fn(() => ({
    pathname: "/passage/John-1",
    href: "/passage/John-1",
  })),
  useQuery: vi.fn((_query: unknown, args?: unknown) => {
    if (args === "skip") return undefined;
    if (args && typeof args === "object" && "now" in args) return 3;
    return "always";
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
}));

vi.mock("framer-motion", () => ({
  motion: {
    nav: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => (
      <nav aria-label="Mode" className={className}>
        {children}
      </nav>
    ),
  },
  useReducedMotion: () => true,
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

  it("does not treat settings as a Notes location", () => {
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
