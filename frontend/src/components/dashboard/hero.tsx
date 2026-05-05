import { useMemo } from "react";
import type { TodayVsHistorical } from "@/lib/weather";
import {
  Caption,
  DeltaPill,
  Display,
  Frame,
  Mono,
  ObservationsTable,
} from "./primitives";
import { fmtDate, fmtDateYear, fmtPrecip, fmtTemp, type Units } from "./format";

function HeroNumber({
  value,
  avg,
  delta,
  size,
  units,
}: {
  value: number;
  avg: number;
  delta: number;
  size: number;
  units: Units;
}) {
  return (
    <div>
      <Display size={size}>{fmtTemp(value, units)}</Display>
      <div className="mt-1 flex items-center gap-1">
        <Mono className="text-[10px] text-ink-soft">
          AVG {fmtTemp(avg, units)}
        </Mono>
        <DeltaPill delta={delta} units={units} />
      </div>
    </div>
  );
}

export function HeroSection({
  todayVs,
  units,
}: {
  todayVs: TodayVsHistorical;
  units: Units;
}) {
  const today = todayVs.today;
  const history = useMemo(
    () =>
      [...todayVs.sameDayHistory].sort((a, b) =>
        b.weatherDate.localeCompare(a.weatherDate),
      ),
    [todayVs.sameDayHistory],
  );

  return (
    <Frame label={`§01 Today vs. Historical · ${fmtDate(today.weatherDate)}`}>
      <div className="grid grid-cols-[1.4fr_1fr]">
        <div className="border-r border-rule px-[18px] py-3.5">
          <Caption tracking="0.18em">
            OBSERVATION · {fmtDateYear(today.weatherDate).toUpperCase()}
          </Caption>
          <div className="mt-2 flex flex-wrap items-baseline gap-4">
            <HeroNumber
              value={today.maxTemperature}
              avg={todayVs.avgHigh}
              delta={today.maxTemperature - todayVs.avgHigh}
              size={52}
              units={units}
            />
            <HeroNumber
              value={today.minTemperature}
              avg={todayVs.avgLow}
              delta={today.minTemperature - todayVs.avgLow}
              size={36}
              units={units}
            />
          </div>
          <Mono className="mt-3 block text-[11px] text-ink-soft">
            Rank #{todayVs.rankHigh} warmest{" "}
            {fmtDate(today.weatherDate).split(" ")[0]} in{" "}
            {todayVs.yearsOfRecord + 1} years of record
          </Mono>
          {today.precipitation > 0 && (
            <Mono className="mt-1 block text-[11px] text-cold">
              Precip: {fmtPrecip(today.precipitation, units)} (avg{" "}
              {fmtPrecip(todayVs.avgPrecip, units)})
            </Mono>
          )}
        </div>

        <div className="max-h-[220px] overflow-y-auto">
          <ObservationsTable
            rows={history}
            units={units}
            density="compact"
            yearOnly
          />
        </div>
      </div>
    </Frame>
  );
}
