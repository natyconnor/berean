import { chartColor } from "./svg-chart-helpers";

export interface MasteryDistribution {
  new: number;
  learning: number;
  reviewing: number;
  mastered: number;
  suspended: number;
  total: number;
}

interface Segment {
  key: keyof Omit<MasteryDistribution, "total">;
  label: string;
  color: string;
}

// Order matters: left-to-right reflects the memorization lifecycle.
const SEGMENTS: Segment[] = [
  { key: "new", label: "New", color: chartColor(3) },
  { key: "learning", label: "Learning", color: chartColor(4) },
  { key: "reviewing", label: "Reviewing", color: chartColor(1) },
  { key: "mastered", label: "Mastered", color: chartColor(2) },
  { key: "suspended", label: "Suspended", color: "var(--muted-foreground)" },
];

/** Horizontal stacked bar of verses by lifecycle status. */
export function MasteryBar({ data }: { data: MasteryDistribution }) {
  const total = data.total;
  const visible = SEGMENTS.filter((s) => data[s.key] > 0);

  const summary =
    total === 0
      ? "No verses yet."
      : visible
          .map((s) => `${data[s.key]} ${s.label.toLowerCase()}`)
          .join(", ");

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Mastery</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} {total === 1 ? "verse" : "verses"}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No verses yet. Heart a verse to start memorizing.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Mastery distribution: ${summary}.`}
            className="mt-3 flex h-4 w-full overflow-hidden rounded-full"
          >
            {visible.map((s) => (
              <div
                key={s.key}
                className="h-full"
                style={{
                  width: `${(data[s.key] / total) * 100}%`,
                  backgroundColor: s.color,
                }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {SEGMENTS.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-medium tabular-nums text-foreground">
                  {data[s.key]}
                </span>
                {s.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
