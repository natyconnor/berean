import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryHomePage } from "./memory-home-page";

vi.mock("@/components/memory/today/today-page", () => ({
  TodayPage: () => <div>Today page stub</div>,
}));

vi.mock("@/routes/memory/index", () => ({
  Route: { useSearch: () => ({ panel: "verses" }) },
}));

vi.mock("@/components/memory/drawer/memory-panel-host", () => ({
  MemoryPanelHost: ({ panel }: { panel?: string }) => (
    <div>Panel host: {panel}</div>
  ),
}));

describe("MemoryHomePage", () => {
  it("renders Today with the panel host and no welcome dialog", () => {
    render(<MemoryHomePage />);

    expect(screen.getByText("Today page stub")).toBeInTheDocument();
    expect(screen.getByText("Panel host: verses")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Welcome to Memory" }),
    ).not.toBeInTheDocument();
  });
});
