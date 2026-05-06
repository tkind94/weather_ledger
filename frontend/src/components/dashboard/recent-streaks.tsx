import { useMemo } from "react";
import { computeStreaks, type Streaks } from "@/lib/weather";
import { Frame, ObservationsTable, StatBlock } from "./primitives";
import { useObservations, useUnits } from "./context";
import { fmtDate, palette } from "./format";

function buildStreakItems(streaks: Streaks) {
  const range = streaks.longestDryRange;
  const dryRange = range
    ? `${fmtDate(range[0])} – ${fmtDate(range[1])}`
    : undefined;
  return [
    {
      label: "CURRENT DRY STREAK",
      value: `${streaks.currentDry}d`,
      color: palette.highlight,
    },
    {
      label: "LONGEST DRY",
      value: `${streaks.longestDry}d`,
      sub: dryRange,
      color: palette.mute,
    },
    {
      label: "LONGEST WET",
      value: `${streaks.longestWet}d`,
      color: palette.cold,
    },
    {
      label: "ABOVE FREEZE",
      value: `${streaks.longestAboveFreeze}d`,
      color: palette.hot,
    },
    {
      label: "BELOW FREEZE",
      value: `${streaks.longestBelowFreeze}d`,
      color: palette.cold,
    },
  ];
}

export function RecentAndStreaks() {
  const observations = useObservations();
  const units = useUnits();
  const streaks = useMemo(() => computeStreaks(observations), [observations]);
  const recent = useMemo(
    () => observations.slice(-14).reverse(),
    [observations],
  );
  const items = buildStreakItems(streaks);

  return (
    <div className="grid grid-cols-[1fr_auto] gap-3.5">
      <Frame label="§04 Recent Observations · last 14 days">
        <div className="overflow-x-auto">
          <ObservationsTable
            rows={recent}
            units={units}
            density="comfortable"
          />
        </div>
      </Frame>

      <Frame label="§05 Streaks · all-time">
        <div className="flex min-w-[220px] flex-1 flex-col justify-between px-[18px] py-3">
          {items.map((s) => (
            <StatBlock
              key={s.label}
              label={s.label}
              value={s.value}
              sub={s.sub}
              color={s.color}
              labelSize="8px"
              valueSize={22}
              valueGap={2}
            />
          ))}
        </div>
      </Frame>
    </div>
  );
}
