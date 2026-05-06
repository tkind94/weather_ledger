import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import {
  computePrecipHistogram,
  computeTempHistogram,
  type PrecipBucket,
  type TempHistogram,
} from "@/lib/weather";
import { monoText, tooltipBase } from "@/lib/echarts-theme";
import { Caption, Frame } from "./primitives";
import { useObservations, useUnits } from "./context";
import { fmtTemp, palette, tempColor, type Units } from "./format";

function useTempOption(hist: TempHistogram, units: Units) {
  return useMemo(() => {
    const data = hist.counts.map((count, i) => {
      const lo = hist.min + i * hist.binWidth;
      const center = lo + hist.binWidth / 2;
      return {
        value: count,
        itemStyle: {
          color: tempColor(center, hist.min, hist.max),
          opacity: 0.85,
          borderRadius: 1,
        },
        bin: { lo, hi: lo + hist.binWidth, count },
      };
    });
    return {
      grid: { top: 6, bottom: 26, left: 8, right: 8 },
      tooltip: {
        ...tooltipBase,
        trigger: "item",
        formatter: ({ data: d }: { data: (typeof data)[number] }) =>
          `${fmtTemp(d.bin.lo, units)} – ${fmtTemp(d.bin.hi, units)} · ${d.bin.count} days`,
      },
      xAxis: {
        type: "category",
        data: data.map((_, i) => i),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          ...monoText,
          fontSize: 9,
          showMaxLabel: true,
          showMinLabel: true,
          interval: hist.counts.length - 2,
          formatter: (val: string) => {
            const i = Number(val);
            if (i === 0) return fmtTemp(hist.min, units);
            if (i === hist.counts.length - 1) return fmtTemp(hist.max, units);
            return "";
          },
        },
      },
      yAxis: { type: "value", show: false },
      series: [{ type: "bar", data, barCategoryGap: "20%" }],
    };
  }, [hist, units]);
}

function usePrecipOption(buckets: PrecipBucket[]) {
  return useMemo(
    () => ({
      grid: { top: 6, bottom: 36, left: 8, right: 8 },
      tooltip: {
        ...tooltipBase,
        trigger: "item",
        formatter: ({ name, value }: { name: string; value: number }) =>
          `${name} · ${value} days`,
      },
      xAxis: {
        type: "category",
        data: buckets.map((b) => b.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...monoText, fontSize: 9, interval: 0 },
      },
      yAxis: { type: "value", show: false },
      series: [
        {
          type: "bar",
          data: buckets.map((b) => b.count),
          itemStyle: { color: palette.sage, opacity: 0.75, borderRadius: 1 },
          label: {
            show: true,
            position: "top",
            ...monoText,
            color: palette.mute,
            fontSize: 9,
          },
        },
      ],
    }),
    [buckets],
  );
}

export function DistributionsSection() {
  const observations = useObservations();
  const units = useUnits();
  const tempHist = useMemo(
    () => computeTempHistogram(observations),
    [observations],
  );
  const precipHist = useMemo(
    () => computePrecipHistogram(observations, units),
    [observations, units],
  );
  const tempOption = useTempOption(tempHist, units);
  const precipOption = usePrecipOption(precipHist);

  return (
    <Frame label="§09 Distributions · all-time">
      <div className="grid grid-cols-2 border-t border-rule">
        <div className="border-r border-rule px-[18px] py-3">
          <div className="mb-2">
            <Caption tracking="0.12em">
              Daily Max Temperature Distribution
            </Caption>
          </div>
          <ReactECharts
            option={tempOption}
            style={{ height: 120, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </div>
        <div className="px-[18px] py-3">
          <div className="mb-2">
            <Caption tracking="0.12em">
              Daily Precipitation Distribution
            </Caption>
          </div>
          <ReactECharts
            option={precipOption}
            style={{ height: 120, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </div>
      </div>
    </Frame>
  );
}
