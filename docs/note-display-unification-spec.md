# Note display unification — implementation spec

This is the follow-up to `note-ui-variants-spec.md`. It assumes the `NoteUiVariantId` type, `useNoteUiVariant()` hook, and the Margin editor changes (A, B, D, E) are already in place.

**Goal:** Unify the *saved / display* state of note cards with the warmer Margin editor aesthetic. Right now the editor feels like writing on paper, but closed and expanded note cards still render as `border bg-card` web-app tiles. This spec closes that gap so the whole notes column — writing or reading — feels like a continuous document margin.

---

## Affected components

| Component | File | What changes |
|-----------|------|--------------|
| `CollapsedBubble` | `src/components/passage/verse-notes.tsx` | Warm background + softer border |
| `StackedBubble` | `src/components/passage/verse-notes.tsx` | Warm card face + no stacking layers in Margin |
| `ExpandedBubble` | `src/components/passage/verse-notes.tsx` | Already partially done — verify & complete |
| Expanded verse header | `src/components/passage/verse-notes.tsx` | Soften "New note" blue color |
| `ExpandedPassageNote` | `src/components/passage/passage-notes-bubble.tsx` | Remove inner double-border in Margin |
| Expanded passage header | `src/components/passage/passage-notes-bubble.tsx` | Soften "New note" blue color |

**Do not touch** for this pass: `CollapsedPassageBubble` (already warm amber — fine as-is), `PassageNotesPill`, `VerseNotesPill`, `NoteBubbleShell` animation shell.

---

## 1. Shared token reference

All warm Margin surfaces use this palette (consistent with the Margin editor shell):

| Purpose | Light | Dark |
|---------|-------|------|
| Card background | `bg-stone-50/60` | `dark:bg-stone-950/40` |
| Card border | `border-stone-200/70` | `dark:border-stone-800/60` |
| Card border (tighter) | `border-stone-200/50` | `dark:border-stone-800/40` |

These should already be established in the editor implementation. Use the same values here for visual consistency.

---

## 2. `CollapsedBubble` — verse-notes.tsx (~line 205)

**Current (`classic`):**
```
rounded-lg border border-border bg-card px-2.5 py-1.5 text-left text-[13px] transition-all hover:shadow-sm
```

**Margin:**
- Background: `bg-stone-50/60 dark:bg-stone-950/40`
- Border: `border-stone-200/70 dark:border-stone-800/60`
- On hover: keep `hover:shadow-sm`, optionally add `hover:bg-stone-50/80` for subtle warmth lift

