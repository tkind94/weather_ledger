import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatTemperature,
  formatPrecipitation,
  formatDate,
  type DashboardSummary,
} from "@/lib/weather";

interface SummaryCardsProps {
  summary: DashboardSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Observation Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold font-serif">
            {summary.observationCount}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Average High
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold font-serif">
            {summary.avgHigh !== null
              ? formatTemperature(summary.avgHigh)
              : "—"}
          </p>
          {summary.avgLow !== null && (
            <p className="mt-1 text-sm text-muted-foreground">
              Avg low: {formatTemperature(summary.avgLow)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Precipitation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold font-serif">
            {formatPrecipitation(summary.totalPrecipitation)}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Hottest Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold font-serif">
            {summary.hottestTemperature !== null
              ? formatTemperature(summary.hottestTemperature)
              : "—"}
          </p>
          {summary.hottestDate && (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(summary.hottestDate)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Wettest Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold font-serif">
            {summary.wettestPrecipitation !== null
              ? formatPrecipitation(summary.wettestPrecipitation)
              : "—"}
          </p>
          {summary.wettestDate && (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(summary.wettestDate)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
