import type { PrecipBucket, TempHistogram } from "@/lib/weather";
import { Caption, Frame } from "./primitives";
import { fmtTemp, palette, tempColor, type Units } from "./format";

const BAR_H = 60;
const TEMP_W = 8;
const PRECIP_W = 28;
const GAP = 2;
const MONO_FONT = "'JetBrains Mono', monospace";

function TempHistogramSvg({
  hist,
  units,
}: {
  hist: TempHistogram;
  units: Units;
}) {
  const max = Math.max(...hist.counts, 1);
  const svgW = hist.binCount * (TEMP_W + GAP);

  return (
    <svg
      viewBox={`0 0 ${svgW} ${BAR_H + 16}`}
      width="100%"
      className="block h-auto"
    >
      {hist.counts.map((count, i) => {
        const h = (count / max) * BAR_H;
        const center = hist.min + (i + 0.5) * hist.binWidth;
        const lo = hist.min + i * hist.binWidth;
        const hi = hist.min + (i + 1) * hist.binWidth;
        return (
          <rect
            key={i}
            x={i * (TEMP_W + GAP)}
            y={BAR_H - h}
            width={TEMP_W}
            height={h}
            fill={tempColor(center, hist.min, hist.max)}
            fillOpacity={0.8}
            rx={1}
          >
            <title>
              {fmtTemp(lo, units)} – {fmtTemp(hi, units)}: {count} days
            </title>
          </rect>
        );
      })}
      <text
        x={0}
        y={BAR_H + 13}
        fill={palette.inkSoft}
        fontSize={7}
        fontFamily={MONO_FONT}
      >
        {fmtTemp(hist.min, units)}
      </text>
      <text
        x={svgW}
        y={BAR_H + 13}
        fill={palette.inkSoft}
        textAnchor="end"
        fontSize={7}
        fontFamily={MONO_FONT}
      >
        {fmtTemp(hist.max, units)}
      </text>
    </svg>
  );
}

function PrecipHistogramSvg({ buckets }: { buckets: PrecipBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const svgW = buckets.length * (PRECIP_W + GAP);

  return (
    <svg
      viewBox={`0 0 ${svgW} ${BAR_H + 28}`}
      width="100%"
      className="block h-auto"
    >
      {buckets.map((b, i) => {
        const h = (b.count / max) * BAR_H;
        const cx = i * (PRECIP_W + GAP) + PRECIP_W / 2;
        return (
          <g key={b.label}>
            <rect
              x={i * (PRECIP_W + GAP)}
              y={BAR_H - h}
              width={PRECIP_W}
              height={h}
              fill={palette.sage}
              fillOpacity={0.7}
              rx={1}
            >
              <title>
                {b.label}: {b.count} days
              </title>
            </rect>
            <text
              x={cx}
              y={BAR_H + 11}
              fill={palette.inkSoft}
              textAnchor="middle"
              fontSize={7}
              fontFamily={MONO_FONT}
            >
              {b.label}
            </text>
            <text
              x={cx}
              y={BAR_H + 22}
              fill={palette.mute}
              textAnchor="middle"
              fontSize={7}
              fontFamily={MONO_FONT}
            >
              {b.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DistributionsSection({
  tempHist,
  precipHist,
  units,
}: {
  tempHist: TempHistogram;
  precipHist: PrecipBucket[];
  units: Units;
}) {
  return (
    <Frame label="§09 Distributions · all-time">
      <div className="grid grid-cols-2 border-t border-rule">
        <div className="border-r border-rule px-[18px] py-3">
          <div className="mb-2">
            <Caption tracking="0.12em">
              Daily Max Temperature Distribution
            </Caption>
          </div>
          <TempHistogramSvg hist={tempHist} units={units} />
        </div>
        <div className="px-[18px] py-3">
          <div className="mb-2">
            <Caption tracking="0.12em">
              Daily Precipitation Distribution
            </Caption>
          </div>
          <PrecipHistogramSvg buckets={precipHist} />
        </div>
      </div>
    </Frame>
  );
}
