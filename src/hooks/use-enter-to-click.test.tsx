import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useEnterToClick } from "./use-enter-to-click";

function Harness({
  enabled,
  onActivate,
}: {
  enabled: boolean;
  onActivate: () => void;
}) {
  const targetRef = useRef<HTMLButtonElement>(null);
  useEnterToClick(targetRef, enabled);
  return (
    <div>
      <textarea aria-label="Notes" />
      <button type="button">Other</button>
      <button ref={targetRef} type="button" onClick={onActivate}>
        Continue
      </button>
    </div>
  );
}

function fireEnter() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
}

describe("useEnterToClick", () => {
  it("clicks the target on Enter when nothing interactive is focused", () => {
    const onActivate = vi.fn();
    render(<Harness enabled onActivate={onActivate} />);
    (document.activeElement as HTMLElement | null)?.blur();
    fireEnter();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const onActivate = vi.fn();
    render(<Harness enabled={false} onActivate={onActivate} />);
    fireEnter();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("leaves Enter to a focused textarea", async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();
    render(<Harness enabled onActivate={onActivate} />);
    await user.click(screen.getByLabelText("Notes"));
    fireEnter();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("leaves Enter to a different focused button", async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();
    render(<Harness enabled onActivate={onActivate} />);
    await user.click(screen.getByRole("button", { name: "Other" }));
    fireEnter();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("clicks once when the target itself is focused", async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();
    render(<Harness enabled onActivate={onActivate} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    onActivate.mockClear();
    fireEnter();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("stops listening after enabled flips off", async () => {
    const onActivate = vi.fn();
    const user = userEvent.setup();
    function Toggle() {
      const [enabled, setEnabled] = useState(true);
      return (
        <>
          <Harness enabled={enabled} onActivate={onActivate} />
          <button type="button" onClick={() => setEnabled(false)}>
            Disable
          </button>
        </>
      );
    }
    render(<Toggle />);
    await user.click(screen.getByRole("button", { name: "Disable" }));
    onActivate.mockClear();
    (document.activeElement as HTMLElement | null)?.blur();
    fireEnter();
    expect(onActivate).not.toHaveBeenCalled();
  });
});
