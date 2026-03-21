# Note UI variants — implementation spec (LLM / human)

This document describes how to implement **visual variant A, B, D, E** for the note-writing experience, plus an **extensible UI-variant switcher** in the app top bar (`TabBar`). The goal is to compare **Classic** (current shadcn-style notes) against **Margin** (warmer, less “form-like” notes) and to make adding a third variant straightforward.

---

## 1. Goals

| ID | Goal | Summary |
|----|------|---------|
| **A** | Warm note surfaces | Replace cold `bg-card` / `bg-background` note shells with subtle warm neutrals (aligned with expanded verse `bg-stone-50/80`). |
| **B** | Softer editor chrome | Replace the full bordered `contentEditable` box with a **ruled-line** feel: transparent background, **bottom border only**, focus deepens the line (not a heavy ring). |
| **D** | Fewer nested boxes | For the Margin variant, **drop the outer bordered card** around `NoteEditor` so it is not “box inside box.” |
| **E** | Softer actions + shortcut affordance | Margin: **Cancel** as text link; **Save** smaller / less primary-chrome; shortcut row uses **`<kbd>`** chips (match Compose/Read toggle style), with **⌘ on Mac / Ctrl on Windows** for Enter-to-save. |

**Non-goals for this pass:** Changing typography of *saved* note display (`NoteContent` / `ExpandedBubble`) unless trivial; passage-note amber styling can stay structurally the same but should respect the same variant hooks where it shares `NoteEditor`.

---

## 2. Variant system (extensible)

### 2.1 Identifier type

Define a **closed union** of string literals, e.g.:

```ts
export type NoteUiVariantId = "classic" | "margin";
```

- **`classic`** — today’s UI (default). No behavior change for existing users.
- **`margin`** — A + B + D + E applied to note surfaces and `NoteEditor` / `InlineVerseEditor`.

**Extension pattern:** To add `"journal"` later:

1. Add `"journal"` to `NoteUiVariantId`.
2. Add a registry entry (label, optional description).
3. Implement styling branches (prefer a single `getNoteUiClasses(variant)` or `cn(...)` helpers rather than scattered `if` chains).

### 2.2 Registry (menu + docs)

Create something like:

```ts
export const NOTE_UI_VARIANTS: readonly {
  id: NoteUiVariantId;
  label: string;
  description?: string;
}[] = [
  { id: "classic", label: "Classic", description: "Current UI" },
  { id: "margin", label: "Margin", description: "Warmer, less form-like" },
];
```

The **dropdown menu** maps over this array so new variants only touch the registry + styles.

### 2.3 Persistence

- **Storage key:** e.g. `berean:note-ui-variant` (or `berean_note_ui_variant`).
- **Storage:** `localStorage`.
- **Default:** `"classic"`.
- On change: write storage, update React state so all open `NoteEditor` instances re-render.

### 2.4 React API

Provide a small **client-only** context (hydration-safe):

- `NoteUiVariantProvider` in `AppShell` (wraps children inside `TabBar`’s sibling tree so both `TabBar` and passage content see the same context — **wrap at `AppShell` level** around the whole shell, or wrap `AppShell`’s inner fragment).
- `useNoteUiVariant(): { variant: NoteUiVariantId; setVariant: (id: NoteUiVariantId) => void }`.

**SSR note:** If the app hydrates, read `localStorage` in `useEffect` after mount **or** accept a flash of `classic` until hydrated (simplest). Document the chosen approach in a one-line comment.

---

## 3. Top bar menu (TabBar)

### 3.1 Placement

File: `src/components/layout/tab-bar.tsx`.

Add a control in the **right toolbar cluster** (same `div` as `ThemeDropdown`), e.g. **before or after** `ThemeDropdown`:

- Use **`DropdownMenu`** from `@/components/ui/dropdown-menu` (already used elsewhere in the project if available; otherwise use the same menu primitive as `ThemeDropdown`).
- **Trigger:** icon button, e.g. `LayoutTemplate`, `PanelsTopLeft`, or `Sparkles` from `lucide-react`, `size="icon"`, `h-8 w-8`, with tooltip: **“Note appearance”** or **“Note UI”**.

### 3.2 Menu contents

- **Label:** “Note UI” (or “Note appearance”).
- **Items:** one `DropdownMenuRadioGroup` bound to `variant`, options from `NOTE_UI_VARIANTS`.
- **Optional:** short `description` as `DropdownMenuItem` secondary text or `title` attribute.

### 3.3 Accessibility

- `aria-label` on trigger.
- Keyboard navigation via Radix/shadcn defaults.

---

## 4. Wiring `variant` into components

### 4.1 `NoteEditor`

File: `src/components/notes/note-editor.tsx`.

- Call `useNoteUiVariant()` inside `NoteEditor` (or pass `variant` prop from parents — **prefer hook** to avoid prop drilling through `VerseNotes`, `PassageNotesBubble`, dialogs, `notes-panel`).
- **`classic`:** keep existing `className` branches (`border bg-card`, passage amber shell, etc.).
- **`margin` + `presentation === "card"`:**
  - **D:** Outer wrapper: **no** `border` on the default verse path; use warm background (A), light `shadow-sm` optional, generous padding. Avoid “double card.”
  - **A:** e.g. `bg-stone-50/60 dark:bg-stone-950/40` (tune for contrast).
  - **Passage variant:** keep left amber accent if it helps differentiation, but soften outer box to match warm neutrals where it duplicates a second heavy border.
