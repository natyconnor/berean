# ESV HTML vs text — manual A/B eval checklist

Use this after PR 4 lands. Goal: decide go/no-go on making HTML the default
fetch path (follow-up plan — not this spike).

**Setup**

1. Run the app in DEV (`pnpm dev`).
2. Open DevLog (interaction overlay).
3. Confirm the **ESV HTML** switch appears next to **Headers** in the chapter
   header. Production builds must not show this control.
4. Preference key: `localStorage` `berean:esvSource` = `"text"` | `"html"`
   (default `"text"`).

On each toggle, expect:

- DevLog row: `reader` / `esv-source-changed` with `{ source }`
- Chapter reload and a subsequent `reader` / `esv-load` for the active source

---

## Formatting — Song of Solomon 1

| # | Step | Pass | Fail |
| --- | --- | --- | --- |
| 1 | Load **Song of Solomon 1** with **ESV HTML** off (text). | Chapter loads; DevLog `esv-load` has `source: "text"`. | Error or no verses. |
| 2 | Turn **Headers** on. Compare editorial section headings. | Editorial headings appear where expected for Song 1. | Missing/extra editorial headings vs known good layout. |
| 3 | Flip **ESV HTML** on. Wait for reload. | DevLog `esv-source-changed` → `html`, then `esv-load` with `source: "html"`. Layout matches text path for verse order and poetry breaks. | Speakers/headings wrong, verses merged/split, or blank. |
| 4 | Turn **Headers** off while on HTML. | Editorial `heading` / mid `variant: "section"` hide. **She / He / Others** (and other speakers) still show as subheadings. | Speakers disappear with Headers off, or editorial headings remain. |
| 5 | Flip back to text; Headers still off. | Speakers still visible; editorial headings stay hidden. Same semantics as HTML. | Headers-off behavior differs by source. |

---

## Formatting — Psalm 119

| # | Step | Pass | Fail |
| --- | --- | --- | --- |
| 6 | Load **Psalm 119** (at least vv. 1–16) on text, then HTML. | Acrostic letters (Aleph, Beth, …) appear as always-visible subheadings on both sources. | Letters missing, duplicated, or treated as Headers-toggle editorial headings. |
| 7 | Headers off on both sources. | Acrostic letters remain; only editorial section headings hide. | Letters hide with Headers off. |

---

## Performance (cold cache)

Clear the session cache for the chapter (or use a hard refresh / new session)
so DevLog `esv-load` rows show `cache: "miss"`. Measure `fetchMs` for the same
query under each source.

| # | Step | Pass | Fail |
| --- | --- | --- | --- |
| 8 | Cold-load the same chapter **5 times** on **text**; record `fetchMs` from DevLog `esv-load` (`cache: "miss"`). | Five miss timings recorded. | Cache hits only / missing timings. |
| 9 | Cold-load the same chapter **5 times** on **html**; record `fetchMs`. | Five miss timings recorded. | Same as above. |
| 10 | Compare p50 (median) HTML vs text. | HTML p50 ≤ ~**1.2×** text **or** HTML p50 ≤ text p50 **+ 100ms**. | HTML clearly slower than both gates. |

Optional: note cache-hit `fetchMs: 0` rows separately; they do not count toward
the cold-cache gate.

---

## Go / no-go

| Decision | Criteria |
| --- | --- |
| **Go** (HTML default follow-up) | Formatting steps 1–7 pass on Song 1 + Psalm 119; perf step 10 passes. |
| **No-go** (keep text default) | Any formatting miss that users would see, or HTML p50 fails the latency gate. |

Record notes / DevLog screenshots here if useful before opening a follow-up
plan.
