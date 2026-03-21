# Note manuscript variant — implementation spec

This document proposes a **third note interface option** after:

- `note-ui-variants-spec.md` — `classic` and `margin`, plus the variant switcher
- `note-display-unification-spec.md` — warmer saved note surfaces
- `note-margin-depth-spec.md` — serif content, grain, focus accent

The goal of this third option is not just "warmer notes." It is a stronger visual idea:

- the app should feel like it sits on a sheet of paper
- notes should feel like annotations on that sheet, not floating cards
- personality should come from **ink, paper, artifacts, and motion**, not shadows and boxes

Working name: **`manuscript`**

User-facing label: **Manuscript**

Short description: **Paper page, ink cues, more personal**

---

## 1. Goals

| ID | Name | Summary |
|----|------|---------|
| **H** | Whole-app paper field | Add subtle paper texture and warm page tone to the main app background so the entire reading/writing experience sits on one material plane |
| **I** | No-elevation note surfaces | Remove the floating-card feel by dropping note shadows and reducing heavy container treatment |
| **J** | Ink cues instead of borders | Replace full borders with lighter editorial / handwritten cues: rules, left accents, underlines, and small ink marks |
| **K** | Personal artifacts | Add a small amount of decorative personality such as tape or a folded corner, used sparingly and deterministically |
| **L** | Settled motion | Make notes animate like placed paper, not UI panels lifting off a canvas |

---

## 2. Design intent

### What this variant should feel like

Think **field journal / study manuscript / annotated page**, not "web app cards with parchment colors."

The main difference from `margin` is that `margin` still has a soft-card metaphor:

- rounded rectangles
- local grain on each note
- `shadow-sm`
- note groups that still read like tiles

`manuscript` should flatten the hierarchy:

- the **page** gets the paper identity
- notes sit **within** that page
- note chrome becomes lighter and more editorial
- motion helps unify things without making them feel interactive for the sake of interaction

### Explicitly not in scope for this pass

- Verse-to-note connector lines
- Reworking the theme system or replacing the app theme dropdown
- Handwritten fonts in the editor
- Random decorative noise that changes on each render

---

## 3. Variant system update

### Add a third id

Update the note UI variant model:

```ts
export type NoteUiVariantId = "classic" | "margin" | "manuscript";
```

Registry entry:

```ts
{ id: "manuscript", label: "Manuscript", description: "Paper page, ink cues, more personal" }
```

### Architecture note

Today the note UI variant mostly affects note-related components. `manuscript` intentionally goes wider:

- `AppShell`
- passage header / main reading surface
- note surfaces

That is still acceptable under the existing note-variant context because the passage reading UI and note UI are tightly coupled in this app. The variant is no longer just "note card styling"; it becomes a lightweight **reading/writing interface mode**.

---

## 4. H — Whole-app paper field

### Goal

The user should feel like they are on one paper surface before they even look at a note.

### Principle

Move the paper identity from **each note card** to the **page background**.

That means:

- the global background does more work
- individual notes need less box chrome
- local note grain should be reduced or removed where it reinforces the card silhouette

### Where

**Primary files:**

- `src/components/layout/app-shell.tsx`
- `src/components/passage/passage-view-header.tsx`
- `src/index.css`

### Proposed implementation

Add a manuscript-only shell class to the root app container in `AppShell`, for example:

```tsx
cn(
  "flex flex-col h-screen w-screen overflow-hidden",
  noteUiVariant === "manuscript" ? "app-paper" : "bg-background",
)
```

In `src/index.css`, define a background utility such as:

```css
.app-paper {
  position: relative;
  background:
    radial-gradient(circle at top, rgba(255, 248, 235, 0.65), transparent 40%),
    linear-gradient(to bottom, rgba(120, 90, 50, 0.03), rgba(120, 90, 50, 0.015)),
    var(--background);
}

.app-paper::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,...");
  background-size: 220px 220px;
}
```

### Important interaction with existing `note-grain`

For `manuscript`, do **not** simply stack strong local note grain on top of strong page grain. That doubles the texture and makes each note rectangle more obvious.

Recommended rule:

- `margin`: keep local `.note-grain`
- `manuscript`: page gets the grain; note-local grain becomes either:
  - off by default, or
  - much lighter and reserved for editor / passage surfaces only