- **`presentation === "dialog"`:** Either keep dialog styling identical to classic for now, or apply only **E** (kbd row) in dialog — **spec recommendation:** dialog stays **classic** chrome unless trivial; focus Margin on inline/card passage UX first.

### 4.2 `InlineVerseEditor`

File: `src/components/notes/editor/inline-verse-editor.tsx`.

- Accept `uiVariant?: NoteUiVariantId` **or** call the same context hook (hook avoids changing every call site).
- **`classic`:** keep current classes on `contentEditable`:

  ```tsx
  "min-h-[96px] rounded-md border bg-background px-3 py-2.5 text-sm leading-relaxed ... focus:ring-[3px]"
  ```

- **`margin` — B:**
  - `bg-transparent` (or `bg-transparent` with parent providing warm tint).
  - `border-0 border-b border-border/60 rounded-none px-1 py-2` (tune padding).
  - Focus: `focus:ring-0 focus:border-b-primary/70` (or `focus-visible:outline-none` + border color).
  - **Placeholder** absolutely positioned: align `left` with new padding.
  - Ensure **verse-link popover** still positions correctly (`wrapperRef` unchanged).

### 4.3 Actions row — **E**

File: `src/components/notes/note-editor.tsx` (footer).

- **`classic`:** keep current `TooltipButton` Cancel + Save.
- **`margin`:**
  - **Cancel:** `<button type="button" className="text-sm text-muted-foreground hover:text-foreground ...">Cancel</button>` (or `Button variant="link"` if available).
  - **Save:** smaller button, e.g. `size="sm"` or custom `text-xs font-medium` with `variant="secondary"` or soft primary — avoid large solid primary if it feels loud; still must meet contrast.
  - **Shortcut line:** replace plain text with:

    - Mac: `<kbd className="...">⌘</kbd><kbd className="...">Enter</kbd> <span className="text-muted-foreground">to save</span>`
    - Non-Mac: `<kbd>Ctrl</kbd><kbd>Enter</kbd> ...`

    Reuse the same `kbd` micro-style as `PassageViewHeader` Compose/Read (`rounded border bg-muted px-1 py-0 text-[10px] font-medium`).

  - **Implementation note:** Prefer a tiny helper `isApplePlatform()` (can mirror `src/lib/keyboard-shortcuts.ts` or export from there) so we don’t duplicate UA sniffing beyond `note-editor.tsx`’s existing `navigator.userAgent` check — **consolidate** to one utility.

### 4.4 Expanded saved note cards (optional consistency)

Files: `src/components/passage/verse-notes.tsx` (`ExpandedBubble`), `src/components/passage/passage-notes-bubble.tsx` (`ExpandedPassageNote`).

- **Not strictly required** for the first PR if timeboxed.
- **If quick:** for `margin` only, swap `bg-card` → warm stone background and slightly softer border — keeps read mode aligned with editor.

---

## 5. File checklist (expected new / touched files)

| Action | Path |
|--------|------|
| **Add** | `src/lib/note-ui-variant.ts` — type, storage key, `readNoteUiVariant()`, `writeNoteUiVariant()`, `NOTE_UI_VARIANTS` |
| **Add** | `src/components/notes/note-ui-variant-context.tsx` — provider + hook |
| **Edit** | `src/components/layout/app-shell.tsx` — wrap with `NoteUiVariantProvider` |
| **Edit** | `src/components/layout/tab-bar.tsx` — dropdown trigger + radio items |
| **Edit** | `src/components/notes/note-editor.tsx` — variant branches for shell + footer |
| **Edit** | `src/components/notes/editor/inline-verse-editor.tsx` — variant branches for `contentEditable` |
| **Optional** | `src/lib/keyboard-shortcuts.ts` — export `isApplePlatform` / reuse for kbd labels |
| **Optional** | `verse-notes.tsx` / `passage-notes-bubble.tsx` — warm card for margin |

---

## 6. Visual acceptance criteria

- **Classic:** Pixel-parity (or intentionally unchanged) for existing note editor and cards.
- **Margin:**
  - Note editor area reads as **one** surface, not nested white boxes.
  - Editor text area feels like **writing on a line**, not a form field.
  - Background is **slightly warm** vs pure white card.
  - Footer shows **kbd** chips for save shortcut; Cancel is clearly secondary.
- **Switcher:** Changing variant in TabBar updates open editors **without** full page reload.
- **Persistence:** Refresh page → last variant restored.

---

## 7. Testing suggestions

- Open passage, add note inline — toggle Classic ↔ Margin.
- Open two draft editors on adjacent verses — confirm Margin focus styling still OK (future: combine with “active editor shadow” if implemented separately).
- Read mode + dialog editors — confirm no layout break; dialog can remain Classic.
- Dark mode — warm stone tokens must remain readable (check `dark:` pairs).
- `notes-panel.tsx` editors — should pick up hook automatically.

---

## 8. Reference — current code anchors

- `NoteEditor` shell: `src/components/notes/note-editor.tsx` (~lines 135–148).
- `InlineVerseEditor` contentEditable classes: `src/components/notes/editor/inline-verse-editor.tsx` (~lines 945–948).
- `ExpandedBubble` card: `src/components/passage/verse-notes.tsx` (~lines 306–310).
- Top bar toolbar: `src/components/layout/tab-bar.tsx` (~lines 102–177).

---

## 9. Naming notes

- Internal id **`margin`** is arbitrary; rename to **`warm`** or **`paper`** in code if you prefer — keep **registry** as the user-facing label source.
- Avoid the word “theme” in UI copy to prevent confusion with light/dark **Theme** dropdown.

---

*End of spec.*
