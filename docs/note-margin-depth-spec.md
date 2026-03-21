# Note margin depth — implementation spec (C, F, G)

This is the third pass for the Margin note UI variant, building on:
- `note-ui-variants-spec.md` — A, B, D, E (editor chrome)
- `note-display-unification-spec.md` — card display warmth

Those specs establish the material (warm stone surfaces, ruled-line editor, softer actions). This spec adds **depth and personality**:

| ID | Name | What it does |
|----|------|-------------|
| **C** | Serif note content | Saved note text uses `Cormorant Garamond` (the same serif as verse text) so notes read as margin annotations of the scripture, not app widget text |
| **F** | Paper grain | A barely-perceptible noise texture on note card surfaces so they feel like paper rather than flat CSS rectangles |
| **G** | Writing-state left accent | When the editor has focus, a warm left accent bar appears on the editor container — the same visual idiom as the amber passage-note bar — communicating "this space is alive and being written in" |

---

## Context: what's already in place

- **Font:** `Cormorant Garamond` (300, 400, 600 weights + italic) is already loaded in `index.html` via Google Fonts. `font-serif` already maps to it in verse text (`verse-row.tsx`, `chapter-header.tsx`).
- **`isFocused` state:** Already tracked in `InlineVerseEditor` (`src/components/notes/editor/inline-verse-editor.tsx` line 566). Currently only used for placeholder visibility. Available to drive G.
- **`isMarginEditorChrome` flag:** Already computed in `InlineVerseEditor` (line 561). The correct branching point for B changes is already established.
- **Margin editor outer shell:** Already in `NoteEditor` (`note-editor.tsx` ~line 156) — `bg-stone-50/60` warm surface without an outer border.

---

## C — Serif note content

### Goal
Saved note text (`NoteContent` component) renders in `Cormorant Garamond` in Margin mode. The editing textarea stays in the default sans — you want writing to feel crisp and modern; only the *finished, read* state gets the serif warmth.

### Where

**File:** `src/components/notes/view/note-card-primitives.tsx`

**Component:** `NoteContent` (~line 111).

`NoteContent` currently applies:
- `density === "reading"` → `text-base leading-7`
- `density === "default"` → `leading-relaxed`

Add a `uiVariant` awareness. Since `NoteContent` is a shared primitive, the cleanest approach is to **accept an optional `uiVariant` prop** (rather than calling the hook inside a shared primitive that may be used in non-variant contexts):

```ts
interface NoteContentProps {
  // ... existing props
  uiVariant?: NoteUiVariantId;
}
```

Callers that want Margin serif: pass `uiVariant={noteUiVariant}` from `ExpandedBubble`, `ExpandedPassageNote`, `CollapsedBubble` (for the truncated preview text), and `CollapsedPassageBubble`.

