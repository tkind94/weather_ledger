import { palette } from "@/lib/theme";

export type Units = "metric" | "imperial";
export type Range = "7d" | "30d" | "1y" | "all";

export const RANGE_DAYS: Record<Range, number | null> = {
  "7d": 7,
  "30d": 30,
  "1y": 365,
  all: null,
};

export function fmtTemp(c: number, units: Units): string {
  return units === "imperial"
    ? `${((c * 9) / 5 + 32).toFixed(0)}°F`
    : `${c.toFixed(0)}°C`;
}

// Temperature *difference*, not absolute. Skip the 32° offset.
export function fmtTempDelta(c: number, units: Units): string {
  return units === "imperial"
    ? `${((c * 9) / 5).toFixed(0)}°F`
    : `${c.toFixed(0)}°C`;
}

export function fmtPrecip(mm: number, units: Units): string {
  return units === "imperial"
    ? `${(mm / 25.4).toFixed(2)}"`
    : `${mm.toFixed(1)}mm`;
}

export function fmtDate(s: string): string {
  return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function fmtDateYear(s: string): string {
  return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Continuous cold→hot ramp for heatmap and histogram cells.
export function tempColor(t: number, tMin: number, tMax: number): string {
  const norm =
    tMax === tMin ? 0.5 : Math.max(0, Math.min(1, (t - tMin) / (tMax - tMin)));
  const r = Math.round(63 + 113 * norm);
  const g = Math.round(107 - 21 * norm);
  const b = Math.round(107 - 49 * norm);
  return `rgb(${r},${g},${b})`;
}

export { palette };
