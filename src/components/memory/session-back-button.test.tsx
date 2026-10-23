import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { SessionBackButton } from "./session-back-button";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("SessionBackButton", () => {
  it("exposes the full destination as the accessible name", async () => {
    const onExit = vi.fn();
    render(
      <TooltipProvider delayDuration={0}>
        <SessionBackButton onExit={onExit} label="Back to John 3" />
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Back to John 3" });
    expect(button).toHaveAccessibleName("Back to John 3");
    expect(button).toHaveTextContent("John 3");
    expect(button).toHaveTextContent("Back to John 3");

    await userEvent.click(button);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("names Memory, never Today", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <SessionBackButton onExit={() => {}} label="Back to Memory" />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Back to Memory" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back to Today" }),
    ).not.toBeInTheDocument();
  });

  it("hides Home when Back already goes to Memory", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <SessionBackButton
          onExit={() => {}}
          label="Back to Memory"
          exitHref="/memory"
        />
      </TooltipProvider>,
    );

    expect(
      screen.queryByRole("link", { name: "Go to Memory" }),
    ).not.toBeInTheDocument();
  });

  it("shows Home when Back goes somewhere else", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <SessionBackButton
          onExit={() => {}}
          label="Back to John 3"
          exitHref="/passage/John-3"
        />
      </TooltipProvider>,
    );

    const home = screen.getByRole("link", { name: "Go to Memory" });
    expect(home).toHaveAttribute("href", "/memory");
    expect(home).toHaveAccessibleName("Go to Memory");
  });
});
