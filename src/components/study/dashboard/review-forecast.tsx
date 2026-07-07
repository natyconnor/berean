import {
  chartColor,
  roundedTopBarPath,
  scaleLinear,
} from "./svg-chart-helpers";

export interface DayCount {
  dayStart: number;
  count: number;
}

const VIEW_H = 96;
const BAR_GAP = 3;
const TOP_PAD = 6;

function shortDay(dayStart: number, index: number): string {
  if (index === 0) return "Today";
  return new Date(dayStart).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
  });
}

/** Upcoming review load: verses due per day over the next `data.length` days. */
export function ReviewForecast({ data }: { data: DayCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);
  const count = data.length;
  const viewW = 300;
  const slot = count > 0 ? viewW / count : viewW;
  const barW = Math.max(1, slot - BAR_GAP);

  const label =
    total === 0
      ? "Review forecast: nothing scheduled in this window."
      : `Review forecast: ${total} reviews due over the next ${count} days.`;

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Upcoming</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          next {count}d
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing scheduled. New reviews appear here as verses come due.
        </p>
      ) : (
        <>
          <svg
            role="img"
            aria-label={label}
            viewBox={`0 0 ${viewW} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="mt-3 h-24 w-full"
          >
            {data.map((d, i) => {
              const x = i * slot + BAR_GAP / 2;
              const barH =
                d.count <= 0
                  ? 0
                  : scaleLinear(d.count, 0, max, 0, VIEW_H - TOP_PAD);
              const y = VIEW_H - barH;
              return (
                <path
                  key={d.dayStart}
                  d={roundedTopBarPath(x, y, barW, barH, 2)}
                  fill={i === 0 ? chartColor(4) : chartColor(1)}
                />
              );
            })}
          </svg>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{shortDay(data[0].dayStart, 0)}</span>
            {count > 1 && (
              <span>{shortDay(data[count - 1].dayStart, count - 1)}</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
