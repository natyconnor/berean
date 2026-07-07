/**
 * Framework-free SVG helpers shared by the Study dashboard charts.
 *
 * These build path strings and scale numbers into pixel space. All chart color
 * comes from the theme's `--chart-1..5` tokens (see `src/index.css`); reference
 * them with {@link chartColor} so light/dark theming works automatically.
 */

/** A theme chart color token, e.g. `var(--chart-2)`. `n` is clamped to 1..5. */
export function chartColor(n: number): string {
  const index = Math.min(5, Math.max(1, Math.round(n)));
  return `var(--chart-${index})`;
}

/** Linearly map `value` from `[dMin, dMax]` onto `[rMin, rMax]`. */
export function scaleLinear(
  value: number,
  dMin: number,
  dMax: number,
  rMin: number,
  rMax: number,
): number {
  if (dMax === dMin) return rMin;
  const t = (value - dMin) / (dMax - dMin);
  return rMin + t * (rMax - rMin);
}

/**
 * SVG path for a bar with rounded top corners. Bottoms stay square so bars sit
 * flush on the axis. Radius is clamped so it never exceeds half the width or
 * the full height.
 */
export function roundedTopBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  if (height <= 0 || width <= 0) return "";
  const r = Math.max(0, Math.min(radius, width / 2, height));
  const right = x + width;
  const bottom = y + height;
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${right - r} ${y}`,
    `Q ${right} ${y} ${right} ${y + r}`,
    `L ${right} ${bottom}`,
    "Z",
  ].join(" ");
}

/** Build a polyline `d` attribute from pixel-space points. */
export function linePath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/**
 * Build a filled-area `d` attribute for a line chart: the line across the top,
 * then down to and along a baseline. `baselineY` is the pixel y of the axis.
 */
export function areaPath(
  points: readonly { x: number; y: number }[],
  baselineY: number,
): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const top = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  return `${top} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}
