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
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: mocks.useLocation,
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/lib/use-tabs", () => ({
  useTabs: () => ({ backPassageId: "John-1" }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => "always",
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
    expect(mocks.navigate).toHaveBeenCalledWith({ href: "/memory/pack-abc" });
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
      href: "/passage/Romans-8?startVerse=28&mode=compose",
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
