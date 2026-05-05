import type { YoYEntry } from "@/lib/weather";
import { Frame } from "./primitives";
import { fmtTemp, palette, type Units } from "./format";

const ROW_H = 22;
const BAR_W = 260;
const LABEL_W = 36;
const MONO_FONT = "'JetBrains Mono', monospace";

export function YoYSection({ yoy, units }: { yoy: YoYEntry[]; units: Units }) {
  if (yoy.length === 0) return null;

  const allTemps = yoy.flatMap((e) => [e.avgHigh, e.avgLow]);
  const tMin = Math.min(...allTemps);
  const tMax = Math.max(...allTemps);
  const span = tMax - tMin || 1;
  const svgW = LABEL_W + BAR_W + 60;
  const svgH = yoy.length * ROW_H + 10;

  return (
    <Frame label="§08 Year-over-Year · this calendar week ±3 days">
      <div className="overflow-x-auto px-[18px] py-3">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          className="block h-auto"
        >
          {yoy.map((e, i) => {
            const loX = ((e.avgLow - tMin) / span) * BAR_W;
            const hiX = ((e.avgHigh - tMin) / span) * BAR_W;
            const y = i * ROW_H;
            const baseline = y + ROW_H * 0.72;
            return (
              <g key={e.year}>
                <text
                  x={LABEL_W - 4}
                  y={baseline}
                  fontSize={9}
                  fontFamily={MONO_FONT}
                  fill={palette.inkSoft}
                  textAnchor="end"
                >
                  {e.year}
                </text>
                <rect
                  x={LABEL_W}
                  y={y + 4}
                  width={loX}
                  height={ROW_H - 8}
                  fill={palette.cold}
                  fillOpacity={0.45}
                  rx={1}
                />
                <rect
                  x={LABEL_W + loX}
                  y={y + 4}
                  width={Math.max(0, hiX - loX)}
                  height={ROW_H - 8}
                  fill={palette.hot}
                  fillOpacity={0.65}
                  rx={1}
                />
                <text
                  x={LABEL_W + hiX + 5}
                  y={baseline}
                  fontSize={9}
                  fontFamily={MONO_FONT}
                  fill={palette.inkSoft}
                >
                  {fmtTemp(e.avgHigh, units)} / {fmtTemp(e.avgLow, units)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Frame>
  );
}
