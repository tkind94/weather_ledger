import { useMemo } from "react";
import { computeRangeAgg } from "@/lib/weather";
import { Bigstat, Frame } from "./primitives";
import { useObservations, useRange, useUnits } from "./context";
import { RANGE_DAYS, fmtDate, fmtPrecip, fmtTemp } from "./format";

export function AggregatesSection() {
  const observations = useObservations();
  const units = useUnits();
  const range = useRange();
  const agg = useMemo(
    () => computeRangeAgg(observations, RANGE_DAYS[range]),
    [observations, range],
  );
  if (!agg) return null;

  return (
    <Frame label={`§02 Summary · ${range.toUpperCase()} · ${agg.n} days`}>
      <div className="grid grid-cols-5">
        <Bigstat
          label="Avg High"
          value={fmtTemp(agg.avgHigh, units)}
          tone="hot"
        />
        <Bigstat
          label="Avg Low"
          value={fmtTemp(agg.avgLow, units)}
          tone="cold"
        />
        <Bigstat
          label="Total Precip"
          value={fmtPrecip(agg.totalPrecip, units)}
        />
        <Bigstat
          label="Hottest"
          value={fmtTemp(agg.hottest.temp, units)}
          unit={fmtDate(agg.hottest.date)}
          tone="hot"
        />
        <Bigstat
          label="Coldest"
          value={fmtTemp(agg.coldest.temp, units)}
          unit={fmtDate(agg.coldest.date)}
          tone="cold"
          last
        />
      </div>
    </Frame>
  );
}
