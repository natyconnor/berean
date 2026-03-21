# Plan: Fix verse text selection glitch (runaway highlight)

This document tracks **diagnosis**, **verification**, and a **phased fix strategy** for the bug where a small horizontal drag-selection suddenly highlights a huge vertical swath (“all open verses below”) and then recovers when the selection is adjusted.

You can implement **phases independently** and re-test after each phase. Earlier phases are higher confidence from instrumentation; later phases are hardening and structural cleanup.

---

## Diagnosis (confirmed)

### Symptoms

- Selection starts normally inside expanded verse text.
- After moving the active end by a character or two (often oscillating near the start), the highlight **explodes** vertically.
- `window.getSelection()` can show **`endContainer: document.body`** (with a small integer `endOffset` among `body`’s children) or **`endContainer`** pointing at a **highlight toolbar color button**, while **`startContainer`** remains inside the verse `#text` node.
- `Range.toString().length` jumps to hundreds of characters; `getBoundingClientRect()` height reaches **~full viewport/document** even though the user only intended a few graphemes.

### Root cause (primary)

**`HighlightToolbar`** (`src/components/passage/highlight-toolbar.tsx`):

1. Subscribes to **`document` `selectionchange`** and calls **`updatePosition()`** on every event.
2. That updates React state → **mounts** the toolbar UI (portal) on first valid selection.
3. The toolbar is rendered with **`createPortal(..., document.body)`**, so new **direct children of `body`** appear **while a mouse-driven selection is still being extended**.
4. Browsers can **re-normalize** or **corrupt** the active `Range` when the DOM under `body` changes mid-gesture; endpoints then land on **`body`** or on **newly mounted interactive nodes** (e.g. toolbar buttons).

So this is **not** primarily “multi-verse React state” or `select-none` gaps; it is **selection + portaled UI + `selectionchange` during `mousedown` drag**.

### Secondary factors (lower priority, optional follow-up)

- **Dual verse text layers** (collapsed + expanded `.font-serif` spans in `src/components/passage/verse-row.tsx`) can make boundary behavior flakier; logs showed `dualTextLayerUnderCommonAncestor: true` in healthy small ranges.
- **`HighlightMarkPopover`** also uses `createPortal(..., document.body)` (`highlight-mark-popover.tsx`); less tied to drag-select but worth aligning with whatever portal strategy you choose.

---

## Verification toolkit

### Dev selection logger

- **File:** `src/lib/dev-selection-logger.ts`
- **Enable:** `localStorage.setItem("berean:debugSelection", "1")` or `?debugSelection=1`, reload.
- **Disable:** `localStorage.removeItem("berean:debugSelection")`, reload.

### What “fixed” looks like in logs

- While dragging character-by-character inside one verse, **`endContainer` should stay** in the verse subtree (e.g. `#text` or `mark` / `span` under `span.font-serif`), **never** `body` or toolbar `button`.
- **`commonAncestor`** should stay **inside** the verse row (`[data-verse-number=…]`), not `html` / `body`.
- **`rect.h`** should stay on the order of **line height × lines spanned**, not thousands of pixels.
- **`multiVerse`** should only be `true` if you intentionally selected across verses.

### Manual QA (after each phase)

1. Expand a verse with highlights enabled; drag-select **one character at a time** left/right near the start of the selection; **wiggle** slightly (repro from bug report).
2. Repeat with **multiple adjacent verses expanded**.
3. Confirm highlight toolbar still appears, positions correctly, and **choosing a color** still creates a highlight with correct offsets.
4. Quick regression: collapse verse, passage note drag-selection, note editors, scroll.

---

## Phase A — Gate toolbar updates during active pointer drag (highest ROI, smallest change)

**Goal:** Avoid mounting/updating portaled toolbar DOM on every `selectionchange` **while primary button is down**.

**Idea:**

- Track **pointer down / pointer up** (or `mousedown` / `mouseup` on `document`) for **primary button**.
- In `HighlightToolbar`, **skip** `updatePosition()` (or skip state updates that cause a portal mount) when `buttons === 1` (or equivalent).
- Still run **`updatePosition` on `mouseup`** (you already attach `mouseup` on the verse text element; consider **`document` `pointerup`** so it always fires even if release happens outside the span).

**Files:**

- `src/components/passage/highlight-toolbar.tsx`

**Pros:** Minimal surface area; directly targets the race (DOM changes on `body` mid-drag).  
**Cons:** Toolbar may appear only **after** mouse release (acceptable UX for many apps; can add a short debounce if needed).

**Done when:** Logger shows no `endContainer: body` / toolbar `button` during drag; toolbar still works after release.

