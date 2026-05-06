import { WeatherChart } from "@/components/weather-chart";
import { useObservations, useRange, useUnits } from "./context";
import { RANGE_DAYS } from "./format";

export default function ChartSection() {
  const observations = useObservations();
  const units = useUnits();
  const range = useRange();
  const days = RANGE_DAYS[range];
  const filtered = days !== null ? observations.slice(-days) : observations;
  return <WeatherChart observations={filtered} units={units} />;
}
