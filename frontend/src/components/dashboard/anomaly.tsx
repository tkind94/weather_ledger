import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { computeAnomalies } from "@/lib/weather";
import { Caption } from "./primitives";
import { useObservations, useUnits } from "./context";
import { fmtTemp, fmtTempDelta } from "./format";

export function AnomalyBanner() {
  const observations = useObservations();
  const units = useUnits();
  const anomaly = useMemo(() => computeAnomalies(observations), [observations]);
  if (!anomaly) return null;

  const warmer = anomaly.label === "warmer";
  const tone = warmer ? "hot" : "cold";
  const sign = anomaly.delta >= 0 ? "+" : "";
  return (
    <div
      className={cn(
        "flex items-center gap-3 border px-3.5 py-2",
        warmer ? "border-hot bg-hot/[0.07]" : "border-cold bg-cold/[0.07]",
      )}
    >
      <Caption tone={tone} tracking="0.18em" inline>
        ANOMALY
      </Caption>
      <span className="font-display text-[13px] text-ink">
        Last 7 days avg high{" "}
        <strong className={warmer ? "text-hot" : "text-cold"}>
          {sign}
          {fmtTempDelta(anomaly.delta, units)}
        </strong>{" "}
        vs same week last year ({fmtTemp(anomaly.currentAvgHigh, units)} vs{" "}
        {fmtTemp(anomaly.lastYearAvgHigh, units)})
      </span>
    </div>
  );
}
