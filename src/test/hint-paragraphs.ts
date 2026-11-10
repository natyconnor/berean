/** A hint's text, one line per paragraph (one paragraph per verse). */
export function hintParagraphs(hint: HTMLElement): string {
  return Array.from(hint.querySelectorAll("p"), (p) => p.textContent).join(
    "\n",
  );
}
