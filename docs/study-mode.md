# Study mode

This document describes Berean's **Study** experience — the sibling workspace to the **Passage workspace** and **Search workspace**. It is both a product reference and an accurate picture of what is currently implemented, plus where Study is going next.

## Names

| Name                         | What it is                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Passage workspace**        | Today's primary in-app context: one Bible chapter (or focused range) with scripture text, verse-linked notes, highlights, and chapter navigation. Implemented around `PassageView`, `/passage/$passageId`, and tabbed passage tabs. |
| **Search workspace**         | A second top-level workspace at `/search` for finding notes and tags across your corpus (`SearchWorkspace`).                                                                                                                        |
| **Study** (mode / workspace) | A **separate** surface for **intentful study sessions**: the user picks _what_ to study (scope) and _how_ to study (activity). Not a third toggle inside the passage header.                                                        |

Passage stays where you go to read and capture notes in full chapter context; Study is where you drill through material that already exists.

## Core model: scope + activity

Study separates two questions:

1. **Scope — "What am I studying?"**
   A declarative filter over your existing content. Today's scope is any combination of:

- **Books** — one or more books of the Bible.
- **Chapter ranges** — optional per-book `startChapter`/`endChapter` bounds.
- **Tags** — any set of note tags, combined with a **match mode** of `any` (OR) or `all` (AND).
  An empty scope (no books selected, no tags) covers your whole corpus.

2. **Activity — "How am I studying?"**
   The interaction pattern run over the cards produced from the current scope. Today's activities are **Verse memory** and **Teach** (see [Activities](#activities)). A third "view" — **Overview** — is also selectable, but it's a passive summary rather than an activity.

This split is the extensibility seam: new data sources usually become **scope inputs**, **card builders**, or **activities** rather than a new workspace.

## Current status — v1

Study is shipped as a first-class workspace reachable from the app toolbar (BookOpen icon). It comprises:

- `/study` — the **hub**, listing your saved sessions.
- `/study/new` — the **scope builder**, which creates a session from books + chapter ranges + tag filters.
- `/study/$sessionId` — the **session view**, with Overview / Verse memory / Teach tabs.

### Data model

One new Convex table, `studySessions`, holds a per-user session:

| Field          | Type                                            | Notes                                                                                                             |
| -------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `userId`       | `Id<"users">`                                   | Owner. Indexed via `by_userId_lastOpenedAt`.                                                                      |
| `name`         | optional `string`                               | User-given label; currently not editable post-create.                                                             |
| `scope`        | `{ books, chapterRanges?, tags, tagMatchMode }` | See "Core model" above.                                                                                           |
| `lastView`     | optional `string` (a `SessionView`)             | Remembers which tab the user was on (`overview` / `verse-memory` / `teach`) so reopening the session lands there. |
| `createdAt`    | `number`                                        | Creation timestamp.                                                                                               |
| `lastOpenedAt` | `number`                                        | Bumped on `touch`; used to sort the hub list.                                                                     |

There is no separate "favorites" table. Hearted verses live in `savedVerses`; a session's scope filters them alongside notes.

### Verse-memory data model (spaced repetition)

Spaced repetition is backed by two per-user Convex tables plus a framework-free scheduler (`src/lib/memory-scheduler.ts`). As of this layer the surface is **server-only** — there is no user-facing UI change yet.

