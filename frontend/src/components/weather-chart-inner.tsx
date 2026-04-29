import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeatherObservation } from "@/lib/weather";

interface WeatherChartInnerProps {
  observations: WeatherObservation[];
}

export function WeatherChartInner({ observations }: WeatherChartInnerProps) {
  const recent = observations.slice(-60);

  const option = useMemo(() => {
    const dates = recent.map((obs) => obs.weatherDate);
    const maxTemps = recent.map((obs) => obs.maxTemperature);
    const minTemps = recent.map((obs) => obs.minTemperature);
    const precips = recent.map((obs) => obs.precipitation);

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderColor: "#e5e7eb",
        textStyle: { color: "#1f2937", fontSize: 12 },
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
          let html = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`;
          for (const p of params) {
            const unit = p.seriesName === "Precipitation" ? " mm" : "°C";
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
              <span>${p.seriesName}: ${p.value.toFixed(1)}${unit}</span>
            </div>`;
          }
          return html;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#6b7280", fontSize: 11 },
      },
      grid: {
        top: 20,
        right: 60,
        bottom: 40,
        left: 50,
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: {
          color: "#9ca3af",
          fontSize: 10,
          formatter: (val: string) => {
            const d = new Date(`${val}T00:00:00Z`);
            return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
          },
        },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "°C",
          nameTextStyle: { color: "#9ca3af", fontSize: 10 },
          axisLabel: { color: "#9ca3af", fontSize: 10 },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: "#f3f4f6" } },
        },
        {
          type: "value",
          name: "mm",
          nameTextStyle: { color: "#9ca3af", fontSize: 10 },
          axisLabel: { color: "#9ca3af", fontSize: 10 },
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
          lineStyle: { width: 2, color: "#e76f51" },
          itemStyle: { color: "#e76f51" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(231, 111, 81, 0.15)" },
                { offset: 1, color: "rgba(231, 111, 81, 0)" },
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
          lineStyle: { width: 2, color: "#457b9d" },
          itemStyle: { color: "#457b9d" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(69, 123, 157, 0.1)" },
                { offset: 1, color: "rgba(69, 123, 157, 0)" },
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
          itemStyle: { color: "rgba(148, 163, 184, 0.4)" },
          barMaxWidth: 6,
        },
      ],
    };
  }, [recent]);

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trends
        </p>
        <CardTitle className="font-serif text-xl">
          Temperature & precipitation
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: 320, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        )}
      </CardContent>
    </Card>
  );
}
