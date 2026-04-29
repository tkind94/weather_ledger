import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WeatherObservation } from "@/lib/weather";

const WeatherChartInner = lazy(() =>
  import("./weather-chart-inner").then((mod) => ({
    default: mod.WeatherChartInner,
  })),
);

interface WeatherChartProps {
  observations: WeatherObservation[];
}

function ChartSkeleton() {
  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

export function WeatherChart({ observations }: WeatherChartProps) {
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

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <WeatherChartInner observations={observations} />
    </Suspense>
  );
}
