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
- `/memory` — the **Memory** workspace: the progress dashboard, library, and due-queue Review (see [Memory mode](#memory-mode-memory)).

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

| Table                | Purpose                                                                                                                                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verseMemory`        | One row per (`userId`, `verseRefId`) tracking the live schedule: `status` (`new`/`learning`/`reviewing`/`mastered`), `learnStage` (0..3), `ease`, `intervalDays`, `dueAt`, `consecutiveCorrect`, `lapses`, `lastReviewedAt?`, `createdAt`. Indexed `by_userId_dueAt`, `by_userId_status`, `by_userId_verseRefId`. |
| `verseMemoryReviews` | Append-only log of graded attempts: `verseMemoryId`, `quality` (`exact`/`close`/`off`), `accuracy`, `stage`, `mode` (`learn`/`review`/`deck`/`practice`), `durationMs?`, `createdAt`. Indexed `by_userId_createdAt`.                                                                                              |

**Hearts as seed.** Hearting a verse (`savedVerses.toggle`) now also seeds a `verseMemory` row (`status: "new"`, `dueAt = now`) via the shared `seedVerseMemory` helper if none exists. Seeding is idempotent, so re-hearting never creates a duplicate. **Un-hearting deletes only the `savedVerses` bookmark and intentionally leaves the `verseMemory` row untouched** — this is the least-surprising behavior for a spaced-repetition system: a verse you've begun memorizing keeps its progress and review history even if the heart is toggled off, and re-hearting reuses the same row.

**The "in Memory = hearted" read contract.** A verse is _active / in Memory_ exactly when a `savedVerses` row exists for it; the `verseMemory` row is durable history that may outlive the heart. Therefore **every read that reports the live memory set filters to hearted verses**: `dueQueue`, `dueCount`, `memoryStats`, `masteryDistribution`, `reviewForecast`, and `listLibrary`. Un-hearting needs no write to the memory row — it simply stops matching these reads — and re-hearting resumes automatically because the row (and its schedule) was never touched. There is **no suspended state**; opting a verse out of review is done by un-hearting it.

**Backfill.** `internal.migrations.backfillVerseMemory` (an `internalMutation`, kicked off with no args from the dashboard / `convex run`) creates one `verseMemory` row for every existing `savedVerses` row lacking one. It is **batched**: each invocation paginates one bounded batch (`batchSize`, default 200) via `.paginate(...)`, then self-schedules the next batch with `ctx.scheduler.runAfter(0, ...)` until the table is exhausted — so it stays safe on large datasets. Running totals are threaded through the chain and returned alongside `isDone`/`continueCursor`. It is idempotent and safe to run twice (already-seeded pairs are skipped).

### Verse-memory Convex API (`convex/verseMemory.ts`)

All functions validate `args` + `returns`, check auth via `getCurrentUser*`, verify per-row ownership, query through indexes (never `.filter`), and take `now` as an argument (never `Date.now()` in a query). Query/mutation wrappers stay thin; shared logic lives in `convex/lib/verseMemory.ts`.

- `dueQueue({ now, limit? })` — verses with `dueAt <= now` (soonest first), **heart-aware**: only verses that currently have a `savedVerses` row are returned (un-hearted verses keep their memory row but drop out of the queue), joined to their `verseRefs`. `limit` defaults to 50. Returns `[]` when unauthenticated.
- `dueCount({ now })` — cheap **heart-aware** count of due-now verses (only currently-hearted verses); backs the dock badge.
- `recordAttempt({ verseRefId, quality, accuracy, stage, mode, durationMs?, now })` — appends a `verseMemoryReviews` row, loads/seeds the `verseMemory` row, applies `scheduleNext`, and patches the row (including `lastReviewedAt = now`, `createdAt` unchanged) in one atomic mutation. `mode` accepts `learn`/`review`/`deck`/`practice` (the scheduler ignores `mode`, so **practice reschedules identically** — it is a logging distinction only). Returns the new `MemorySchedule`.
- `getOrCreateForVerse({ verseRefId, now })` — idempotent upsert via `by_userId_verseRefId`; returns the full row.
- `memoryStats({ now })` — **heart-aware** per-status counts (`new`/`learning`/`reviewing`/`mastered`), plus `total` and a due-now `due` tally, computed by iterating the user's hearted verses (`savedVerses`) and joining each to its `verseMemory` row. Used by the hub for the "due today" number.
- `listLibrary({ paginationOpts, sort })` — **paginated** (`paginationOptsValidator` + `.paginate()`) list of the user's hearted verses, each joined to its live memory schedule + `verseRefs` (reference, `status`, `dueAt`, `intervalDays`, `learnStage`, `ease`, `lapses`, `lastReviewedAt?`, `heartedAt`). `sort` picks the index the page is read through so ordering is stable across pages: `"dueAt"` (soonest-due first, `by_userId_dueAt`), `"status"` (grouped by status via `by_userId_status` — **index order, which is alphabetical, not lifecycle order**), or `"recent"` (most-recently-hearted first, `savedVerses.by_userId_createdAt`). The canonical set is the user's _hearted_ verses: for the memory-indexed sorts, rows without a matching `savedVerses` heart are filtered out of the page (a verse un-hearted after review keeps its memory row, so it must be excluded here), and a hearted verse still awaiting its `verseMemory` seed is skipped rather than fabricated. Filtering can shrink a page but keeps cursors correct (per Convex pagination guidance).
- `verseDetail({ verseRefId, now })` — per-verse drill-down. Returns the live schedule (`status`, `intervalDays`, `dueAt`, `ease`, `lapses`, `learnStage`, `consecutiveCorrect`, `lastReviewedAt?`), whether it's currently hearted (`isHearted` + `heartedAt`), `isDue` (the only use of `now`), the **last 20** graded attempts (newest-first, from `verseMemoryReviews` via `by_userId_createdAt`), and a derived `difficulty` signal. Because the reviews log is only indexed `by_userId_createdAt` (no per-verse index), attempts are gathered by walking the user's log newest-first, matching on `verseRefId`, and stopping at 20 matches or a 500-row scan cap. Returns `null` when the user has no memory row for the verse. **Difficulty is derived only from what is stored** — per-token diffs are _not_ persisted (only `quality` + `accuracy` per attempt), so an exact "hardest phrase" is not derivable; `difficulty` instead reports `attemptCount`, `averageAccuracy`, `worstAccuracy`, and `hardestStage` (the learn stage with the lowest mean accuracy).

Additionally, `savedVerses.listForChapter` (and the shared saved-verse item shape) now joins each saved verse's `verseMemory` row into an optional `memory: { status, intervalDays, dueAt }` field. This is what powers the reader's **heart mastery ring** without any per-verse follow-up query — the join happens inside the single per-chapter query the reader already runs.

#### Dashboard aggregate queries

Four read-only aggregate queries back the [progress dashboard](#progress-dashboard-study). All follow the same rules as the rest of the module (args + returns validators, auth + ownership, `.withIndex` only, `now` passed in — never `Date.now()`), and delegate their day-bucketing to the pure, framework-free helpers in `src/lib/dashboard-buckets.ts` (shared so the buckets are unit-tested independently of Convex).

- `reviewHeatmap({ now, days? })` — per-day review counts over the last `days` (default 30). Reads `verseMemoryReviews` through `by_userId_createdAt`, **bounded by the window** via a `gte("createdAt", windowStart)` index range (never an unbounded scan of the whole log). Returns `[{ dayStart, count }]`, oldest first, one entry per day.
- `accuracyTrend({ now, days? })` — per-day **average** `accuracy` over the last `days` (default 30), same bounded `by_userId_createdAt` range. Returns `[{ dayStart, average, count }]`; days with no reviews report `average: null` (not 0) so charts can skip them.
- `reviewForecast({ now, days? })` — count of verses **due per upcoming day** over the next `days` (default 30). Reads `verseMemory` through `by_userId_dueAt`, bounded above by the end of the window; **heart-aware** — un-hearted verses (no `savedVerses` row) are skipped. Day 0 ("Today") counts only verses **actually due now** (`dueAt <= now`) — the same definition used by `memoryStats.due`, `dueQueue`, and the Start review button — so overdue verses fold into Today but a verse scheduled for later today does **not** inflate the Today bar (and, having no matching upcoming calendar bucket, isn't shown). Returns `[{ dayStart, count }]`, today first.
- `masteryDistribution({ now })` — **heart-aware** counts by status (`new`/`learning`/`reviewing`/`mastered`) plus `total`, computed by iterating the user's hearted verses (`savedVerses`) and joining each to its `verseMemory` row. A slimmer sibling of `memoryStats` used by the mastery bar and the "in memory" KPI. (`now` is accepted for signature consistency with the other dashboard queries but is not needed to compute a pure status tally.)

`days` is clamped server-side to `1..366`. **Timezone simplification:** all bucketing uses **UTC days** (a day boundary is midnight UTC, not the viewer's local midnight). This keeps the queries deterministic/cacheable; it's an accepted v1 tradeoff for a coarse growth dashboard and is documented at the top of `src/lib/dashboard-buckets.ts`.

### Convex API (`convex/studySessions.ts`)

- `create({ scope, name? })` — creates a session for the current user.
- `listMine({ paginationOpts })` — paginated via Convex `paginationOptsValidator`. Returns `{ page, isDone, continueCursor, ... }` where each page entry carries live counts: `savedVersesCount`, `notesCount`, and `teachPassagesCount` (distinct verse-linked passages implied by the notes). Ordered by `lastOpenedAt` desc. Backs the hub list via `usePaginatedQuery`.
- `get({ id })` — returns `null` for "not found / not yours", the session otherwise. The client uses the `undefined` vs `null` distinction to separate loading from a missing session.
- `resolveScope({ id })` — fully resolves the session's scope into the lists of `savedVerses` and `notes` needed to build activity cards. Returns `null` for not-found.
- `previewCounts({ scope })` — same shape as the list counts, but for an unsaved scope. Powers the live counter in the scope builder.
- `touch({ id, lastView? })` — bumps `lastOpenedAt` and optionally records which view the user is on.
- `remove({ id })` — deletes a session (user-scoped). Confirmation is enforced in the hub UI.

All queries are safe to call unauthenticated and return `null` / `[]`.

## Memory mode (`/memory`)

The verse-memory experience — the progress dashboard (with its Review hero), the library and per-verse drill-down, and the due-queue Review player + summary — lives in its own **Memory** workspace at `/memory`, separate from Study. Study (`/study`) is now just the saved-session list.

- **Route + page** follow the standard file-route + thin page pattern: `src/routes/memory/index.tsx` → `MemoryHomePage` (`src/components/routes/memory-home-page.tsx`) → `<MemoryHome/>` (`src/components/memory/memory-home.tsx`).
- **`MemoryHome`** composes the dashboard + library and owns the `isReviewing` toggle: Review is an **in-page surface** (state), not a route, mirroring the old `study-hub` Today-queue toggle. It reuses `useLiveNow()` for the `now` query arg.
- **Review is one verb.** The single **Review** action (formerly "Start review" / "Today's review") plays the heart-filtered `dueQueue({ now })` through the learn ladder / deck. Suspend was removed in an earlier PR.
- **Shared primitives stay in `src/components/study/`** and are imported across: `study-verse-learn.tsx`, `study-activity-deck.tsx`, `study-verse-memory-card.tsx`, `use-record-verse-attempt.ts`, `study-card-model.ts`, and `verse-memory-feedback.tsx`. Memory-only surfaces moved into `src/components/memory/` (`dashboard/*`, `memory-library.tsx`, `verse-detail.tsx`, `review-player.tsx`, `review-summary.tsx`).

### Progress dashboard (`/memory`)

Memory home leads with a **progress dashboard** (`MemoryDashboard`, `src/components/memory/dashboard/dashboard.tsx`) that **decouples reviews from sessions** and makes growth visible. Instead of picking a saved collection to drill, the learner reviews the single global due queue across _every_ hearted verse; the dashboard then visualizes their practice history and upcoming load, and the library sits below.

The dashboard is built from **inline SVG/CSS only** — there is **no charting library dependency**. All chart color comes from the theme's `--chart-1..5` tokens (referenced via `var(--chart-N)` / `color-mix(...)`, since the tokens are OKLCH values, not HSL), so every chart tracks light/dark theme automatically. Shared path/scale helpers live in `src/components/memory/dashboard/svg-chart-helpers.ts`.

- **Review hero** — the **"N due today"** headline + a single **Review** button (disabled when nothing is due) at the top of the dashboard.
- **KPI row** (`kpi-row.tsx`) — four headline numbers: **due today** (`memoryStats.due`), **day streak**, **in memory** (`learning + reviewing + mastered` from `masteryDistribution`), and **30d accuracy** (overall mean accuracy across `accuracyTrend`, or `—` when there are no reviews). **Streak = consecutive days ending today with ≥ 1 review**, computed client-side from the heatmap counts via `computeStreak` (so it drops to 0 once a UTC day passes with no review).
- **Practice heatmap** (`practice-heatmap.tsx`) — a GitHub-style 12-week grid (weekday rows, week columns) of daily review counts, cell intensity via `color-mix` on `--chart-1`.
- **Mastery bar** (`mastery-bar.tsx`) — a horizontal stacked bar of verses by lifecycle status with a legend.
- **Accuracy trend** (`accuracy-trend.tsx`) — a line/area chart of daily average accuracy over 30 days (days with no reviews are skipped, not drawn as 0).
- **Review forecast** (`review-forecast.tsx`) — rounded bars of verses due per day over the next 14 days. The "Today" bar (tinted with a distinct token) counts only verses actually due now (`dueAt <= now`), matching the hero's "due today"; overdue folds in, later-today does not.
- **Accessibility & empty states** — every chart is a `role="img"` with a descriptive `aria-label` summarizing its data, and each renders a graceful empty/zero state ("No reviews yet", "Nothing scheduled", etc.) rather than an empty axis.
- `now` comes from the shared `useLiveNow()` hook (`src/hooks/use-live-now.ts`) that refreshes on a coarse ~60s interval and is passed as a query arg, so the numbers stay live as verses fall due — Convex still never calls `Date.now()` itself.
- **The player** (`ReviewPlayer`, `src/components/memory/review-player.tsx`) is an **orchestrator** that reuses the existing deck + learn UIs unchanged:
  - It reads `dueQueue({ now })` and **snapshots** the result on entry so cards don't vanish mid-run as attempts reschedule verses out of the live due set.
  - It maps each due row (a `verseMemory` row joined to its `verseRefs`) into the **verse-memory card model** the deck/learn consume — `{ type: "verse-memory", id: "vm:<memoryId>", reference: { book, chapter, startVerse, endVerse } }`.
  - **New/learning** verses play one at a time through the **learn ladder** (`StudyVerseLearn`), with an orchestrator-owned "Next verse" control to advance. **Reviewing/mastered** verses play through the **deck** (`StudyActivityDeck`) for hidden recall.
  - Because both sub-components record every graded attempt via `useRecordVerseAttempt` → `recordAttempt`, **each completed card reschedules the verse**; a just-reviewed verse's `dueAt` moves into the future and it **leaves the live due queue** (verifiable via the reactive `dueQueue`). The orchestrator watches the live queue to know when the review phase is finished.
- **Review summary** (`ReviewSummary`, `src/components/memory/review-summary.tsx`) ends the run: **verses reviewed**, **cleared** (left today's queue), and **stage-ups** (advanced a learn stage) are derived client-side by diffing the entry snapshot against the live due set, while **remaining** (the caught-up/streak status and whether "Keep reviewing" is offered) reads the uncapped `memoryStats.due` — not the capped `dueQueue` length — so it stays accurate when more than 50 verses are due. "Keep reviewing" re-runs against the next batch of still-due verses. No new Convex functions were added.
- **Empty / caught-up state** is handled both on the Memory dashboard ("All caught up") and inside the player.

### Hub (`/study`)

- Lists sessions sorted by `lastOpenedAt` desc, fetched in pages via `usePaginatedQuery` with a **Load more** button when more pages exist. Sessions remain saved collections; the dashboard, library, and Review now live in Memory (`/memory`).
- Each card shows title (name or auto-generated scope summary), scope-aware stats (hearted verses · notes · passages · last studied), any tag filters, and a "Last: {activity}" chip when the previous view was an activity (not Overview).
- Delete button opens a confirmation dialog (`DeleteStudySessionDialog`).
- Empty state has a CTA to `/study/new`.

### Library, drill-down & heart rings (`/memory`)

Below the dashboard, Memory home renders a **Library** section (`MemoryLibrary`, `src/components/memory/memory-library.tsx`) that makes the collection tangible — every hearted verse with its memory state and next-due date.

- **List** — paginated via `usePaginatedQuery(api.verseMemory.listLibrary, { sort }, …)` with a **Load more** button, styled to match the Sessions section. Each row shows the reference, a status dot + label, and a relative next-due label ("Due now" / "Tomorrow" / "In N days").
- **Sort** — three modes (`Due` / `Status` / `Recent`) map to `listLibrary`'s `sort` arg. Changing the sort re-keys the paginated query, resetting to the first page.
- **Search** — a client-side filter over the **loaded** pages' reference labels only (it does not fetch unloaded pages). This is a documented v1 limitation (see below).
- **Empty state** — "No hearted verses yet…" when the user has none; a separate "no matches" message when a search filters everything out.
- **Drill-down** — clicking a row opens a dialog with `VerseDetail` (`src/components/memory/verse-detail.tsx`), driven by `verseMemory.verseDetail`: the schedule (interval / ease / lapses), a **stage journey** (full → first-letters → cloze → hidden, current rung highlighted), a **recent-accuracy sparkline** (reusing `linePath`/`scaleLinear` from `dashboard/svg-chart-helpers.ts`, attempts reversed to a left-to-right time axis), the derived **difficulty** signal, and a **next-due** line. Every chart/SVG carries a descriptive `aria-label`.

#### Heart mastery ring (reader)

The reader's heart (`PassageHeartAnimatedButton` in `src/components/passage/verse-row.tsx`) is decorated with a **subtle mastery ring** — no new element, just a progress arc around the existing heart. It only renders when the verse is hearted and its ring fraction is > 0, is `position: absolute` + `pointer-events-none` (so it **never shifts layout**), inherits the heart's `currentColor`, and is fully static (no animation), so it's reduced-motion friendly by construction.

The ring fraction is a pure function of the verse's memory state (`masteryRingFraction`, `src/lib/mastery-ring.ts`, unit-tested):

| Status      | Ring                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `new`       | 0 — no ring ("saved, not yet started")                                                          |
| `learning`  | 0.25 (a quarter)                                                                                |
| `reviewing` | 0.5 → 0.9, scaled linearly by `intervalDays` from just-graduated up to `MASTERED_INTERVAL_DAYS` |
| `mastered`  | 1 (full)                                                                                        |

**Avoiding N+1 for the rings.** The reader does not add a per-verse query. `savedVerses.listForChapter` — the single query the reader already runs per chapter — now joins each saved verse's memory row into an optional `memory` field. `PassageViewBody` reads that back through `savedSpans` and computes the ring fraction with `masteryRingFraction` for the exact `(startVerse, endVerse)` span backing each heart control, passing it as `PassageHeartControl.masteryFraction`.

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

**`learnStage` has one source of truth: the server.** The scheduler (`scheduleNext`) owns rung progression — an `exact` attempt advances the rung, `close` holds it, `off` drops it — driven by `classifyVerseAttempt`, _not_ by a client-side accuracy threshold. The learn ladder adopts the server rung on open (restore, via `getOrCreateForVerse`, retried a bounded number of times on transient failure) and after the learner leaves the review state. The check step is a two-phase flow: input shows the current rung, scaffold, and textarea; review hides the scaffold and textarea while showing the diff, recall percentage, and full text; then `Continue` / `Try again` clears the input and applies the returned rung for the next attempt. There are no manual stage controls — a read-only Full / Letters / Blanks / Hidden indicator shows where the learner is without letting preview clicks override performance-driven progression.

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

## Packs

A **pack** is a per-user, named verse set — a lightweight collection you can drill as a unit. There are two kinds, and the distinction is where the membership lives:

- **Scope packs** store a `scope` (the **exact same shape** as `studySessions.scope`) and resolve their members **live** from `savedVerses` ∩ scope every read. They never store membership rows, so hearting or un-hearting a verse in-scope automatically adds/removes it from the pack.
- **Custom packs** store **explicit, ordered** membership rows in `packVerses`. Membership is independent of the live heart set (it survives un-hearting), and can be reordered.

Both kinds share one invariant: **pack members are hearted.** Adding a verse to a pack hearts it (inserts a `savedVerses` row if absent) and seeds its `verseMemory` row, so every member participates in spaced repetition. Members always join to their live `verseMemory` schedule.

### Scope matching (`src/lib/verse-scope-match.ts`)

The book/chapter-range matching that decides whether a verse falls inside a scope is a single pure, unit-tested function, `verseMatchesScope(ref, scope)`, extracted from `studySessions.resolveScope` so sessions and packs share one source of truth:

- An empty `books` list matches **every** verse (the "whole corpus" scope).
- Otherwise the verse's `book` must be listed, **and** — when a `chapterRanges` entry exists for that book — its `chapter` must fall within `[startChapter, endChapter]`. A book listed **without** a range matches all of its chapters.
- `tags` / `tagMatchMode` are deliberately **out of scope** for this helper: they filter NOTES, not verses. `studySessions.resolveScope` still applies tag filtering separately when collecting notes; its verse matching now delegates to `verseMatchesScope` (behavior unchanged).

### Packs data model

Two new per-user Convex tables:

| Table        | Purpose                                                                                                                                                                                                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packs`      | One row per pack: `userId`, `name`, `kind` (`"scope"` \| `"custom"`), optional `scope` (present iff `kind === "scope"`, identical shape to `studySessions.scope`), `createdAt`, `lastOpenedAt`. Indexed `by_userId_lastOpenedAt` (hub list order).                                                                                                 |
| `packVerses` | Custom-pack membership (ordered): `userId`, `packId`, `verseRefId`, `order`, `createdAt`. Indexed `by_userId_packId_order` (ordered read + append), `by_packId` (cascade delete), and `by_userId_packId_verseRefId` (membership lookup / dedupe). Scope packs store **no** rows here — their members are resolved live from `savedVerses` ∩ scope. |

### Packs Convex API (`convex/packs.ts`)

All functions validate `args` + `returns`, check auth via `getCurrentUser*`, verify per-row ownership, and query through `.withIndex(...)` (never `.filter`). Queries take `now` as an argument (never `Date.now()` in a query); mutations may use `Date.now()`. Query/mutation wrappers stay thin — shared logic lives in `convex/lib/packs.ts` (`loadOwnedPack`, `loadHeartedMembers`, `filterScopeMembers`, `loadCustomMembers`, `nextPackOrder`). Queries are safe to call unauthenticated and return `[]` / `0` / `null`.

- `create({ name, kind, scope? })` — creates a pack. Scope packs require a `scope`; custom packs must omit it (both enforced). Returns the new `Id<"packs">`.
- `listMine({ paginationOpts, now })` — **paginated** (`paginationOptsValidator` + `.paginate()` on `by_userId_lastOpenedAt`, newest-opened first). Each page entry carries live `verseCount` + `dueCount` (`dueAt <= now`). The user's hearted set is loaded **once per page** and reused across every scope pack (bounded by the hearted set); custom packs read their own membership rows (bounded by pack size).
- `get({ id })` — returns the pack (incl. `scope` for scope packs) or `null` for not-found / not-yours.
- `rename({ id, name })` — renames a pack the user owns.
- `remove({ id })` — deletes the pack **and its `packVerses` rows** (via `by_packId`). **Never** deletes `savedVerses` hearts or `verseMemory` progress.
- `touch({ id })` — bumps `lastOpenedAt` (drives hub ordering).
- `addVerse({ id, book, chapter, startVerse, endVerse })` — validates bounds, find/creates the `verseRef`, **hearts** it (inserts `savedVerses` if absent) and seeds `verseMemory` (idempotent). For **custom** packs it also appends a `packVerses` row (idempotent via `by_userId_packId_verseRefId`, `order` from `nextPackOrder`); **scope** packs need no membership row.
- `removeVerse({ id, verseRefId })` — **custom only**; deletes the membership row. Does **not** un-heart the verse (it stays in Memory).
- `reorder({ id, orderedVerseRefIds })` — **custom only**; rewrites each membership row's `order` to its index in the supplied list.
- `resolveMembers({ id, now })` — the pack's members joined to their live `verseMemory` schedule (`status`, `learnStage`, `intervalDays`, `dueAt`) plus an `isDue` flag (`dueAt <= now`). **Scope** packs resolve from `savedVerses` ∩ scope in canonical Bible order; **custom** packs read `packVerses` in explicit `order`. Both join to `verseMemory`; rows whose memory seed is missing (legacy) are skipped rather than fabricated.
- `previewScopeCount({ scope, now })` — a live `{ verseCount, dueCount }` for a (possibly unsaved) scope, computed from `savedVerses` ∩ scope. Powers the scope-pack creation counter.

## Known limitations (v1)

- **`listMine` performance.** Pagination bounds the number of session rows per response, but counts still require reading all of the user's `savedVerses` + `noteVerseLinks` plus `ctx.db.get`s for every unique `verseRefId` and `noteId` referenced by those links — these are O(user corpus) each call. Likely future improvements, in order of preference:
  1. Denormalize counts onto the `studySessions` row and recompute in a scheduled mutation on relevant writes.
  2. Render the hub without counts and resolve them lazily per visible card.
- **Dashboard bucketing is UTC-day based.** The progress dashboard (heatmap, accuracy trend, forecast, streak) buckets by UTC day rather than the viewer's local day, so day boundaries and the streak roll over at midnight UTC (see `src/lib/dashboard-buckets.ts`). Per-user local-day bucketing would require threading a UTC offset through the aggregate queries.
- **No session editing.** You can delete a session but can't rename it, change its scope, or clone it after creation.
- **No in-deck navigation back to `/passage/...`.** Cards show references but don't deep-link into the reader mid-activity.
- **Counts recompute on every scope edit.** `previewCounts` is a full query; it's fine but noticeably chatty on slow connections.
- **Library search is client-side over loaded pages.** The Library's filter box matches only the reference labels already fetched (the current + any "Load more" pages), not the full corpus. A server-side reference search would need a searchable index on `verseRefs`.
- **Library "Status" sort is index order, not lifecycle order.** Sorting by status reads through `by_userId_status`, whose ordering is alphabetical (`learning`, `mastered`, `new`, `reviewing`), not the memorization lifecycle. It groups verses by status but doesn't order those groups new → mastered.
- **`verseDetail` attempts use a bounded scan.** `verseMemoryReviews` is only indexed `by_userId_createdAt`, so the drill-down gathers a verse's attempts by walking the log newest-first until it has 20 matches or scans 500 rows. On a very active user the oldest attempts for a rarely-reviewed verse can fall outside the scan window. A `by_userId_verseRefId_createdAt` index would make this exact.
- **No persisted per-token diffs.** Because only `quality` + `accuracy` are stored per attempt, the drill-down surfaces a derived difficulty signal (average/worst accuracy, hardest stage) rather than a literal "hardest phrase".

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

- Data / server: `convex/schema.ts` (`studySessions`, `verseMemory`, `verseMemoryReviews`, `packs`, `packVerses`), `convex/studySessions.ts`, `convex/verseMemory.ts`, `convex/lib/verseMemory.ts`, `convex/migrations.ts`.
- Packs: `convex/packs.ts` + `convex/lib/packs.ts`; pure scope matching in `src/lib/verse-scope-match.ts` (`verseMatchesScope`, unit-tested), shared with `convex/studySessions.ts`.
- Scheduler: `src/lib/memory-scheduler.ts` (pure, framework-free).
- Routes: `src/routes/study/index.tsx`, `src/routes/study/new.tsx`, `src/routes/study/$sessionId.tsx`, `src/routes/memory/index.tsx`.
- Mode Dock: `src/components/layout/mode-dock.tsx`, mounted in `src/components/layout/app-shell.tsx`; preference control in `src/components/settings/mode-dock-section.tsx`; Convex get/set in `convex/userSettings.ts` (`modeDock` field in `convex/schema.ts`).
- Feature components: `src/components/study/*.tsx` (Study), `src/components/memory/*.tsx` (Memory).
- Memory home: `src/components/memory/memory-home.tsx`, rendered via `src/components/routes/memory-home-page.tsx`.
- Card model + deck (shared, in `study/`): `src/components/study/study-card-model.ts`, `study-activity-deck.tsx`.
- Review player: `src/components/memory/review-player.tsx` (orchestrator), `review-summary.tsx` (end-of-run card).
- Progress dashboard: `src/components/memory/dashboard/*` (`dashboard.tsx`, `kpi-row.tsx`, `practice-heatmap.tsx`, `mastery-bar.tsx`, `accuracy-trend.tsx`, `review-forecast.tsx`, `svg-chart-helpers.ts`), rendered at the top of `memory-home.tsx`; pure buckets + tests in `src/lib/dashboard-buckets.ts`.
- Library + drill-down: `src/components/memory/memory-library.tsx` and `src/components/memory/verse-detail.tsx` (rendered from `memory-home.tsx`), backed by `verseMemory.listLibrary` / `verseMemory.verseDetail`.
- Heart mastery ring: pure mapping + tests in `src/lib/mastery-ring.ts` (`masteryRingFraction`), rendered in `src/components/passage/verse-row.tsx` and wired via `src/components/passage/passage-view-body.tsx`; memory status joined by `convex/savedVerses.ts` (`listForChapter`).
- Attempt persistence bridge: `src/components/study/use-record-verse-attempt.ts` (used by `study-verse-learn.tsx` and `study-verse-memory-card.tsx`).
- Scope summary helper: `src/components/study/study-scope-summary.ts`.

---

_When adding features, prefer updating this doc if the scope/activity model, the data model, or naming changes, so future sessions stay aligned._
