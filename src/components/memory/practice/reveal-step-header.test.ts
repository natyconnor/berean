import { afterEach, describe, expect, it, vi } from "vitest";

import { revealStepHeader } from "./reveal-step-header";

/** A session scroll area starting under the 105px top bar, with the label. */
function mountLabel(labelTop: number) {
  document.body.innerHTML = `
    <div data-slot="scroll-area-viewport">
      <p id="step-header">Refresh · First letters · 2 of 3</p>
    </div>`;
  const viewport = document.querySelector<HTMLElement>(
    '[data-slot="scroll-area-viewport"]',
  )!;
  const header = document.getElementById("step-header")!;
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ y: 105, height: 695 }),
  );
  vi.spyOn(header, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ y: labelTop, height: 16 }),
  );
  const scrollIntoView = vi.fn();
  header.scrollIntoView = scrollIntoView;
  return scrollIntoView;
}

describe("revealStepHeader", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("leaves a label already fully in view where it is", () => {
    const scrollIntoView = mountLabel(153);
    revealStepHeader("step-header");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it.each([
    ["above the scroll area", -30],
    ["partly under the top bar", 99],
    ["below the fold", 790],
  ])("scrolls a label %s to the top", (_, top) => {
    const scrollIntoView = mountLabel(top);
    revealStepHeader("step-header");
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start" });
  });
});
