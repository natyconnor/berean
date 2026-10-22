import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { SessionBackButton } from "./session-back-button";

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
});