| Table                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verseMemory`        | One row per (`userId`, `verseRefId`) tracking the live schedule: `status` (`new`/`learning`/`reviewing`/`mastered`/`suspended`), `previousStatus?` (the active status captured on suspend, so un-suspend restores it exactly), `learnStage` (0..3), `ease`, `intervalDays`, `dueAt`, `consecutiveCorrect`, `lapses`, `lastReviewedAt?`, `createdAt`. Indexed `by_userId_dueAt`, `by_userId_status`, `by_userId_verseRefId`. |
| `verseMemoryReviews` | Append-only log of graded attempts: `verseMemoryId`, `quality` (`exact`/`close`/`off`), `accuracy`, `stage`, `mode` (`learn`/`review`/`deck`), `durationMs?`, `createdAt`. Indexed `by_userId_createdAt`.                                                                                                                                                                                                                   |

**Hearts as seed.** Hearting a verse (`savedVerses.toggle`) now also seeds a `verseMemory` row (`status: "new"`, `dueAt = now`) via the shared `seedVerseMemory` helper if none exists. Seeding is idempotent, so re-hearting never creates a duplicate. **Un-hearting deletes only the `savedVerses` bookmark and intentionally leaves the `verseMemory` row untouched** — this is the least-surprising behavior for a spaced-repetition system: a verse you've begun memorizing keeps its progress and review history even if the heart is toggled off, and re-hearting reuses the same row. (Suspending a verse to remove it from the due queue is a separate, explicit action via `setSuspended`.)

**Backfill.** `internal.migrations.backfillVerseMemory` (an `internalMutation`, kicked off with no args from the dashboard / `convex run`) creates one `verseMemory` row for every existing `savedVerses` row lacking one. It is **batched**: each invocation paginates one bounded batch (`batchSize`, default 200) via `.paginate(...)`, then self-schedules the next batch with `ctx.scheduler.runAfter(0, ...)` until the table is exhausted — so it stays safe on large datasets. Running totals are threaded through the chain and returned alongside `isDone`/`continueCursor`. It is idempotent and safe to run twice (already-seeded pairs are skipped).

### Verse-memory Convex API (`convex/verseMemory.ts`)

All functions validate `args` + `returns`, check auth via `getCurrentUser*`, verify per-row ownership, query through indexes (never `.filter`), and take `now` as an argument (never `Date.now()` in a query). Query/mutation wrappers stay thin; shared logic lives in `convex/lib/verseMemory.ts`.

- `dueQueue({ now, limit? })` — verses with `dueAt <= now` (soonest first, `suspended` excluded), joined to their `verseRefs`. `limit` defaults to 50. Returns `[]` when unauthenticated.
- `dueCount({ now })` — cheap count of due-now verses (excludes suspended); backs the dock badge.
- `recordAttempt({ verseRefId, quality, accuracy, stage, mode, durationMs?, now })` — appends a `verseMemoryReviews` row, loads/seeds the `verseMemory` row, applies `scheduleNext`, and patches the row (including `lastReviewedAt = now`, `createdAt` unchanged) in one atomic mutation. Returns the new `MemorySchedule`.
- `getOrCreateForVerse({ verseRefId, now })` — idempotent upsert via `by_userId_verseRefId`; returns the full row.
- `setSuspended({ verseRefId, suspended })` — toggles `status` to/from `suspended`. Suspending records the current active status in `previousStatus`; un-suspending restores it exactly (falling back to a schedule-derived status via `deriveActiveStatus` only for legacy rows without `previousStatus`). Returns the resulting status, or `null` if the user has no row for that verse.
- `memoryStats({ now })` — per-status counts (`new`/`learning`/`reviewing`/`mastered`/`suspended`), plus `total` and a due-now `due` tally. Used later by the dashboard/hub.

### Convex API (`convex/studySessions.ts`)

- `create({ scope, name? })` — creates a session for the current user.
- `listMine({ paginationOpts })` — paginated via Convex `paginationOptsValidator`. Returns `{ page, isDone, continueCursor, ... }` where each page entry carries live counts: `savedVersesCount`, `notesCount`, and `teachPassagesCount` (distinct verse-linked passages implied by the notes). Ordered by `lastOpenedAt` desc. Backs the hub list via `usePaginatedQuery`.
- `get({ id })` — returns `null` for "not found / not yours", the session otherwise. The client uses the `undefined` vs `null` distinction to separate loading from a missing session.
- `resolveScope({ id })` — fully resolves the session's scope into the lists of `savedVerses` and `notes` needed to build activity cards. Returns `null` for not-found.
- `previewCounts({ scope })` — same shape as the list counts, but for an unsaved scope. Powers the live counter in the scope builder.
- `touch({ id, lastView? })` — bumps `lastOpenedAt` and optionally records which view the user is on.
- `remove({ id })` — deletes a session (user-scoped). Confirmation is enforced in the hub UI.

All queries are safe to call unauthenticated and return `null` / `[]`.

### Today queue (`/study`)

The hub now leads with a **Today** section that **decouples reviews from sessions**: instead of picking a saved collection to drill, the learner reviews the single global due queue across _every_ hearted verse, then falls back to sessions as curated collections.

- **Hub Today card** (`StudyTodaySection` in `study-hub.tsx`) shows **"N due today"** (from `memoryStats.due`), a **Start review** button (disabled when nothing is due), and per-status totals (learning = `new + learning`, reviewing, mastered). `now` comes from a shared `useLiveNow()` hook (`src/hooks/use-live-now.ts`) that refreshes on a coarse ~60s interval and is passed as a query arg, so verses whose `dueAt` lands after the tab was opened get counted (both the headline and the disabled state stay live) — Convex still never calls `Date.now()` itself.
- **The player** (`StudyTodayQueue`, `study-today-queue.tsx`) is an **orchestrator** that reuses the existing deck + learn UIs unchanged:
  - It reads `dueQueue({ now })` and **snapshots** the result on entry so cards don't vanish mid-run as attempts reschedule verses out of the live due set.
  - It maps each due row (a `verseMemory` row joined to its `verseRefs`) into the **verse-memory card model** the deck/learn consume — `{ type: "verse-memory", id: "vm:<memoryId>", reference: { book, chapter, startVerse, endVerse } }`.
  - **New/learning** verses play one at a time through the **learn ladder** (`StudyVerseLearn`), with an orchestrator-owned "Next verse" control to advance. **Reviewing/mastered** verses play through the **deck** (`StudyActivityDeck`) for hidden recall.
  - Because both sub-components record every graded attempt via `useRecordVerseAttempt` → `recordAttempt`, **each completed card reschedules the verse**; a just-reviewed verse's `dueAt` moves into the future and it **leaves the live due queue** (verifiable via the reactive `dueQueue`). The orchestrator watches the live queue to know when the review phase is finished.
- **Session summary** (`StudySessionSummary`, `study-session-summary.tsx`) ends the run: **verses reviewed**, **cleared** (left today's queue), and **stage-ups** (advanced a learn stage) are derived client-side by diffing the entry snapshot against the live due set, while **remaining** (the caught-up/streak status and whether "Keep reviewing" is offered) reads the uncapped `memoryStats.due` — not the capped `dueQueue` length — so it stays accurate when more than 50 verses are due. "Keep reviewing" re-runs against the next batch of still-due verses. No new Convex functions were added.
- **Empty / caught-up state** is handled both on the hub card ("All caught up") and inside the player.

### Hub (`/study`)

- Below the Today section, lists sessions sorted by `lastOpenedAt` desc, fetched in pages via `usePaginatedQuery` with a **Load more** button when more pages exist. Sessions are unchanged by the Today queue — they remain saved collections.
- Each card shows title (name or auto-generated scope summary), scope-aware stats (hearted verses · notes · passages · last studied), any tag filters, and a "Last: {activity}" chip when the previous view was an activity (not Overview).
- Delete button opens a confirmation dialog (`DeleteStudySessionDialog`).
- Empty state has a CTA to `/study/new`.

### Scope builder (`/study/new`, `StudyScopeBuilder`)

- **Presets** (`StudyScopePresets`) for one-click scope choices.
- **Book picker** (`StudyScopeBookPicker`) with optional chapter-range sliders per selected book.
- **Tag filter** (`TagFilterControl`) with `any` / `all` match mode toggle.
- **Live preview counts** via `previewCounts` keep the user oriented while they narrow the scope.
- Submit creates the session and navigates into it.

### Session view (`/study/$sessionId`, `StudySessionView`)

- Header shows the session title (name or scope summary) and a one-line stats strip.
- `StudyActivitySwitcher` exposes three "views": **Overview**, **Verse memory**, **Teach**. Activities are disabled (with a tooltip explaining why) when the scope has no cards for them.
- **Loading vs not-found**: `useQuery(api.studySessions.get)` returns `undefined` while loading and `null` when the id is invalid or the session belongs to a different user. The component shows a loading state for `undefined` and a dedicated "Session not found" panel (with a link back to `/study`) for `null`, so bad links don't spin forever.
- When a view is changed, the client calls `touch` with the new `lastView` so the session reopens on the same tab next time.

### Activities

#### Overview

A passive summary of what the scope contains: two columns (hearted verses, notes), each card linking back to the passage reader. No card deck; no progression.

#### Verse memory (`StudyVerseMemoryCard`)

- One card per hearted verse in the scope.
- Shows the reference; the body is revealed either by flipping the card or by typing the verse from memory.
- Typed recall is scored with `src/lib/diff-words.ts` so near-matches get partial credit.
- On the revealed side, the user's attempt is framed in a tinted "pop" panel so it's obvious where their input lives alongside the ESV text.
- `classifyVerseAttempt` (in `study-attempt-quality.ts`) grades the diff as `exact` / `close` / `off`, and `VerseMemoryFeedback` renders a short celebration banner — a bouncy "Exactly right!" with a confetti burst for exact matches, a calmer "Good job — really close!" chip when only a word or two slipped. Both animations respect `prefers-reduced-motion`.

#### Persisted attempts

Every graded verse attempt is now logged to spaced repetition, fire-and-forget, with **zero visible UX change**:

- The **learn ladder** (`StudyVerseLearn`) records each check with `mode: "learn"` and the current rung as `stage`.
- The **deck** (`StudyVerseMemoryCard`) records the typed recall with `mode: "deck"` (logged at the fully-hidden `MAX_LEARN_STAGE`) when a card is completed.
- Both go through the shared `useRecordVerseAttempt` hook, which resolves the card's `reference` to its `verseRefId` from the user's hearted verses (`savedVerses.listAll`), skips the write when the verse genuinely isn't a hearted verse, and swallows any mutation failure to `devLog` so scheduling never blocks or perturbs the UI. `record` returns the new schedule on success (so callers can adopt the authoritative `learnStage`). Attempts made in the brief window before the hearted-verse list has loaded are **deferred and flushed** once it resolves rather than dropped, and a deck completion tapped before the ESV text has loaded is stashed and flushed when the text arrives.

**`learnStage` has one source of truth: the server.** The scheduler (`scheduleNext`) owns rung progression — an `exact` attempt advances the rung, `close` holds it, `off` drops it — driven by `classifyVerseAttempt`, _not_ by a client-side accuracy threshold. The learn ladder adopts the server rung both on open (restore, via `getOrCreateForVerse`, retried a bounded number of times on transient failure) and after every graded check (from the schedule `recordAttempt` returns), so the persisted rung and the visible rung can never drift and reopen-restore is always correct. Consequently there is **no manual "Next Level" button** anymore: progression is earned by recall quality. The stage tabs remain for freely previewing any hint level; a manual tab change or "Try again" supersedes an in-flight adoption so it never clobbers a rung the learner just chose.

#### Teach (`StudyTeachCard`)

- One card per **distinct verse-linked passage** referenced by the scope's notes (`countDistinctTeachPassageRefs`).
- Card front shows the passage reference; flipping reveals the user's notes on that passage plus ESV text.
- On the revealed side, the "What you wrote" panel gets the same tinted pop styling as the verse memory attempt so the user's own teach point stands out next to the passage text and saved notes.
- Optional 5-minute teaching timer built in.
- A small dev-only debug flag (`localStorage.berean:debugStudyTeach` / `?debugStudyTeach=1`) adds instrumentation via `devLog`.

### Deck mechanics (`StudyActivityDeck`)

- Fisher–Yates randomization, swipe left/right with a stacked-card motion, initial "dealer" shuffle animation.
- Progress tracking (`completedIds`), restart, and skip-forward.
- Reduced-motion aware via Framer Motion.
- Owns **no scheduling logic**: the active verse-memory card publishes a "record this attempt" callback through a ref, and the deck fires it on completion (`Done`) so the attempt is persisted before the card unmounts. Teach cards never register a callback, so completing them is a no-op here.

### Toolbar & routing integration

- Study is reachable from the app toolbar (`TabBar`), which highlights when the active route starts with `/study`. The toolbar Study icon is now a **permanent fallback** (no longer soft-hidden behind the first-heart reveal); the reveal callout has moved to the Mode Dock.
- Three TanStack Router routes under `src/routes/study/` (`index.tsx`, `new.tsx`, `$sessionId.tsx`), each delegating to a thin page component in `src/components/routes/` that renders the real feature component.

### Mode Dock (`src/components/layout/mode-dock.tsx`)

A single floating pill, bottom-center, is the app's only new persistent chrome. It has two segments — **Notes** and **Study** — and is `position: fixed`, so it adds **zero layout cost** and stays thumb-reachable on mobile.

- **Navigation.** "Notes" routes to the passage workspace (`/passage/$passageId` using the last-viewed passage from `useTabs().backPassageId`); "Study" routes to `/study`. The active segment reflects the current route (`aria-current="page"`). _Simplification:_ rather than tracking a distinct "last passage" concept, Notes reuses the existing `backPassageId` (the most recent passage tab), which is the app's default passage target.
- **Live badge.** The Study segment shows `verseMemory.dueCount({ now })` (with `now` from `useLiveNow()`), so it updates as verses fall due or get reviewed. The badge is **absent entirely when the count is zero** (never cry wolf) and carries an `aria-label` like "7 verses due for review".
- **Mounted** in `AppShell` fixed at the bottom center, above content, below dialogs/splash.
- **Auto-hide.** Slides down after ~24px of downward scroll (listening to scroll capture across the app's nested scroll containers), and returns on upward scroll or when scrolling stops (~500ms idle). It also hides while a note editor/textarea is focused. _Simplification:_ the app's Focus mode is currently passage-local React state (`useFocusMode`) and isn't observable from the app shell, so full Focus-mode integration is **deferred**; hiding on editor focus covers the "disappear while you work" intent for now.
- **Keyboard.** `⌘J` / `Ctrl+J` toggles between Notes and Study, wired the same ad-hoc way `TabBar` wires `⌘G` (a document `keydown` listener); tooltips use `formatCommandOrControlShortcut`.
- **A11y & motion.** `<nav aria-label="Mode">` with focusable segments and visible focus rings; `prefers-reduced-motion` swaps the slide for a fade (via `useReducedMotion`).
- **Reveal.** The one-time reveal on first heart reuses `useFeatureHint` + `FeatureCallout` + `FEATURE_HINTS.STUDY_REVEAL_AFTER_FIRST_HEART` (the same hint the toolbar used before) — no new onboarding path. The dock forces itself visible while that callout is pending. The dock only **claims** the hint in the global display queue while it can actually render the callout (i.e. `modeDock !== "off"`); when the dock is off, the toolbar Study link is the fallback that **completes** the reveal on open, so the queue is never pinned by an eligible-but-unrendered callout and always progresses. `complete()` is idempotent, so whichever path the user takes (dock callout or toolbar) resolves the hint exactly once.
- **Preference.** `userSettings.modeDock` (`"auto-hide"` | `"always"` | `"off"`, default `"auto-hide"`) persists the behavior via `userSettings.getModeDockPreference` / `setModeDockPreference`. `"always"` disables auto-hide (dock always visible); `"off"` hides the dock entirely (the toolbar Study icon remains the escape hatch). A control in Settings (`ModeDockSection`) toggles it. Only this preference is persisted — scroll/focus visibility is local component state.

## Known limitations (v1)

- **`listMine` performance.** Pagination bounds the number of session rows per response, but counts still require reading all of the user's `savedVerses` + `noteVerseLinks` plus `ctx.db.get`s for every unique `verseRefId` and `noteId` referenced by those links — these are O(user corpus) each call. Likely future improvements, in order of preference:
  1. Denormalize counts onto the `studySessions` row and recompute in a scheduled mutation on relevant writes.
  2. Render the hub without counts and resolve them lazily per visible card.
- **No full schedule/streak dashboard yet.** The Today queue surfaces due work on the hub and the Mode Dock now shows a live due badge, but there is still no full schedule/streak dashboard — that comes in a later PR. (A streak/flame on the dock was left out of this pass since it isn't trivially available yet.)
- **No session editing.** You can delete a session but can't rename it, change its scope, or clone it after creation.
- **No in-deck navigation back to `/passage/...`.** Cards show references but don't deep-link into the reader mid-activity.
- **Counts recompute on every scope edit.** `previewCounts` is a full query; it's fine but noticeably chatty on slow connections.

## Roadmap

Rough, in priority order. Nothing here blocks v1.

### Near-term polish

- **Edit session name** and inline rename.
- **Edit scope** on an existing session (creates a new session under the hood, carries session identity forward if possible).
- **Duplicate session** as a scope-editing starting point.
- **Sort / filter** the hub by last studied, created, or activity type.
- **Per-card "open in reader"** shortcut inside Verse memory and Teach so the user can jump to full context without losing their place in the deck.

### Activities

- **Spaced repetition** layer for Verse memory (simple SM-2-style scheduling; no streaks required at first).
- **Note recall** activity: given a verse, recall the notes you wrote about it.
- **Tag drill** activity: given a tag, produce the passages / notes tagged with it in a deck.
- **Reading activity**: timed-read-through of the scope's chapters with lightweight progress.

### Scope sources

- **Saved searches as scopes** — let the user pick any query from the Search workspace as the basis for a session.
- **Smart scopes** — e.g. "notes from the past 30 days", "verses I've hearted but never revisited", "notes I've never taught".
- **Reading plans** as time-boxed scope generators.
- **Gospel parallels** as a built-in scope source (uses the existing `gospelParallels` table).

### Data / infra

- Denormalized session counts + scheduled recompute (see "Known limitations").
- Analytics on which activities actually get used, so we can kill the ones that don't pay rent.

## Relationship to other workspaces

- **Passage workspace** stays the canonical reader/editor. Study links out to it for context and is expected to link into it from cards in the future.
- **Search workspace** is complementary: Search answers "where did I write about X?"; Study answers "drill me on this slice of my corpus". The two should eventually merge at the seam where a saved search becomes a study scope.

## Related code

- Data / server: `convex/schema.ts` (`studySessions`, `verseMemory`, `verseMemoryReviews`), `convex/studySessions.ts`, `convex/verseMemory.ts`, `convex/lib/verseMemory.ts`, `convex/migrations.ts`.
- Scheduler: `src/lib/memory-scheduler.ts` (pure, framework-free).
- Routes: `src/routes/study/index.tsx`, `src/routes/study/new.tsx`, `src/routes/study/$sessionId.tsx`.
- Mode Dock: `src/components/layout/mode-dock.tsx`, mounted in `src/components/layout/app-shell.tsx`; preference control in `src/components/settings/mode-dock-section.tsx`; Convex get/set in `convex/userSettings.ts` (`modeDock` field in `convex/schema.ts`).
- Feature components: `src/components/study/*.tsx`.
- Card model + deck: `src/components/study/study-card-model.ts`, `study-activity-deck.tsx`.
- Today queue: `src/components/study/study-today-queue.tsx` (orchestrator), `study-session-summary.tsx` (end-of-run card), and the `StudyTodaySection` in `study-hub.tsx`.
- Attempt persistence bridge: `src/components/study/use-record-verse-attempt.ts` (used by `study-verse-learn.tsx` and `study-verse-memory-card.tsx`).
- Scope summary helper: `src/components/study/study-scope-summary.ts`.

---

_When adding features, prefer updating this doc if the scope/activity model, the data model, or naming changes, so future sessions stay aligned._
