import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { WeatherObservation } from "@/lib/weather";
import { monoText, tooltipBase } from "@/lib/echarts-theme";
import { Frame, Mono } from "./primitives";
import { palette } from "./format";

export function CalendarSection({
  calYear,
}: {
  calYear: WeatherObservation[];
}) {
  const option = useMemo(() => {
    if (calYear.length === 0) return null;
    const tMin = Math.min(...calYear.map((o) => o.maxTemperature));
    const tMax = Math.max(...calYear.map((o) => o.maxTemperature));
    const first = calYear[0]!.weatherDate;
    const last = calYear[calYear.length - 1]!.weatherDate;

    return {
      tooltip: {
        ...tooltipBase,
        formatter: (p: { data: [string, number] }) =>
          `${p.data[0]} · ${p.data[1].toFixed(1)}°C`,
      },
      visualMap: {
        show: false,
        min: tMin,
        max: tMax,
        inRange: { color: [palette.cold, palette.mute, palette.hot] },
      },
      calendar: {
        top: 30,
        left: 36,
        right: 12,
        cellSize: ["auto", 14],
        range: [first, last],
        splitLine: { show: false },
        itemStyle: {
          borderColor: palette.paper,
          borderWidth: 2,
          color: palette.faint,
        },
        yearLabel: { show: false },
        monthLabel: {
          ...monoText,
          fontSize: 9,
          margin: 8,
        },
        dayLabel: {
          ...monoText,
          fontSize: 9,
          nameMap: ["S", "M", "T", "W", "T", "F", "S"],
        },
      },
      series: [
        {
          type: "heatmap",
          coordinateSystem: "calendar",
          data: calYear.map((o) => [o.weatherDate, o.maxTemperature]),
          itemStyle: { borderRadius: 1 },
        },
      ],
    };
  }, [calYear]);

  if (!option) return null;

  const tMin = Math.min(...calYear.map((o) => o.maxTemperature));
  const tMax = Math.max(...calYear.map((o) => o.maxTemperature));

  return (
    <Frame label="§06 Calendar Heatmap · last 365 days · daily max temperature">
      <div className="px-[18px] py-3">
        <ReactECharts
          option={option}
          style={{ height: 160, width: "100%" }}
          opts={{ renderer: "svg" }}
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <Mono className="text-[9px] text-ink-soft">{tMin.toFixed(0)}°C</Mono>
          <div
            className="h-2 w-20 rounded-sm"
            style={{
              background: `linear-gradient(to right, ${palette.cold}, ${palette.mute}, ${palette.hot})`,
            }}
          />
          <Mono className="text-[9px] text-ink-soft">{tMax.toFixed(0)}°C</Mono>
        </div>
      </div>
    </Frame>
  );
}
