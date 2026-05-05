import type { LocationRecord } from "@/lib/weather";
import { Caption, Mono, Toggle } from "./primitives";
import type { Range, Units } from "./format";

const UNIT_OPTIONS: { key: Units; label: string }[] = [
  { key: "metric", label: "°C/mm" },
  { key: "imperial", label: "°F/in" },
];

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "ALL" },
];

function StationLine({ location }: { location: LocationRecord }) {
  const lat = `${Math.abs(location.latitude).toFixed(3)}°${location.latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(location.longitude).toFixed(3)}°${location.longitude >= 0 ? "E" : "W"}`;
  const admin = location.admin1 ? `, ${location.admin1.toUpperCase()}` : "";
  const elev =
    location.elevation != null ? ` · ELEV ${location.elevation}m` : "";
  return (
    <Mono className="block text-[11px] text-ink-soft">
      STN · {location.name.toUpperCase()}
      {admin} · {lat} {lon}
      {elev} · {location.timezone}
    </Mono>
  );
}

export function AppHeader({
  units,
  setUnits,
  range,
  setRange,
  location,
}: {
  units: Units;
  setUnits: (u: Units) => void;
  range: Range;
  setRange: (r: Range) => void;
  location: LocationRecord | null;
}) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ink bg-paper px-[18px] py-3">
      <div>
        <Caption tracking="0.24em">SECTION I — STATION OVERVIEW</Caption>
        <h1 className="mb-0.5 mt-1 font-display text-[28px] font-semibold text-ink [letter-spacing:-0.01em]">
          Weather Ledger
        </h1>
        {location && <StationLine location={location} />}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Mono
          className="text-[9px] text-ink-soft"
          style={{ letterSpacing: "0.1em" }}
        >
          {stamp}Z
        </Mono>
        <Toggle options={UNIT_OPTIONS} value={units} onChange={setUnits} />
        <Toggle options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>
    </header>
  );
}
