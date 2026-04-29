import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDate,
  formatTemperature,
  formatPrecipitation,
  type WeatherObservation,
} from "@/lib/weather";

interface ObservationTableProps {
  observations: WeatherObservation[];
}

export function ObservationTable({ observations }: ObservationTableProps) {
  const recent = observations.slice(-28).reverse();

  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Ledger
        </p>
        <CardTitle className="font-serif text-xl">
          Latest cached observations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No data available
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium uppercase tracking-wider text-muted-foreground text-xs">
                    Date
                  </th>
                  <th className="pb-3 font-medium uppercase tracking-wider text-muted-foreground text-xs text-right">
                    High
                  </th>
                  <th className="pb-3 font-medium uppercase tracking-wider text-muted-foreground text-xs text-right">
                    Low
                  </th>
                  <th className="pb-3 font-medium uppercase tracking-wider text-muted-foreground text-xs text-right">
                    Precipitation
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((obs) => (
                  <tr
                    key={obs.weatherDate}
                    className="border-b last:border-0 transition-colors hover:bg-muted/50"
                  >
                    <td className="py-3">{formatDate(obs.weatherDate)}</td>
                    <td className="py-3 text-right font-mono">
                      {formatTemperature(obs.maxTemperature)}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {formatTemperature(obs.minTemperature)}
                    </td>
                    <td className="py-3 text-right font-mono">
                      {formatPrecipitation(obs.precipitation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