### Header treatment

`PassageViewHeader` currently uses `bg-background` plus a shadow when scrolled. In `manuscript`:

- keep the same warm paper family as the shell
- replace obvious shadow with a faint bottom rule or slightly darker paper band

This avoids a "sticky card header on top of paper" look.

---

## 5. I — No-elevation note surfaces

### Goal

Notes should feel like they belong to the page, not hover above it.

### Current sources of the card look

From the current code, the biggest contributors are:

- `shadow-sm` on expanded note surfaces
- `hover:shadow-sm` on collapsed note surfaces
- full rounded rectangles with filled backgrounds
- per-note texture overlays that define each note as a separate block

### Rules for `manuscript`

#### Saved note surfaces

- remove `shadow-sm`
- remove `hover:shadow-sm`
- reduce border usage
- keep only a very soft surface tint where needed for separation
- slightly reduce radius, or make it asymmetric rather than a generic card radius

Recommended surface direction:

- light mode: very low-contrast paper wash over the page, not a fully independent card
- dark mode: warm charcoal parchment, still same-plane, not glowing tiles

#### Editor surface

The editor can keep slightly more structure than saved notes so the writing area still feels actionable, but it should also stay in-plane:

- no drop shadow
- no hard outer box
- rely on rule lines + focus accent instead

### Where

- `src/components/notes/note-editor.tsx`
- `src/components/passage/verse-notes.tsx`
- `src/components/passage/passage-notes-bubble.tsx`
- `src/components/notes/note-bubble.tsx`
- `src/components/notes/note-bubble-stack.tsx`

---

## 6. J — Ink cues instead of borders

### Goal

Containment should come from editorial marks, not component borders.

### Recommended cues

Use one or two of these per note surface, not all at once:

1. **Left rule**
   - A 1–2px neutral or amber rule, softer than the current border treatment
   - Works especially well for active editor and passage notes

2. **Underline / footer rule**
   - A faint bottom rule below the note body or metadata
   - Feels like a manuscript annotation line rather than a box

3. **Inset top rule**
   - A subtle hairline that runs only partway across the top edge
   - Gives a printed-page feel

4. **Ink stamp / mark**
   - Tiny decorative mark near verse label or corner, e.g. a faded dot, nib stroke, or editorial tick
   - Must be very subtle

### What to avoid

- full `border`
- bright UI blue focus rings
- outlines that box the entire note

### Proposed implementation strategy

Create small reusable CSS helpers in `src/index.css`, for example:

```css
.ink-rule-bottom { ... }
```

**Current product (manuscript):** Only the fading **bottom** rule ships (`ink-rule-bottom` + `ms-note-hit` hover line when collapsed). A left rule was dropped so the stroke does not form an L with the footer.

Then compose them per component rather than embedding one-off pseudo-element logic in every JSX branch.

### Best initial mapping

- `CollapsedBubble` / `NoteBubble`: bottom / hover stroke only (transparent fill)
- `ExpandedBubble`: faint footer rule; `ms-ink-group` strengthens it on hover
- `CollapsedPassageBubble` / `ExpandedPassageNote`: same bottom-rule language; passage chrome uses amber typography, not a separate left ink color
- `NoteEditor`: manuscript shell uses `ink-rule-bottom` + focus strengthens the rule

---

## 7. K — Personal artifacts

**Status:** Not shipped. An earlier pass added deterministic tape / folded-corner overlays; they were removed in favor of cleaner ink rules, theme-colored strokes, and hover affordances (`ms-note-hit` / `ms-ink-group` in [`src/index.css`](src/index.css)). Section kept as historical design notes if we revisit decoration later.

---

## 8. L — Settled motion

### Goal

Motion should reinforce the material idea: notes are placed onto paper, opened, and settled. They should not pop like modal cards or lift like draggable widgets.

### Motion principles

- prefer **fade + slight drift + settle**
- avoid large scale changes
- avoid hover lift
- motion should be strongest when opening or creating a note, weakest on hover

### Good candidates

#### Collapsed -> expanded

Use existing `framer-motion` infrastructure, but shift emphasis from "panel expansion" to "paper settling":

- initial `y: 4-8`
- opacity in
- optional `rotate: -0.3 -> 0` for collapsed saved notes only

#### New note creation

New note editor can enter as if it was laid into the margin:

