import type { RangeAgg } from "@/lib/weather";
import { Bigstat, Frame } from "./primitives";
import { fmtDate, fmtPrecip, fmtTemp, type Units } from "./format";

export function AggregatesSection({
  agg,
  units,
  range,
}: {
  agg: RangeAgg;
  units: Units;
  range: string;
}) {
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
