import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  NEED_A_REFRESHER_LABEL,
  REFRESH_IT_FIRST_LABEL,
} from "@/lib/memory-copy";

import { EmptyHintPrompt } from "./memory-refresher-controls";

describe("EmptyHintPrompt Refresh it first", () => {
  it("shows the quiet link, or only Refresh it first on a stale card (AC10)", async () => {
    const onRefresher = vi.fn();
    const { rerender } = render(<EmptyHintPrompt onRefresher={onRefresher} />);
    expect(
      screen.queryByRole("button", { name: REFRESH_IT_FIRST_LABEL }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );

    rerender(<EmptyHintPrompt onRefresher={onRefresher} refreshFirst />);
    expect(
      screen.queryByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: REFRESH_IT_FIRST_LABEL }),
    );
    expect(onRefresher).toHaveBeenCalledTimes(2);
  });

  it("shows neither control without a handler", () => {
    render(<EmptyHintPrompt refreshFirst />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("disables Refresh it first while a save is pending", async () => {
    const onRefresher = vi.fn();
    render(<EmptyHintPrompt onRefresher={onRefresher} refreshFirst disabled />);
    const button = screen.getByRole("button", { name: REFRESH_IT_FIRST_LABEL });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onRefresher).not.toHaveBeenCalled();
  });
});