- small upward drift
- no bounce
- 180–260ms

#### Group transitions

Keep crossfades, but make them feel calmer and less mechanical than a panel stack.

### Files likely involved

- `src/components/passage/note-animation-config.ts`
- `src/components/passage/verse-notes.tsx`
- `src/components/passage/passage-notes-bubble.tsx`
- `src/components/passage/passage-view-body.tsx`

---

## 9. Recommended component treatment

### `AppShell`

- manuscript-only `app-paper` root class
- app-wide paper tint + subtle grain

### `PassageViewHeader`

- no obvious card shadow on scroll
- manuscript paper band or bottom rule instead

### `CollapsedBubble`

- no shadow on hover
- no full border
- faint paper wash
- left rule or editorial tick

### `StackedBubble`

- avoid obvious stacked-card metaphor in manuscript
- either:
  - suppress background layers entirely, or
  - make them look like slightly offset paper slips rather than muted cards

### `ExpandedBubble`

- same-plane block, no drop shadow
- serif content does most of the identity work
- border replaced by ink cues

### `CollapsedPassageBubble`

- preserve amber passage association
- keep it in the same plane as the page
- if grain exists here, it should be weaker than the page background

### `ExpandedPassageNote`

- no inner card feeling
- amber rule / accent, not amber box

### `NoteEditor`

- no shadow
- manuscript page wash
- focused writing accent remains important
- optional tape / artifact should **not** appear on the editor itself

### `NoteBubble` / `NoteBubbleStack` in `notes-panel`

- must participate in manuscript, otherwise the standalone panel will feel disconnected from passage view

---

## 10. File checklist

| Action | File |
|--------|------|
| **Edit** | `src/lib/note-ui-variant.ts` — add `"manuscript"` registry entry |
| **Edit** | `src/components/layout/app-shell.tsx` — variant-aware shell class for page background |
| **Edit** | `src/index.css` — `app-paper`, manuscript grain, ink-rule helpers, optional artifact helpers |
| **Edit** | `src/components/passage/passage-view-header.tsx` — manuscript header surface / bottom rule |
| **Edit** | `src/components/notes/note-editor.tsx` — remove elevation, rely on manuscript cues |
| **Edit** | `src/components/passage/verse-notes.tsx` — manuscript collapsed / expanded treatment |
| **Edit** | `src/components/passage/passage-notes-bubble.tsx` — manuscript passage treatment |
| **Edit** | `src/components/notes/note-bubble.tsx` — manuscript notes-panel treatment |
| **Edit** | `src/components/notes/note-bubble-stack.tsx` — manuscript stack treatment |
| **Optional** | `src/components/passage/note-animation-config.ts` — tuned motion values for manuscript |

---

## 11. Implementation order

### Phase 1 — Material plane

1. Add `manuscript` to the variant registry and switcher
2. Add app-level paper background in `AppShell`
3. Reduce or disable local note grain in manuscript

This phase should already make the UI feel less like tiles on a blank app canvas.

### Phase 2 — Remove the card metaphor

1. Remove note shadows
2. Remove hover lift
3. Replace borders with rules / editorial cues

This is the most important visual step.

### Phase 3 — Add personality

1. Add one artifact system: tape **or** folded corner
2. Keep it deterministic and sparse

### Phase 4 — Motion polish

1. Tune note entrance / expansion to feel settled
2. Ensure motion stays quiet in read mode

---

## 12. Acceptance criteria

- Switching to `manuscript` changes the **whole app field**, not just note cards.
- The overall passage + notes experience reads as **one paper context**.
- Notes no longer feel like floating cards:
  - no shadow elevation
  - no strong hover lift
  - no full border dependence
- Containment comes mainly from **ink cues** and spacing.
- Decorative artifacts are **sparse**, stable, and never look random or noisy.
- Motion feels calmer and more material than the current panel/card behavior.
- `classic` and `margin` remain visually intact.

---

## 13. Naming notes

- Preferred internal id: **`manuscript`**
- Preferred label: **Manuscript**
- Acceptable alternatives if naming shifts later:
  - `paper`
  - `journal`
  - `folio`

`manuscript` is recommended because it suggests:

- paper
- annotation
- study
- a little personality

without sounding like a generic design-system variant name.

---

*End of spec.*
