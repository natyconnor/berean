import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  NEED_A_REFRESHER_LABEL,
  REFRESH_IT_FIRST_LABEL,
} from "@/lib/memory-copy";

import { EmptyHintPrompt } from "./memory-refresher-controls";

describe("EmptyHintPrompt Refresh it first", () => {
  it("shows the button only when asked, and both controls call their handler", async () => {
    const onRefresher = vi.fn();
    const onRefreshFirst = vi.fn();
    const { rerender } = render(<EmptyHintPrompt onRefresher={onRefresher} />);
    expect(
      screen.queryByRole("button", { name: REFRESH_IT_FIRST_LABEL }),
    ).not.toBeInTheDocument();

    rerender(
      <EmptyHintPrompt
        onRefresher={onRefresher}
        onRefreshFirst={onRefreshFirst}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: REFRESH_IT_FIRST_LABEL }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL }),
    );
    expect(onRefreshFirst).toHaveBeenCalledTimes(1);
    expect(onRefresher).toHaveBeenCalledTimes(1);
  });

  it("disables the button whenever the link is disabled (save pending)", async () => {
    const onRefresher = vi.fn();
    const onRefreshFirst = vi.fn();
    render(
      <EmptyHintPrompt
        onRefresher={onRefresher}
        onRefreshFirst={onRefreshFirst}
        disabled
      />,
    );
    const button = screen.getByRole("button", { name: REFRESH_IT_FIRST_LABEL });
    const link = screen.getByRole("button", { name: NEED_A_REFRESHER_LABEL });
    expect(button).toBeDisabled();
    expect(link).toBeDisabled();
    await userEvent.click(button);
    expect(onRefreshFirst).not.toHaveBeenCalled();
  });
});