Alternatively: if `NoteContent` calling `useNoteUiVariant()` directly feels cleaner (it's rendered deeply enough that the context is always available), that works too — just be consistent.

**Class to add when `uiVariant === "margin"`:**
```
font-serif tracking-[0.01em]
```

- No size change from the existing `text-sm` / `text-base` — `Cormorant Garamond` renders slightly larger than a typical sans at the same size, so boosting size is not needed.
- `tracking-[0.01em]` — Cormorant Garamond is a display/text serif that actually benefits from very slightly looser tracking at small sizes.
- `leading-relaxed` / `leading-7` — keep existing density classes. Cormorant Garamond has tall ascenders; the existing line-height is fine.

**Do NOT apply serif to:**
- The editor `contentEditable` in `InlineVerseEditor` — editing stays sans.
- `CollapsedBubble` preview text if it has `line-clamp` — **actually do apply it** here too. The collapsed preview should already hint at the serif warmth so the expand isn't a jarring font swap.
- Tag badges (`NoteTagList`) — leave sans, tags are UI metadata not note prose.
- Verse-ref pills inside note content — already inline elements, leave as-is.

### Dark mode note
Cormorant Garamond at light weights can be harder to read in dark mode at small sizes. If dark mode renders uncomfortably thin, consider `font-[450]` or step up to weight 400 explicitly via `font-normal` when dark. This can be handled with `dark:font-normal` on the serif class if needed — test and decide.

---

## F — Paper grain

### Goal
A barely-perceptible noise texture on note card surfaces (`ExpandedBubble`, `ExpandedPassageNote`, the editor outer shell). At the right opacity it makes flat warm stone feel like actual paper. Wrong opacity and it's distracting — **err on the side of too subtle**.

### Approach: inline SVG data-URI background

No image assets, no new CSS files. A repeating SVG noise pattern as a `background-image` data URI, layered *on top of* the warm stone background-color via a pseudo-element or an `after` overlay div.

The cleanest React approach is a **CSS utility class** defined in `src/index.css`:

```css
/* Paper grain — only used in Margin variant note surfaces */
.note-grain {
  position: relative;
}
.note-grain::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}
```

Key parameters to tune:
- `opacity: 0.028` — start here. Range 0.02–0.04 is the safe zone for "feels like paper, not static."
- `baseFrequency="0.75"` — medium-grain noise. Lower (0.5) = coarser; higher (1.0) = finer dust.
- `background-size: 180px 180px` — tiles the pattern. Too small → visible tiling; too large → pattern is too uniform.

In dark mode the grain should be slightly more visible since dark backgrounds can make it disappear:
```css
.dark .note-grain::after {
  opacity: 0.045;
}
```

### Where to apply

Only in **Margin** mode. The `note-grain` class is added conditionally via `cn()`:

```tsx
// In ExpandedBubble, ExpandedPassageNote, NoteEditor outer shell
cn(
  "...",
  noteUiVariant === "margin" && "note-grain"
)
```

Apply to:
- `ExpandedBubble` outer `<div>` — `src/components/passage/verse-notes.tsx`
- `ExpandedPassageNote` outer `<div>` — `src/components/passage/passage-notes-bubble.tsx`
- `NoteEditor` outer `<div>` (the `isMarginCard` branch) — `src/components/notes/note-editor.tsx`
- `CollapsedBubble` button — `src/components/passage/verse-notes.tsx`
- `CollapsedPassageBubble` outer `<div>` — `src/components/passage/passage-notes-bubble.tsx` (amber surface, grain on top)

**Do NOT apply to:**
- Pills (too small, grain would be invisible and waste a pseudo-element)
- The `contentEditable` itself — you want writing to feel clean
- Tag picker, dropdowns, popovers

### CSS note
Because `::after` uses `position: absolute`, the parent needs `position: relative` and `overflow: hidden` (or `overflow: visible` is fine — the `inset: 0` + `border-radius: inherit` keeps it visually contained). Most note card containers already have `rounded-lg` — `border-radius: inherit` on the pseudo-element ensures grain doesn't bleed outside the rounded corners.

---

## G — Writing-state left accent

### Goal
When the Margin editor has focus, a warm left accent bar appears on the outer `NoteEditor` container. This communicates "you are writing here right now" with the same visual idiom as the amber passage-note left bar (`border-l-2 border-l-amber-400`). It distinguishes the active editor from inactive-but-open note cards — subtle focus management without the heavy `ring` treatment.

### Mechanism

`isFocused` state is already tracked inside `InlineVerseEditor` and exposed via its `onFocus`/`onBlur` callbacks. However, the left accent needs to be on the **outer `NoteEditor` container**, not the `contentEditable` itself.

Two options:

**Option A (recommended):** Lift focus state to `NoteEditor`. `InlineVerseEditor` already accepts `onFocus`/`onBlur`-style callbacks indirectly via the editor's own `onFocus`/`onBlur`. Add an `onFocusChange?: (focused: boolean) => void` prop to `InlineVerseEditor`, called inside its existing `onFocus`/`onBlur` handlers. `NoteEditor` receives this and tracks `const [editorFocused, setEditorFocused] = useState(false)`.

**Option B (simpler):** Use CSS `:focus-within` on the `NoteEditor` outer container. No state needed, no prop changes — just:

```tsx
// In NoteEditor outer div className:
cn(
  "...",
  isMarginCard && "transition-[border-left-color] duration-150 focus-within:border-l-stone-400/60"
)
```

The outer container already has `rounded-lg p-3 shadow-sm bg-stone-50/60` for the margin non-passage case. Adding `border-l-2 border-l-transparent focus-within:border-l-stone-400/60` gives a left accent that appears on focus and fades away on blur. For the passage editor, the `border-l-amber-400` is already permanent — the accent is already there.

**Option B is preferred** because:
- No new prop, no state lift, no component interface change
- CSS `:focus-within` correctly activates when focus is anywhere inside `NoteEditor` (editor, tag picker, Save button, etc.)
- Transition just needs `border-left-color` in the `transition` property

### Implementation in `NoteEditor` outer div

For non-passage Margin card:

```tsx
isMarginCard && !isPassage && "border-l-2 border-l-transparent focus-within:border-l-stone-400/60 transition-[border-left-color] duration-150"
```

- `border-l-transparent` — invisible until focus
- `focus-within:border-l-stone-400/60` — warm neutral, not the full primary blue, not amber (amber is reserved for passage notes)
- `duration-150` — quick enough to feel immediate, not jarring

For passage Margin card, the `border-l-amber-400` already provides a permanent left accent — **no change needed**.

Dark mode: `dark:focus-within:border-l-stone-500/50` alongside the light value.

### What "active editor" looks like vs inactive

With G + the existing `shadow-sm` on note cards:

- **Inactive note card (ExpandedBubble):** warm stone background, soft border, `shadow-sm`, grain — reads as a settled document annotation
- **Active editor (NoteEditor in Margin):** same warm surface + grain, but gains `border-l-stone-400/60` left accent — a subtle but clear "this is the writing surface right now"
- **Passage editor:** amber left bar is always present, which already signals "this is a passage annotation space"

This addresses the earlier feedback about multiple editors being open — the focused one gets the left accent; unfocused-but-open editors sit quietly.

---

## File checklist

| Action | File |
|--------|------|
| **Edit** | `src/index.css` — add `.note-grain` + `::after` CSS |
| **Edit** | `src/components/notes/view/note-card-primitives.tsx` — serif in `NoteContent` |
| **Edit** | `src/components/notes/note-editor.tsx` — G: `border-l` + `focus-within` on outer div |
| **Edit** | `src/components/passage/verse-notes.tsx` — C: pass `uiVariant` to `NoteContent`; F: `note-grain` class on cards |
| **Edit** | `src/components/passage/passage-notes-bubble.tsx` — C: pass `uiVariant`; F: `note-grain` |
| **Optional** | `src/components/notes/editor/inline-verse-editor.tsx` — only if Option A is chosen for G (prop-based focus lift) |

---

## Acceptance criteria

- **C:** Saved note text in Margin uses `Cormorant Garamond`. Switching to Classic switches back to sans-serif. Editing textarea is always sans.
- **F:** Note card surfaces in Margin have a barely-perceptible grain. Not visible as "noise" — just felt as "warmth." Grain does not bleed outside rounded corners. Classic has no grain.
- **G:** Focusing any element inside the Margin `NoteEditor` (for a non-passage note) causes a `border-l-stone-400/60` left accent to appear. Blurring removes it. Passage editor's amber left accent is unchanged and permanent.
- **Switching variants:** All three effects appear/disappear without reload.
- **Dark mode:** Grain opacity steps up slightly; serif text remains readable; left accent uses `stone-500/50`.

---

## Visual outcome

With C + F + G layered on top of A + B + D + E + the display unification:

- **Collapsed note:** warm stone card, serif preview text, barely-there grain — feels like a filled margin annotation
- **Expanded note list:** warm cards with serif content, grain depth, muted chrome
- **Active editor:** same warm surface, grain, ruled-line writing field, left accent bar glows on focus — feels like you're writing on the page
- **Passage note (amber):** retains amber warmth; serif content; grain; left bar already permanent

The result: a notes column that reads as a continuous physical document margin rather than a sidebar form.

---

*End of spec.*
