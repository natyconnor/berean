import { vi } from "vitest";

const AREA_TOP = 105; // the session scroll area starts under the top bar
const AREA_BOTTOM = 800;
const LABEL_HEIGHT = 16;
const BOX_TOP = 900; // the new step's answer box starts below the fold
const BOX_HEIGHT = 100;

/**
 * jsdom has no layout, so model just enough of one for a refresher step's
 * label (any `*-header` element) in one scroll area: scrolled to the top, the
 * label sits at `labelTop`. Focusing the answer box without preventScroll
 * scrolls it into view, as Chrome does, and `scrollIntoView` scrolls the
 * label to the area's top. Restore it in a finally block.
 */
export function mockStepLabelLayout(labelTop: number) {
  let scrollTop = 0;
  const isLabel = (el: Element) => el.id.endsWith("-header");
  // One entry per time the label was measured: whether its card had settled
  // (no enter translateY left), since a card still easing in measures low.
  const labelMeasures: { settled: boolean }[] = [];
  const rect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      if (this.dataset.slot === "scroll-area-viewport") {
        return DOMRect.fromRect({
          y: AREA_TOP,
          height: AREA_BOTTOM - AREA_TOP,
        });
      }
      if (isLabel(this)) {
        labelMeasures.push({
          settled: this.closest('[style*="translateY"]') === null,
        });
        return DOMRect.fromRect({
          y: labelTop - scrollTop,
          height: LABEL_HEIGHT,
        });
      }
      if (this instanceof HTMLTextAreaElement) {
        return DOMRect.fromRect({
          y: BOX_TOP - scrollTop,
          height: BOX_HEIGHT,
        });
      }
      return new DOMRect();
    });

  const labelScrolls: Element[] = [];
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value(this: HTMLElement) {
      if (!isLabel(this)) return;
      labelScrolls.push(this);
      scrollTop += this.getBoundingClientRect().top - AREA_TOP;
    },
  });

  const focus = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "focus",
  )!;
  Object.defineProperty(HTMLElement.prototype, "focus", {
    configurable: true,
    value(this: HTMLElement, options?: FocusOptions) {
      (focus.value as (options?: FocusOptions) => void).call(this, options);
      if (!(this instanceof HTMLTextAreaElement) || options?.preventScroll) {
        return;
      }
      const { bottom } = this.getBoundingClientRect();
      if (bottom > AREA_BOTTOM) scrollTop += bottom - AREA_BOTTOM;
    },
  });

  return {
    /**
     * Scroll back to the top and forget earlier label measures and scrolls
     * (opening the refresher reveals step 1), e.g. just before Continue.
     */
    scrollToTop: () => {
      scrollTop = 0;
      labelMeasures.length = 0;
      labelScrolls.length = 0;
    },
    /** The label's top now: 105 is flush with the top bar. */
    labelTop: () => labelTop - scrollTop,
    /** Labels `scrollIntoView` was called on, in order. */
    labelScrolls,
    labelMeasures,
    restore() {
      rect.mockRestore();
      Object.defineProperty(HTMLElement.prototype, "focus", focus);
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    },
  };
}
