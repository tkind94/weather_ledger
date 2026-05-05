import { WeatherChart } from "@/components/weather-chart";
import type { WeatherObservation } from "@/lib/weather";
import { RANGE_DAYS, type Range, type Units } from "./format";

export function ChartSection({
  observations,
  units,
  range,
}: {
  observations: WeatherObservation[];
  units: Units;
  range: Range;
}) {
  const days = RANGE_DAYS[range];
  const filtered = days !== null ? observations.slice(-days) : observations;
  return <WeatherChart observations={filtered} units={units} />;
}
