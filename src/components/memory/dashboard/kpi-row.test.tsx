import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KpiRow, type DashboardKpis } from "./kpi-row";

function kpis(extra: Partial<DashboardKpis>): DashboardKpis {
  return {
    dueToday: 3,
    streak: { days: 0, atRisk: false },
    practicedLastWeek: 0,
    inMemory: 12,
    accuracy30d: 94,
    ...extra,
  };
}

describe("KpiRow streak", () => {
  it("shows practiced days instead of a one-day streak", () => {
    render(
      <KpiRow
        kpis={kpis({
          streak: { days: 1, atRisk: false },
          practicedLastWeek: 4,
        })}
      />,
    );

    expect(
      screen.getByText("Practiced 4 of the last 7 days"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Day one|Keep it going/)).not.toBeInTheDocument();
  });

  it("doesn't nudge when a streak is waiting on today", () => {
    render(
      <KpiRow
        kpis={kpis({ streak: { days: 3, atRisk: true }, practicedLastWeek: 3 })}
      />,
    );

    expect(screen.getByText("3-day streak")).toBeInTheDocument();
    expect(screen.queryByText(/Keep it going/)).not.toBeInTheDocument();
    expect(screen.queryByText("Faithful in little.")).not.toBeInTheDocument();
  });

  it("adds Faithful in little from a week on", () => {
    render(
      <KpiRow
        kpis={kpis({
          streak: { days: 9, atRisk: false },
          practicedLastWeek: 7,
        })}
      />,
    );

    expect(screen.getByText("9-day streak")).toBeInTheDocument();
    expect(screen.getByText("Faithful in little.")).toBeInTheDocument();
  });

  it("says when there's been no practice this week", () => {
    render(<KpiRow kpis={kpis({})} />);
    expect(
      screen.getByText("No practice in the last 7 days"),
    ).toBeInTheDocument();
  });
});
