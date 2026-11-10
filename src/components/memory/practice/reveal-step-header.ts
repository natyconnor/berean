/**
 * After Continue to a refresher's next step, bring its label to the top of the
 * session's scroll area (which starts under the top bar), unless it is already
 * fully in view there. Call once the card has settled: measured while it is
 * still easing in, the label sits low and would end up under the top bar.
 */
export function revealStepHeader(headerId: string): void {
  const header = document.getElementById(headerId);
  if (!header) return;
  const viewport = header.closest('[data-slot="scroll-area-viewport"]');
  const area = viewport?.getBoundingClientRect() ?? {
    top: 0,
    bottom: window.innerHeight,
  };
  const { top, bottom } = header.getBoundingClientRect();
  if (top >= area.top && bottom <= area.bottom) return;
  header.scrollIntoView?.({ block: "start" });
}