---

## Phase B — Harden the toolbar against participating in selection

**Goal:** Even if focus briefly hits chrome, it should not extend text selection into buttons.

**Ideas:**

- Add **`select-none`** (Tailwind) on the portaled root and buttons, e.g. `select-none` on the wrapper and each color control.
- Optionally **`tabIndex={-1}`** on buttons if focus ring / tab order is wrong (only if product allows).
- Ensure **`onMouseDown={(e) => e.preventDefault()`** on **each** interactive child (not only the wrapper), or rely on `select-none` + Phase A.

**Files:**

- `src/components/passage/highlight-toolbar.tsx`

**Done when:** Manual try: drag from verse toward toolbar area; selection should not “stick” to swatches. Logger stays clean.

---

## Phase C — Stop portaling to `document.body` (structural fix)

**Goal:** New UI nodes should not become **siblings of `#root`** under `body`, shifting indices and tempting broken ranges.

**Options (pick one):**

1. **Portal into a dedicated host**  
   - Add `<div id="overlay-root" />` next to `#root` in `index.html` (or create it once in `main.tsx`).  
   - `createPortal(..., document.getElementById("overlay-root"))`.  
   - Keeps overlays out of the React tree but **not** mixed into arbitrary `body` child order with ad-hoc portals.

2. **No portal**  
   - Render toolbar as **`fixed`** positioned **inside** `VerseTextPane` (or a passage-level provider).  
   - May need **`z-index` / stacking context** tuning so it clears note columns and scroll containers.

3. **Portal to `#root`’s parent but after `#root`**  
   - Similar to (1); document the invariant: “all overlays go here.”

**Files:**

- `src/components/passage/highlight-toolbar.tsx`  
- Possibly `index.html` / `src/main.tsx`  
- Later: `src/components/passage/highlight-mark-popover.tsx` for consistency

**Done when:** With Phase A **disabled** (for a harsh test), glitch rate drops; with Phase A **enabled**, glitch is gone across browsers you care about.

---

## Phase D — Reduce `selectionchange` churn

**Goal:** Fewer React commits while selection moves.

**Ideas:**

- **`requestAnimationFrame` debounce** inside `handleSelectionChange` (coalesce multiple events per frame).
- Only call `setState` when **position or offsets actually change** (compare previous rect/offsets with a small epsilon).

**Files:**

- `src/components/passage/highlight-toolbar.tsx`

**Pros:** Less work per frame; may help jank.  
**Cons:** Alone it **does not** fix the bug if you still mount to `body` mid-drag; pair with Phase A or C.

---

## Phase E — Optional: single verse text DOM layer

**Goal:** Remove duplicate `.font-serif` spans (collapsed vs expanded) so there is one selectable text subtree per verse.

**Files:**

- `src/components/passage/verse-row.tsx`  
- Any styles/animation that assumed two layers

**Pros:** Fewer weird boundary cases at `<mark>` / text edges.  
**Cons:** Larger refactor; test expand/collapse animations and `verseTextRef` for highlights carefully.

**When:** After Phases A–C if logs still show odd ranges **only** inside the verse subtree.

---

## Phase F — Optional: related overlays

Apply the **same portal host / no-portal** policy to:

- `src/components/passage/highlight-mark-popover.tsx`

and audit other `createPortal(..., document.body)` usages app-wide (`grep`) for the same class of bug.

---

## Suggested implementation order

| Order | Phase | Rationale |
|------:|-------|-----------|
| 1 | **A** | Matches logs; smallest change; immediate validation |
| 2 | **B** | Cheap hardening; good with A |
| 3 | **C** | Removes structural footgun for future features |
| 4 | **D** | Polish / perf |
| 5 | **E** | Only if still needed |
| 6 | **F** | Consistency |

---

## Rollback / flags

- Keep commits **per phase** so you can bisect.
- Optionally add a **temporary feature flag** (e.g. env or localStorage) for “defer toolbar until pointer up” if you need to ship A behind a toggle.

---

## References (code)

- Toolbar + `selectionchange` + portal: `src/components/passage/highlight-toolbar.tsx`
- Toolbar host: `src/components/passage/view/verse-text-pane.tsx`
- Dual text spans: `src/components/passage/verse-row.tsx` (collapsed / expanded copies under `div.relative.flex-1.min-w-0`)
- Diagnostics: `src/lib/dev-selection-logger.ts`

---

## Changelog

| Date | Note |
|------|------|
| 2026-03-20 | Phase A: skip `updatePosition` on `selectionchange` while primary pointer down; `document` capture `pointerup`/`pointercancel` + deferred `updatePosition` |
