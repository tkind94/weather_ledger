import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { computeYoY } from "@/lib/weather";
import { monoText, tooltipBase } from "@/lib/echarts-theme";
import { Frame } from "./primitives";
import { useObservations, useUnits } from "./context";
import { fmtTemp, palette } from "./format";

export default function YoYSection() {
  const observations = useObservations();
  const units = useUnits();
  const yoy = useMemo(() => computeYoY(observations), [observations]);

  const option = useMemo(() => {
    if (yoy.length === 0) return null;
    const allTemps = yoy.flatMap((e) => [e.avgHigh, e.avgLow]);
    const tMin = Math.min(...allTemps);
    const tMax = Math.max(...allTemps);

    // Two stacked horizontal bars per year:
    //   pad   — runs from tMin up to avgLow (the "leading offset" cold bar)
    //   range — runs from avgLow to avgHigh (the diurnal range hot bar)
    const years = yoy.map((e) => String(e.year));
    const padData = yoy.map((e) => +(e.avgLow - tMin).toFixed(2));
    const rangeData = yoy.map((e) => +(e.avgHigh - e.avgLow).toFixed(2));

    return {
      grid: { top: 8, bottom: 8, left: 44, right: 96 },
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const i = params[0]?.dataIndex ?? 0;
          const e = yoy[i]!;
          return `${e.year} · high ${fmtTemp(e.avgHigh, units)} / low ${fmtTemp(e.avgLow, units)}`;
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: +(tMax - tMin).toFixed(2),
        show: false,
      },
      yAxis: {
        type: "category",
        data: years,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...monoText, fontSize: 10 },
      },
      series: [
        {
          name: "pad",
          type: "bar",
          stack: "yoy",
          data: padData,
          itemStyle: {
            color: palette.cold,
            opacity: 0.45,
            borderRadius: [1, 0, 0, 1],
          },
          silent: true,
          barCategoryGap: "30%",
        },
        {
          name: "range",
          type: "bar",
          stack: "yoy",
          data: rangeData,
          itemStyle: {
            color: palette.hot,
            opacity: 0.7,
            borderRadius: [0, 1, 1, 0],
          },
          label: {
            show: true,
            position: "right",
            ...monoText,
            fontSize: 10,
            formatter: ({ dataIndex }: { dataIndex: number }) => {
              const e = yoy[dataIndex]!;
              return `${fmtTemp(e.avgHigh, units)} / ${fmtTemp(e.avgLow, units)}`;
            },
          },
        },
      ],
    };
  }, [yoy, units]);

  if (!option) return null;
  const height = Math.max(120, yoy.length * 30 + 16);

  return (
    <Frame label="§08 Year-over-Year · this calendar week ±3 days">
      <div className="px-[18px] py-3">
        <ReactECharts
          option={option}
          style={{ height, width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      </div>
    </Frame>
  );
}
