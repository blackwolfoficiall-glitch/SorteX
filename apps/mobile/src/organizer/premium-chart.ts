/** Design geometry only. The financial values remain selected by the dashboard contract. */
export const organizerChartBounds = { width: 300, height: 68, floor: 59 } as const;

export function organizerRevenueGeometry(values: readonly number[]) {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const series = values.length === 1 ? [values[0]!, values[0]!] : values;
  const maximum = Math.max(...values);
  const { width, floor } = organizerChartBounds;
  const vertices = series.map((value, index) => [
    2 + ((width - 4) * index) / (series.length - 1),
    floor - (maximum > 0 ? (value / maximum) * 53 : 0),
  ] as const);
  const points = vertices.map(([x, y]) => `${x},${y}`).join(" ");
  return { maximum, points, area: `M2 ${floor} L${vertices.map(([x, y]) => `${x} ${y}`).join(" L")} L${width - 2} ${floor} Z` };
}
