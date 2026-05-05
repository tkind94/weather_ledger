import { cn } from "@/lib/utils";
import type { Records } from "@/lib/weather";
import { Frame, StatBlock } from "./primitives";
import { fmtDateYear, fmtPrecip, fmtTemp, palette, type Units } from "./format";

export function RecordsSection({
  records,
  units,
}: {
  records: Records;
  units: Units;
}) {
  const items = [
    {
      label: "HIGHEST MAX",
      value: fmtTemp(records.hi, units),
      sub: fmtDateYear(records.hiDate),
      color: palette.hot,
    },
    {
      label: "LOWEST MIN",
      value: fmtTemp(records.lo, units),
      sub: fmtDateYear(records.loDate),
      color: palette.cold,
    },
    {
      label: "WETTEST DAY",
      value: fmtPrecip(records.maxPrecip, units),
      sub: fmtDateYear(records.maxPrecipDate),
      color: palette.cold,
    },
  ];

  return (
    <Frame label="§07 All-Time Records · on file">
      <div className="grid grid-cols-3">
        {items.map((r, i) => (
          <div
            key={r.label}
            className={cn("px-[18px] py-3.5", i > 0 && "border-l border-rule")}
          >
            <StatBlock
              label={r.label}
              value={r.value}
              sub={r.sub}
              color={r.color}
              valueSize={28}
            />
          </div>
        ))}
      </div>
    </Frame>
  );
}