The `CollapsedBubble` sub-components that are passed to `NoteBubbleShell` are currently pure functions with no access to the variant. They need to either:
- **Option A (preferred):** Call `useNoteUiVariant()` directly inside `CollapsedBubble` (it's already a named function, just not a hook consumer).
- **Option B:** Accept a `uiVariant` prop threaded from `VerseNotes` (which already calls `useNoteUiVariant()` or can).

`VerseNotes` itself is a `memo` component — it can call the hook and pass `variant` down to its sub-components as a prop, or each sub-component can call the hook independently. Either works; **prefer the hook in each component** to avoid adding props.

---

## 3. `StackedBubble` — verse-notes.tsx (~line 231)

**Current:** Uses `StackedCardBackground` (two `bg-muted/40` pseudo-layers) + a `bg-card border-border` front card.

**Margin changes:**

1. **Front card face:** Same token swap as `CollapsedBubble` — `bg-stone-50/60 border-stone-200/70`.

2. **Stacked layers:** The visual stacking metaphor (physical "card deck") belongs to the Classic idiom. In Margin, **suppress the stacked layers entirely** — pass a `showStack={false}` prop to `StackedCardBackground`, or conditionally skip rendering it:

   ```tsx
   {noteUiVariant !== "margin" && <StackedCardBackground count={count} variant="muted" />}
   ```

   Without the offset shadow layers the multi-note indicator comes from the badge alone, which is cleaner.

3. **Count badge:** Keep `Badge variant="outline"` — it's already subtle. No change needed.

---

## 4. `ExpandedBubble` — verse-notes.tsx (~line 292)

This was partially done in the initial Margin pass. Verify the existing implementation matches:

- **Default density (compose mode):** `border rounded-lg px-3 py-2.5 shadow-sm text-sm bg-stone-50/70 dark:bg-stone-950/35 border-stone-200/80 dark:border-stone-800/80`
- **Reading density (read mode):** `border rounded-xl px-4 py-3 shadow-sm bg-stone-50/70 dark:bg-stone-950/35 border-stone-200/80 dark:border-stone-800/80`

If `ExpandedBubble` does not yet call `useNoteUiVariant()`, add it. The component is a plain named function — hooks are fine there.

---

## 5. Expanded verse group header — verse-notes.tsx (~lines 118–144)

The "New note" and "Collapse" buttons at the top of the expanded note group:

```tsx
// Current "New note" — too loud in Margin
className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
```

**Margin:** Change `text-primary` → `text-muted-foreground` and `hover:text-primary/80` → `hover:text-foreground`. This keeps the action discoverable but stops it from being the first thing the eye lands on — the note content should be primary, not the chrome.

Access to variant: `VerseNotes` already calls `useNoteUiVariant()` (or will after the `ExpandedBubble` fix above). The expanded content is rendered inline inside `VerseNotes`, so `noteUiVariant` is already in scope — no prop drilling needed.

The "Collapse" button is already `text-muted-foreground` — **no change needed**.

---

## 6. `ExpandedPassageNote` — passage-notes-bubble.tsx (~line 350)

**Current:** Inner note card inside the amber shell:
```
rounded-lg border border-amber-200/70 bg-amber-50/60 dark:bg-amber-900/18 dark:border-amber-700/45 px-4 py-3
```

**Problem:** In Margin mode the expanded passage section already has an amber outer container (`rounded-xl border border-amber-200 bg-amber-50/40 p-3`). Each `ExpandedPassageNote` inside it then adds *another* amber border. The result is nested amber boxes.

**Margin fix:** Remove the border from `ExpandedPassageNote` in Margin mode — let the outer shell provide containment:

- Default density Margin: `rounded-md bg-amber-50/30 dark:bg-amber-900/12 px-3 py-2 text-sm` (no border)
- Reading density Margin: `rounded-lg bg-amber-50/40 dark:bg-amber-900/15 px-4 py-3` (no border)

This creates **one amber surface** with note content sitting on it, rather than a card-inside-a-card.

`ExpandedPassageNote` is a plain named function — add `useNoteUiVariant()` inside it directly.

---

## 7. Expanded passage group header — passage-notes-bubble.tsx (~lines 130–165)

Same treatment as the verse group header (section 5 above):

```tsx
// Current "New note" — same loud blue
className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
```

**Margin:** `text-muted-foreground hover:text-foreground`.

`PassageNotesBubble` is a `memo` component that can call `useNoteUiVariant()` directly. The expanded content is rendered inline so `noteUiVariant` will be in scope.

---

## 8. What does NOT change

- `CollapsedPassageBubble` — already warm amber with a left accent bar. Looks correct and intentional. Leave as-is across both variants.
- `PassageNotesPill` / `VerseNotesPill` — pill state is brief and small; the `bg-card` there is fine.
- `NoteCardActions` (edit/delete icon buttons) — no change. The `opacity-0 group-hover:opacity-100` pattern already makes them feel unobtrusive.
- `NoteTagList` — no change. Tags are already small and subdued.
- Dialog/quick-capture presentation — out of scope for Margin v1.

---

## 9. Hook access pattern (reminder)

All sub-components in `verse-notes.tsx` and `passage-notes-bubble.tsx` are **named functions** (not arrow function exports), so calling hooks inside them is valid. The `useNoteUiVariant()` hook just reads React context — it is cheap and safe to call in multiple places.

```ts
// Pattern used in every component that branches on variant:
const { variant: noteUiVariant } = useNoteUiVariant();
const isMargin = noteUiVariant === "margin";
```

---

## 10. Acceptance criteria

- **Classic:** Pixel-parity with current behavior. `bg-card border-border` surfaces unchanged.
- **Margin:**
  - `CollapsedBubble`: warm stone background, softened border — matches editor container tone.
  - `StackedBubble`: same warm face, no stacked offset layers.
  - `ExpandedBubble`: warm stone background (verify existing implementation is complete).
  - Expanded verse group: "New note" is muted, not primary blue.
  - `ExpandedPassageNote`: no inner amber border — single amber surface.
  - Expanded passage group: "New note" is muted, not primary blue.
- **Switching Classic ↔ Margin:** All surfaces update without reload.
- **Dark mode:** Stone tokens (`stone-950/40`, `stone-800/60`) remain readable; no contrast failures.

---

## 11. File checklist

| Action | File |
|--------|------|
| **Edit** | `src/components/passage/verse-notes.tsx` |
| **Edit** | `src/components/passage/passage-notes-bubble.tsx` |

No new files required.

---

*End of spec.*
