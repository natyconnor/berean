# Study mode (product definition)

This document describes the planned **Study** experience and how it relates to Berean’s existing **Passage workspace**. It is a product/architecture reference for implementation work (e.g. favorites, study scopes, practice activities).

## Names

| Name                         | What it is                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Passage workspace**        | Today’s primary in-app context: one Bible chapter (or focused range) with scripture text, verse-linked notes, highlights, and chapter navigation. Implemented around `PassageView`, `/passage/$passageId`, and tabbed passage tabs. |
| **Study** (mode / workspace) | A **separate** surface for **intentful study sessions**: the user picks _what_ to study (scope) and _how_ to study (activity). Not a third toggle inside the passage header.                                                        |

**Why “Passage workspace”**  
It matches routes and components (`PassageView`, passage tabs) and stays distinct from **Search workspace** (`SearchWorkspace`, `/search`), which is already a second top-level workspace for finding notes.

## Passage workspace today (baseline)

- **Purpose:** Read scripture and capture or edit **notes anchored to verses or passages** in real chapter context.
- **View modes (within Passage):** **Read** vs **Compose** (`PassageViewMode`: `"read"` `"compose"`). Read emphasizes comfortable note display density and optional filters (e.g. all verses vs only verses with notes). Compose is for writing; **Focus** is a compose assist (reduce distraction), not a separate global app mode.
- **Note editor:** Variants such as `NoteEditor` `variant="default" \| "passage"` are layout concerns inside this workspace, not separate product “modes.”
- **Strengths:** Full context (ESV text, navigation, per-chapter note layout), precise verse anchoring, tagging, links between passages.

Study does not replace this; users return here from Study when they need full chapter context.

## Study mode (planned)

### Core idea: scope + activity

Study separates two questions:

1. **Scope — “What am I studying?”**
   The corpus or list of material for the session (candidates include, over time, favorites, a whole book, tags/themes, notes matching criteria, saved searches, etc.).
2. **Activity — “How am I studying?”**
   The interaction pattern (e.g. deck review, flashcards, type-to-recall). Activities consume **cards** or **items** produced from the current scope.

This split keeps Study extensible: new data types (first-class citizens) usually become **scope sources**, **card builders**, or **activities** rather than a new top-level app rename.

### Relationship to favorites

**Favorites** (or saved passages) are a **high-signal scope** for Study—“study what I starred,” “short list,” “memory candidates”—but **Study is not only favorites**. Users should also be able to study **by book** (e.g. John), **by theme** (e.g. repentance via tags or future smart scopes), or **from notes**, without requiring every item to be favorited first.

### Relationship to notes and tags

Notes and tags are **first-class inputs** to Study scopes. Themes (e.g. repentance) will often map to **tags** or **note content** before they map to a dedicated “theme” entity. Passages implied by notes (via `verseRefs` / links) can generate deck items alongside explicit favorites.

### UX principles

- **Study is a session workspace**, not a replacement for the chapter reader. Deep links open the Passage workspace when full context is needed.
- **Avoid a third `PassageViewMode`.** Read / Compose / Focus stay passage-local; Study is entered from navigation or CTAs (e.g. “Study favorites”), not by overloading the passage header row.
- **Make scope legible.** Sessions should show a human-readable summary (e.g. “Favorites · 12 items”, “John · tag repentance · 14 items”) so users know what they’re drilling.
- **Start narrow, expand sources.** Early scopes can be a small set (favorites, book, tag); later add saved searches, smart lists, reading plans, etc.

### Boundaries / non-goals (for early iterations)

- **Not** replacing Passage workspace read/compose semantics.
- **Not** requiring full spaced-repetition (SRS) on day one; simple ordering/self-grade is enough to validate Study.
- **Not** duplicating the entire reader UI inside Study; prefer cards, reveals, and links back to `/passage/...`.

## Comparison at a glance

| Dimension        | Passage workspace                            | Study                                               |
| ---------------- | -------------------------------------------- | --------------------------------------------------- |
| Primary unit     | One chapter (tab) in full context            | Session built from a **scope**                      |
| Mental model     | Read vs compose on the page                  | Scope vs activity                                   |
| Navigation       | Tabs, chapter prev/next, verse anchors       | Deck / list / session flow; optional filters        |
| Best for         | Capturing and editing verse-linked notes     | Review, recall, themed sweeps across material       |
| Favorites        | Optional shortcut (future: star from reader) | One possible **scope** among many                   |
| Search workspace | Find notes / run queries                     | Can feed Study via future “scope from search” links |

## Implementation status

- **Passage workspace:** Shipped (`PassageView`, read/compose/focus, notes, highlights, etc.).
- **Search workspace:** Shipped (`/search`).
- **Study:** Spec only; favorites and scope/activity UI to be implemented incrementally.

## Related code (orienting)

- Passage UI: `src/components/passage/passage-view.tsx`, `use-passage-view-mode.ts`, `passage-view-header.tsx`
- Search: `src/components/search/search-workspace.tsx`, `src/routes/search.tsx`
- Notes data model: `convex/schema.ts` (`notes`, `verseRefs`, …), `convex/lib/noteContent.ts`

---

_When adding features, prefer updating this doc if the scope/activity model or naming changes so future sessions stay aligned._
