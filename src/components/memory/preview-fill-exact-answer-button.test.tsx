import type { ButtonHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PreviewFillExactAnswerButton } from "./preview-fill-exact-answer-button";

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

describe("PreviewFillExactAnswerButton", () => {
  it("hides outside preview and local dev", () => {
    render(
      <PreviewFillExactAnswerButton
        versePlainText="In the beginning"
        onFill={vi.fn()}
        enabled={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /fill exact answer/i }),
    ).not.toBeInTheDocument();
  });

  it("pastes the loaded verse text into the recall box", async () => {
    const user = userEvent.setup();
    const onFill = vi.fn();
    render(
      <PreviewFillExactAnswerButton
        versePlainText="Jesus wept."
        onFill={onFill}
        enabled
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /fill exact answer/i }),
    );
    expect(onFill).toHaveBeenCalledWith("Jesus wept.");
  });

  it("stays disabled until verse text is available", () => {
    render(
      <PreviewFillExactAnswerButton
        versePlainText="   "
        onFill={vi.fn()}
        enabled
      />,
    );
    expect(
      screen.getByRole("button", { name: /fill exact answer/i }),
    ).toBeDisabled();
  });
});
