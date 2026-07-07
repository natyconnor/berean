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

### Hub (`/study`)

- Lists sessions sorted by `lastOpenedAt` desc, fetched in pages via `usePaginatedQuery` with a **Load more** button when more pages exist.
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

### Toolbar & routing integration

- Study is reachable from the app toolbar (`TabBar`), which highlights when the active route starts with `/study`.
- Three TanStack Router routes under `src/routes/study/` (`index.tsx`, `new.tsx`, `$sessionId.tsx`), each delegating to a thin page component in `src/components/routes/` that renders the real feature component.

## Known limitations (v1)

- **`listMine` performance.** Pagination bounds the number of session rows per response, but counts still require reading all of the user's `savedVerses` + `noteVerseLinks` plus `ctx.db.get`s for every unique `verseRefId` and `noteId` referenced by those links — these are O(user corpus) each call. Likely future improvements, in order of preference:
  1. Denormalize counts onto the `studySessions` row and recompute in a scheduled mutation on relevant writes.
  2. Render the hub without counts and resolve them lazily per visible card.
- **Spaced repetition is server-only so far.** The `verseMemory`/`verseMemoryReviews` tables, scheduler, hearts-as-seed, and the `convex/verseMemory.ts` API exist (see "Verse-memory data model"), but the deck/learn UI does not yet call `recordAttempt`, so due dates and streaks aren't surfaced to the user.
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
- Feature components: `src/components/study/*.tsx`.
- Card model + deck: `src/components/study/study-card-model.ts`, `study-activity-deck.tsx`.
- Scope summary helper: `src/components/study/study-scope-summary.ts`.

---

_When adding features, prefer updating this doc if the scope/activity model, the data model, or naming changes, so future sessions stay aligned._
