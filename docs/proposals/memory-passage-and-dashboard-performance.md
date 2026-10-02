# Memory performance: passages + dashboard (post-1.17.4)

**Status:** investigation + plan. Do not implement original recall-save items 3–5 next.
**Grounded in:** `main` at 1.17.4 (`37e68ea`), after [#241](https://github.com/natyconnor/berean/issues/241) (`d3432f7`).

## Verdict

The remaining 3–5 optimizations from the recall-save investigation are **not** the right next fix for:

- Saving… still somewhat slow when a user has a large hearted library **and** is learning several passages (all presets + the 100-verses pack).
- Dashboard **Upcoming**, **Mastery**, and **Practice** taking a while to load.

Those items targeted **live unified verse packs** (guard denorm, persist scope members) and a **full `dueCount` denorm**. After a pack is started as a passage, `unifiedReviewEnabled` is cleared, so the unified-verse work is skipped. The remaining cost is **fat `passageMemory` collects**, **`dueCount` still live on every screen**, **Mastery blocked on the due half of `memoryStats`**, and **Practice reading up to 5,000 review-log rows**. Original 3–5 never touch the heatmap.

Recommended next work is a different ordered set below. Original 3–5 stay on the shelf unless unified **verse** recitation (flag on, no `passageMemory` row) still shows up in traces after this plan ships.

---

## What already shipped (1.17.4 / #241)

Convex `await mutation()` does not resolve until every **subscribed** query that read a written document has re-run. Session pages were keeping full-library queries live, so Saving… scaled with heart count.

Shipped:

1. Thread `verseRefId` through `PracticeVerse` / `recordAttempt`. Session fallback is `savedVerses.listRecordingIds` (hearts + refs only). `listAll` still joins `verseMemory` for the library, not for recording.
2. `useFrozenQuery` snapshots the first result then `"skip"`. Learn/Practice freeze `listAll`. Review freezes `dueQueue` / `memoryStats`. Pack sessions freeze `resolveMembers`.

That removed the hearted-library join from the save wait. It did **not** unsubscribe the Mode Dock badge, and it did **not** change dashboard aggregates.

---

## Remaining symptoms vs current hot paths

### Saving… after #241

Session queues are frozen. The Mode Dock still runs `verseMemory.dueCount` on **every** route (`src/components/layout/mode-dock.tsx`). Every grade that patches `verseMemory` or `passageMemory` waits for that query to re-run.

`dueCount` (`convex/verseMemory.ts`) currently:

1. Scans up to `MAX_DUE_SCAN` (500) hearted `verseMemory` rows on `by_userId_isHearted_dueAt`.
2. Calls `loadUnifiedReviewPacks`, which **always** `.collect()`s every pack on `by_userId_lastOpenedAt` **and** every `passageMemory` document (including the `pieces` array), then returns `[]` if no live unified verse pack remains.
3. Calls `loadPassageMemoryByUser` **again** (second full collect of the same fat documents).
4. Walks `pieces` for building passages via `countDuePassageLearning` / `isPassageDueForLearning`.

Convex reads whole documents. There is no field projection, so a “count due passages” query pays for every piece of every passage the user has started. A 100-verse pack as one passage is one document with ~100 scheduled pieces; several presets add more of the same. Patching one passage still invalidates `dueCount` because that query collected **all** passage rows.

`passageMemory.recordAttempt` itself is O(this document): it patches the whole row, including `pieces`. That write is fine. The wait is the dock (and any other live query) re-reading **every other** passage’s pieces.

`dueForLearning` is frozen on the Learn route. Pack `resolveMembers` is frozen on pack sessions. Those are no longer the save bottleneck.

### Dashboard: Upcoming, Mastery, Practice

`MemoryHome` loads `memoryStats` once and passes it into `MemoryDashboard`. The dashboard then loads `reviewActivity` and `reviewForecast` independently (`src/components/memory/dashboard/dashboard.tsx`).

| Chart        | Query                        | Why it is slow for this user                                                                                                                                                                                                                                                                                           |
| ------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mastery**  | `verseMemory.memoryStats`    | Status totals are already O(1) from `userMemoryStats`. The same query still does the due scan + `loadUnifiedReviewPacks` + two passage collects. `MasteryDonut` only needs `{ new, learning, reviewing, mastered, total }`. The donut waits on the due half. Today hero / KPI `dueToday` also wait on that same query. |
| **Upcoming** | `verseMemory.reviewForecast` | Hearted `verseMemory` rows with `dueAt < windowEnd` (capped at 500), **plus** all packs, **plus** all fat `passageMemory`. Reviewing/mastered passages only need `status` + `dueAt`; building rows are skipped after the full document is already in memory.                                                           |
| **Practice** | `verseMemory.reviewActivity` | Up to `MAX_REVIEW_ACTIVITY_ROWS` (5000) `verseMemoryReviews` in a 365-day window. Accuracy trend shares this query. Original 3–5 never touch this table. A user who finished every preset plus the 100-verses pack will have a large review log.                                                                       |

`packs.list` on the same home page also collects all `savedVerses`, all hearted `verseMemory`, and all `passageMemory` to subtitle due counts. That is adjacent weight on `/memory`, not what the named charts subscribe to.

### What this user’s profile actually does

- Lots of hearts → due-index scans (bounded at 500) still run; `listAll` / `loadHeartedMembers` are **not** on the save path anymore.
- Several started passages → `unifiedReviewEnabled` is false on those packs (`convex/passageMemory.ts` start path). `loadHeartedMembers` is skipped unless a **non-passage** unified scope pack still exists.
- `loadUnifiedReviewPacks` still pays the collect-all-packs + collect-all-passages cost **in order to return []**.
- Building-due still requires `pieces` unless a skinny due projection exists.

---

## Why original 3–5 are the wrong next fix

The pre-#241 “remaining 3–5” were roughly:

3. **Schema: unified-review guard denorm** — stamp verse rows so due scans do not join pack membership to hide unified members.
4. **Dock `dueCount` denorm** — persist a badge integer so the dock does not rescan.
5. **Persist unified scope members** — stop resolving scope packs from the full hearted set on every due query.

| Item                             | Helps this user’s symptoms? | Why                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3. Unified guard denorm          | No (or only a sliver)       | Passage start clears the unified flag and excludes packs that have a `passageMemory` row. Due scans already skip `loadHeartedMembers` in that case. Does not shrink fat passage reads, Mastery, or the heatmap.                                                                                                                                                 |
| 4. Full `dueCount` denorm        | Partial, high risk          | The dock **is** the remaining save waiter, but due is time-dependent (`now`, timezone, introduce budget / local day). A stored integer goes stale at midnight and on every schedule write. Denorming it correctly is a scheduler + clock problem, not a small index. Cheaper: stop subscribing during sessions, and make the live query cheap when it does run. |
| 5. Persist unified scope members | No                          | Only paid when a live unified **scope** pack still needs `loadHeartedMembers`. This user is in passage mode.                                                                                                                                                                                                                                                    |

A **slimmed** version of (4) is still in the plan: make due counting cheap, or skip it during sessions. That is not the original “denorm the badge integer” design.

---

## Recommended work (ordered)

Ship in this order. Each step is independently shippable and measurable. Do not batch them.

### 1. Split Mastery (and status KPIs) off the due query

**Why first:** smallest change, dashboard-visible, no schema. Mastery is slow because it shares `memoryStats` with Today’s due counts.

**Do:**

- Add `verseMemory.memoryStatus` (name flexible) that returns only the `userMemoryStats` rollup (`new` / `learning` / `reviewing` / `mastered` / `total`). O(1). Keep the pre-backfill fallback if the rollup row is missing.
- `MemoryHome` / `MasteryDonut` / Practice All enable (`reviewing + mastered > 0`) / preview seed `heartedTotal` subscribe to that query.
- Keep `memoryStats` (or a `memoryDue` sibling) for Today hero + KPI `dueToday` only.

**Files:** `convex/verseMemory.ts` (`memoryStats`, `userMemoryStats`), `src/components/memory/memory-home.tsx`, `src/components/memory/dashboard/dashboard.tsx`, `src/components/memory/dashboard/mastery-donut.tsx`, `src/components/memory/preview-memory-seed-card.tsx`.

**Acceptance:** Mastery donut paints without waiting on `loadUnifiedReviewPacks` or `loadPassageMemoryByUser`. Today hero may still wait on due. Existing `memoryStats` tests keep due semantics (`due` + `learningDue` include passages).

### 2. Skip live `dueCount` on session routes

**Why:** remaining Saving… waiter after #241. No schema.

**Do:**

- Mode Dock: `"skip"` `verseMemory.dueCount` on Learn / Practice / Review / pack session routes (same idea as `useFrozenQuery`, but for a chrome query that must not block `await mutation()`).
- Keep the last loaded badge (the dock already holds `dueCount` in `useState` so a loading gap does not blank the number).
- Resume the live query on `/memory` (and other non-session Memory surfaces) so returning home refreshes the badge.

**Files:** `src/components/layout/mode-dock.tsx`, tests around dock / session routes.

**Acceptance:** Grading a verse or passage on a session route does not wait on `dueCount`. Badge may be stale until the user leaves the session; that is acceptable (Review already snapshots dues). Do not skip on `/memory` home.

**Risk:** Badge stale during a long session. Prefer that over Saving… that scales with every started passage.

### 3. Skinny passage due reads (the real passage-scale fix)

**Why:** after (2), dashboard Today / Upcoming / dock-on-home still collect every `passageMemory` document twice per query. Convex cannot omit `pieces`. `by_userId_status_dueAt` exists on `passageMemory` and is unused.

Building due (`isPassageDueForLearning`) currently needs `pieces`, `addsOnDay`, and `addDayKey`. Review due (`isPassageDueForReview`) only needs `status` + `dueAt`. Forecast for reviewing/mastered only needs `dueAt`.

**Preferred design:** a skinny projection written on every `passageMemory` insert/patch (same mutation, same document id or a 1:1 table). Minimum fields:

- `userId`, `packId`, `passageMemoryId`
- `status`
- `dueAt` (review schedule; already on the fat row)
- `learningDueAt` (denorm of `passageLearningDueAt(pieces, now)` plus enough to apply introduce budget without pieces)
- `addsOnDay`, `addDayKey`
- optionally `hasUnreached` / `hasIntroducedDue` so `isPassageDueForLearning` does not need the piece array

Keep `passageLearningDueAt` / `isPassageDueForLearning` as the pure source of truth; the projection is a cache updated in `patchPassageMemory` / create / delete.

**Also, independently of the table:**

- Stop double-collecting. `loadUnifiedReviewPacks` should not call `loadPassageMemoryByUser` if callers then load it again. Better: load **pack ids that have a passage row** without pieces (the skinny table, or a `hasPassageMemory` flag on `packs` set at start).
- Short-circuit: if there are no packs with `unifiedReviewEnabled === true`, skip pack collect + member joins entirely. Today every due query collects all packs just to filter them.
- Use `by_userId_status_dueAt` (or the skinny equivalent) for reviewing/mastered due and forecast instead of `.collect()` on `by_userId`.

**Files:** `convex/schema.ts`, `convex/lib/packs.ts` (`loadPassageMemoryByUser`, `loadUnifiedReviewPacks`), `convex/lib/passageMemory.ts` (`patchPassageMemory`), `convex/verseMemory.ts` (`dueCount`, `memoryStats`, `dueQueue`, `reviewForecast`), `convex/passageMemory.ts` (`dueForLearning`), `src/lib/passage-due.ts`, `convex/packs.ts` (`list` subtitle due).

**Acceptance:** `dueCount` / `memoryStats` due / `reviewForecast` / `dueForLearning` do not `.collect()` `passageMemory` documents (no `pieces` in those handlers). Session `get` / `recordAttempt` for the **active** pack still load the fat row. A user with many started passages including a 100-verse pack does not pay O(all pieces) on dashboard load or dock refresh.

**Do not** persist unified scope members here.

### 4. Denorm Practice heatmap / accuracy days

**Why:** Practice (and Accuracy trend) are slow for a different reason: `reviewActivity` reads up to 5,000 `verseMemoryReviews`. Passage-due work will not fix this.

**Do:**

- Maintain a per-user per-local-day aggregate (count, accuracy sum, accuracy n) from `verseMemory.recordAttempt` and `passageMemory.recordAttempt` (if passage reviews should appear on the same heatmap — confirm current behavior; today `reviewActivity` is **verse** logs only).
- `reviewActivity` reads ~365 skinny day rows instead of the raw log.
- Keep the 5,000-row scan as a backfill path or drop it once the aggregate is complete.

**Files:** `convex/schema.ts`, `convex/verseMemory.ts` (`recordAttempt`, `reviewActivity`), possibly `convex/passageMemory.ts` if passage grades should count, `src/lib/dashboard-buckets.ts`, dashboard tests.

**Acceptance:** Practice heatmap and 30-day trend do not `.take(5000)` on `verseMemoryReviews` for a heavy user. Streak / KPI accuracy match the current bucketing rules (`normalizeTimeZone`, local midnight).

### 5. Only then: original unified-verse items (optional)

Revisit original 3 and 5 **if** traces still show `loadHeartedMembers` / custom member joins on `dueCount` for users who recite unified **verse** packs without starting passage mode.

- Guard denorm on `verseMemory` (or a boolean already implied by pack membership) so due scans do not need unified member sets.
- Persist custom/scope unified members only for packs that still have `unifiedReviewEnabled` and no `passageMemory` row.

Do not do this in the same change as (3). Passage users will not exercise it.

A full persisted `dueCount` integer is last resort after (2)+(3), and only if the dock-on-home query is still slow. Time-dependence (`dueIndexUntil`, learning soft lock, introduce budget) makes this easy to get wrong.

---

## Shared constraints

- Never `Date.now()` inside Convex queries. Callers pass `now` / `tzOffsetMinutes` / IANA `timeZone` (existing dashboard contract).
- `await mutation()` waits on **subscribed** queries that read written docs. Session pages must not subscribe to library-wide or all-passage collects.
- Convex has no partial document reads. If a query should not pay for `pieces`, it must not `db.get` / `.collect()` `passageMemory`.
- Passage start clears `unifiedReviewEnabled`. Leftover hearts stay in the verse due scan; review of the passage goes through `passageMemory`. Do not mix those sets.
- `userMemoryStats` is already the O(1) status rollup. Do not recount hearts for Mastery.
- `pnpm run agent:check` after each change; `pnpm test` for scheduler / dashboard / dock / passage-due tests.
- Smallest correct change per PR. Do not denorm time-dependent counts “while we’re here.”

---

## Assets (current symbols)

| Area                 | Path / symbol                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Dock badge           | `src/components/layout/mode-dock.tsx` → `api.verseMemory.dueCount`                                                  |
| Freeze helper        | `src/hooks/use-frozen-query.ts`                                                                                     |
| Dashboard wiring     | `src/components/memory/memory-home.tsx`, `src/components/memory/dashboard/dashboard.tsx`                            |
| Mastery UI           | `src/components/memory/dashboard/mastery-donut.tsx` (`MasteryDistribution` — no `due`)                              |
| Due + stats + charts | `convex/verseMemory.ts` — `dueCount`, `dueQueue`, `memoryStats`, `reviewActivity`, `reviewForecast`                 |
| Caps                 | `MAX_DUE_SCAN = 500`, `MAX_REVIEW_ACTIVITY_ROWS = 5000`                                                             |
| Packs + passages     | `convex/lib/packs.ts` — `loadPassageMemoryByUser`, `loadUnifiedReviewPacks`, `loadHeartedMembers`                   |
| Passage writes       | `convex/lib/passageMemory.ts` — `patchPassageMemory`; `convex/passageMemory.ts` — `recordAttempt`, `dueForLearning` |
| Due math             | `src/lib/passage-due.ts` — `isPassageDueForReview`, `isPassageDueForLearning`, `passageLearningDueAt`               |
| Unused index         | `passageMemory.by_userId_status_dueAt` in `convex/schema.ts`                                                        |
| Status rollup        | `userMemoryStats` (`convex/schema.ts`, `convex/lib/verseMemory.ts`)                                                 |
| Pack list on home    | `convex/packs.ts` `list` — also collects all hearts + all passages                                                  |

---

## Measurement

For a user (or preview seed) with: all catalog presets started as passages, the 100-verses pack as a passage, and a large hearted leftover set.

1. **Saving…** on verse Review/Learn/Practice and on passage rope/frontier: mutation round-trip in the network tab / Convex logs. After (2) it should not include `dueCount`. After (3) a dock refresh on `/memory` should not log full `passageMemory` collects.
2. **Dashboard:** time-to-first-paint of Mastery vs Today vs Practice vs Upcoming (they already load independently). After (1) Mastery should resolve with the rollup only. After (3) Upcoming / Today should not pull `pieces`. After (4) Practice should not scan `verseMemoryReviews`.
3. Confirm unified-verse recitation (flag on, no passage row) still hides members from the global due queue — (3) must keep that exclusion using pack ids, not fat rows.

---

## Out of scope

- Making the grade / `recordAttempt` fire-and-forget (Saving… must still mean the mutation settled).
- Changing scheduler behavior, introduce caps, or dashboard chart visuals.
- Rewriting `packs.list` except as a follow-on consumer of the skinny passage due projection (same collect today; not the named charts).
- Implementing original 3–5 in the first pass.
