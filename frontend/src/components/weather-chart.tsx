import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WeatherObservation } from "@/lib/weather";
import { WeatherChartInner } from "./weather-chart-inner";

interface WeatherChartProps {
  observations: WeatherObservation[];
  units: "metric" | "imperial";
}

export function WeatherChart({ observations, units }: WeatherChartProps) {
  if (observations.length < 2) {
    return (
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Trends
          </p>
          <p className="font-serif text-xl font-semibold">
            Temperature & precipitation
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return <WeatherChartInner observations={observations} units={units} />;
}
