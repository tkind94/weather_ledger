import type { WeatherObservation } from "@/lib/weather";
import { Frame, Mono } from "./primitives";
import { palette, tempColor } from "./format";

const CELL = 12;
const LABEL_W = 20;
const MONTH_H = 18;
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const MONO_FONT = "'JetBrains Mono', monospace";

type Cell = {
  col: number;
  row: number;
  obs: WeatherObservation | null;
  date: string;
};

function buildCells(calYear: WeatherObservation[]): {
  cells: Cell[];
  months: { col: number; label: string }[];
} {
  const obsMap = new Map(calYear.map((o) => [o.weatherDate, o]));
  const firstDate = new Date(calYear[0]!.weatherDate + "T00:00:00Z");
  const lastDate = new Date(
    calYear[calYear.length - 1]!.weatherDate + "T00:00:00Z",
  );
  const totalDays =
    Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1;
  const startDow = firstDate.getUTCDay();

  const cells: Cell[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(firstDate.getTime() + i * 86400000);
    const date = d.toISOString().slice(0, 10);
    cells.push({
      col: Math.floor((i + startDow) / 7),
      row: (i + startDow) % 7,
      obs: obsMap.get(date) ?? null,
      date,
    });
  }

  const months: { col: number; label: string }[] = [];
  let prevMonth = -1;
  for (const cell of cells) {
    const d = new Date(cell.date + "T00:00:00Z");
    const m = d.getUTCMonth();
    if (m !== prevMonth) {
      months.push({
        col: cell.col,
        label: d.toLocaleDateString("en-US", {
          month: "short",
          timeZone: "UTC",
        }),
      });
      prevMonth = m;
    }
  }
  return { cells, months };
}

export function CalendarSection({
  calYear,
}: {
  calYear: WeatherObservation[];
}) {
  if (calYear.length === 0) return null;

  const tMin = Math.min(...calYear.map((o) => o.maxTemperature));
  const tMax = Math.max(...calYear.map((o) => o.maxTemperature));
  const { cells, months } = buildCells(calYear);
  const numCols = cells.length ? cells[cells.length - 1]!.col + 1 : 0;
  const svgW = LABEL_W + numCols * CELL;
  const svgH = MONTH_H + 7 * CELL;

  return (
    <Frame label="§06 Calendar Heatmap · last 365 days · daily max temperature">
      <div className="overflow-x-auto px-[18px] py-3">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          className="block h-auto"
          aria-label="Calendar heatmap"
        >
          {DOW.map((l, i) => (
            <text
              key={`dow-${i}`}
              x={LABEL_W - 3}
              y={MONTH_H + i * CELL + 9}
              fontSize={7}
              fontFamily={MONO_FONT}
              fill={palette.inkSoft}
              textAnchor="end"
            >
              {i % 2 === 1 ? l : ""}
            </text>
          ))}
          {months.map((m) => (
            <text
              key={`month-${m.label}-${m.col}`}
              x={LABEL_W + m.col * CELL + 1}
              y={MONTH_H - 5}
              fontSize={7}
              fontFamily={MONO_FONT}
              fill={palette.inkSoft}
            >
              {m.label}
            </text>
          ))}
          {cells.map((c) => (
            <rect
              key={c.date}
              x={LABEL_W + c.col * CELL + 1}
              y={MONTH_H + c.row * CELL + 1}
              width={10}
              height={10}
              rx={1}
              fill={
                c.obs
                  ? tempColor(c.obs.maxTemperature, tMin, tMax)
                  : palette.faint
              }
              opacity={c.obs ? 0.85 : 0.2}
            >
              <title>
                {c.date}
                {c.obs
                  ? `: ${c.obs.maxTemperature.toFixed(1)}°C`
                  : " (no data)"}
              </title>
            </rect>
          ))}
        </svg>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Mono className="text-[8px] text-ink-soft">{tMin.toFixed(0)}°C</Mono>
          <svg width={80} height={8}>
            <defs>
              <linearGradient id="tempRamp" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={palette.cold} />
                <stop offset="100%" stopColor={palette.hot} />
              </linearGradient>
            </defs>
            <rect width={80} height={8} rx={2} fill="url(#tempRamp)" />
          </svg>
          <Mono className="text-[8px] text-ink-soft">{tMax.toFixed(0)}°C</Mono>
        </div>
      </div>
    </Frame>
  );
}
