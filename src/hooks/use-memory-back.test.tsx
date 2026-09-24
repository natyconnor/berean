import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMemoryBack } from "./use-memory-back";

const navigate = vi.fn();
let canGoBack = false;

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useCanGoBack: () => canGoBack,
}));

function BackButton() {
  const onBack = useMemoryBack();
  return (
    <button type="button" onClick={onBack}>
      Back
    </button>
  );
}

describe("useMemoryBack", () => {
  beforeEach(() => {
    navigate.mockReset();
    canGoBack = false;
  });

  it("returns to the previous screen when one exists", async () => {
    canGoBack = true;
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    render(<BackButton />);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("falls back to the Memory home when opened directly", async () => {
    render(<BackButton />);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(navigate).toHaveBeenCalledWith({ to: "/memory" });
  });
});
