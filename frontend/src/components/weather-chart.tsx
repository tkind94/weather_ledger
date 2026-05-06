import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { WeatherObservation } from "@/lib/weather";
import { palette } from "@/lib/theme";
import { monoText, splitLine, tooltipBase } from "@/lib/echarts-theme";
import { Frame, Mono } from "@/components/dashboard/primitives";
import {
  convertPrecip,
  convertTemp,
  precipUnitLabel,
  tempUnitLabel,
  type Units,
} from "@/components/dashboard/format";

interface WeatherChartProps {
  observations: WeatherObservation[];
  units: Units;
}

function pickXAxisInterval(n: number): number {
  if (n <= 7) return 0;
  if (n <= 30) return 3;
  if (n <= 90) return 7;
  return 14;
}

export function WeatherChart({ observations, units }: WeatherChartProps) {
  const option = useMemo(() => {
    const dates = observations.map((o) => o.weatherDate);
    const maxTemps = observations.map((o) =>
      convertTemp(o.maxTemperature, units),
    );
    const minTemps = observations.map((o) =>
      convertTemp(o.minTemperature, units),
    );
    const precips = observations.map((o) =>
      convertPrecip(o.precipitation, units),
    );

    const tempUnit = tempUnitLabel(units);
    const precipUnit = precipUnitLabel(units);
    const interval = pickXAxisInterval(dates.length);
    const showYear = dates.length > 90;

    return {
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        formatter: (
          params: Array<{
            seriesName: string;
            value: number;
            axisValue: string;
            color: string;
          }>,
        ) => {
          if (!params.length) return "";
          const date = params[0]!.axisValue;
          const lines = params
            .map((p) => {
              const unit =
                p.seriesName === "Precipitation" ? ` ${precipUnit}` : tempUnit;
              const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
              return `<div>${dot}${p.seriesName}: ${p.value.toFixed(1)}${unit}</div>`;
            })
            .join("");
          return `<div style="font-weight:600;margin-bottom:4px">${date}</div>${lines}`;
        },
      },
      legend: { bottom: 0, textStyle: { ...monoText, fontSize: 10 } },
      grid: { top: 20, right: 60, bottom: 40, left: 50 },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: {
          ...monoText,
          interval,
          formatter: (val: string) => {
            const d = new Date(`${val}T00:00:00Z`);
            const m = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            return showYear ? `${m}/${d.getUTCFullYear() % 100}` : m;
          },
        },
        axisLine: { lineStyle: { color: palette.faint } },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: tempUnit,
          nameTextStyle: { ...monoText, fontSize: 9 },
          axisLabel: monoText,
          axisLine: { show: false },
          splitLine,
        },
        {
          type: "value",
          name: precipUnit,
          nameTextStyle: { ...monoText, fontSize: 9 },
          axisLabel: monoText,
          axisLine: { show: false },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "High",
          type: "line",
          data: maxTemps,
          smooth: true,
          yAxisIndex: 0,
          lineStyle: { width: 2, color: palette.hot },
          itemStyle: { color: palette.hot },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${palette.hot}33` },
                { offset: 1, color: `${palette.hot}00` },
              ],
            },
          },
          symbol: "none",
        },
        {
          name: "Low",
          type: "line",
          data: minTemps,
          smooth: true,
          yAxisIndex: 0,
          lineStyle: { width: 2, color: palette.cold },
          itemStyle: { color: palette.cold },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${palette.cold}26` },
                { offset: 1, color: `${palette.cold}00` },
              ],
            },
          },
          symbol: "none",
        },
        {
          name: "Precipitation",
          type: "bar",
          data: precips,
          yAxisIndex: 1,
          itemStyle: { color: palette.sage, opacity: 0.6 },
          barMaxWidth: 6,
        },
      ],
    };
  }, [observations, units]);

  return (
    <Frame label="§03 Trends · temperature & precipitation">
      <div className="px-[18px] py-3">
        {observations.length < 2 ? (
          <div className="flex h-[300px] items-center justify-center">
            <Mono className="text-[11px] text-ink-soft">No data available</Mono>
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: 320, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        )}
      </div>
    </Frame>
  );
}
