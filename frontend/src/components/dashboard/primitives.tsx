import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  fmtDate,
  fmtPrecip,
  fmtTemp,
  fmtTempDelta,
  palette,
  type Units,
} from "./format";
import type { WeatherObservation } from "@/lib/weather";

// ── Typography ───────────────────────────────────────────────────────────────

export function Mono({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={cn("font-mono", className)} style={style}>
      {children}
    </span>
  );
}

export function Caption({
  children,
  size = "9px",
  tracking = "0.14em",
  tone = "soft",
  inline = false,
}: {
  children: ReactNode;
  size?: "8px" | "9px";
  tracking?: string;
  tone?: "soft" | "hot" | "cold";
  inline?: boolean;
}) {
  const toneClass =
    tone === "hot"
      ? "text-hot"
      : tone === "cold"
        ? "text-cold"
        : "text-ink-soft";
  return (
    <span
      className={cn(
        "font-mono uppercase",
        toneClass,
        inline ? "" : "block",
        size === "8px" ? "text-[8px]" : "text-[9px]",
      )}
      style={{ letterSpacing: tracking }}
    >
      {children}
    </span>
  );
}

export function Display({
  children,
  size,
  color,
  weight = 700,
  className,
  style,
}: {
  children: ReactNode;
  size: number;
  color?: string;
  weight?: 600 | 700;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "font-display tabular-nums leading-none",
        weight === 600 ? "font-semibold" : "font-bold",
        className,
      )}
      style={{ fontSize: size, color: color ?? palette.ink, ...style }}
    >
      {children}
    </div>
  );
}

// ── Containers ───────────────────────────────────────────────────────────────

export function Frame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col border border-rule bg-card">
      <div className="border-b border-rule bg-paper px-3 py-[5px]">
        <Caption tracking="0.18em">{label}</Caption>
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

export function Placeholder({
  message,
  dashed,
}: {
  message: string;
  dashed?: boolean;
}) {
  return (
    <div
      className={cn(
        "border bg-card px-[18px] py-12 text-center",
        dashed ? "border-dashed border-rule" : "border-rule",
      )}
    >
      <Mono className="text-xs text-ink-soft">{message}</Mono>
    </div>
  );
}

// ── Controls ─────────────────────────────────────────────────────────────────

export function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex border border-rule">
      {options.map((o, i) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "cursor-pointer border-none px-[10px] py-1 font-mono text-[10px]",
              active ? "bg-ink text-paper" : "bg-transparent text-ink-soft",
              i < options.length - 1 && "border-r border-rule",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Stat blocks ──────────────────────────────────────────────────────────────

export function DeltaPill({ delta, units }: { delta: number; units: Units }) {
  const positive = delta >= 0;
  const sign = positive ? "+" : "";
  return (
    <Mono
      className={cn(
        "ml-2 rounded-sm px-1.5 py-0.5 text-[11px]",
        positive ? "bg-hot/[0.13] text-hot" : "bg-cold/[0.13] text-cold",
      )}
    >
      {sign}
      {fmtTempDelta(delta, units)}
    </Mono>
  );
}

// Inline stat used in §02 aggregates strip.
export function Bigstat({
  value,
  label,
  unit,
  tone,
  last,
}: {
  value: string;
  label: string;
  unit?: string;
  tone?: "hot" | "cold" | "neutral";
  last?: boolean;
}) {
  const color =
    tone === "hot" ? palette.hot : tone === "cold" ? palette.cold : palette.ink;
  return (
    <div className={cn("px-3.5 py-2.5", !last && "border-r border-rule")}>
      <Caption>{label}</Caption>
      <Display size={24} color={color} className="mt-1">
        {value}
        {unit && <span className="ml-1 text-[11px] text-ink-soft">{unit}</span>}
      </Display>
    </div>
  );
}

// Left-border stat: label + big value + optional sub line. §05 streaks, §07 records.
export function StatBlock({
  label,
  value,
  sub,
  color,
  labelSize = "9px",
  valueSize = 22,
  valueGap = 4,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  labelSize?: "8px" | "9px";
  valueSize?: number;
  valueGap?: number;
}) {
  return (
    <div className="pl-2.5" style={{ borderLeft: `2px solid ${color}` }}>
      <Caption size={labelSize}>{label}</Caption>
      <Display size={valueSize} color={color} style={{ marginTop: valueGap }}>
        {value}
      </Display>
      {sub && (
        <Mono className="mt-1 block text-[10px] text-ink-soft">{sub}</Mono>
      )}
    </div>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

export function ObservationsTable({
  rows,
  units,
  density,
  yearOnly = false,
}: {
  rows: WeatherObservation[];
  units: Units;
  density: "compact" | "comfortable";
  yearOnly?: boolean;
}) {
  const cellPad = density === "compact" ? "px-2.5 py-1" : "px-3 py-[5px]";
  const bodySize = density === "compact" ? "text-[10px]" : "text-[11px]";
  const headers = [yearOnly ? "Year" : "Date", "High", "Low", "Precip"];

  return (
    <table className={cn("w-full border-collapse font-mono", bodySize)}>
      <thead>
        <tr className="border-b border-rule">
          {headers.map((h) => (
            <th
              key={h}
              className={cn(
                "text-left text-[9px] font-normal uppercase text-ink-soft",
                cellPad,
              )}
              style={{ letterSpacing: "0.12em" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.weatherDate} className="border-b border-faint">
            <td className={cn(cellPad, "text-ink-soft")}>
              {yearOnly ? o.weatherDate.slice(0, 4) : fmtDate(o.weatherDate)}
            </td>
            <td
              className={cn(cellPad, "text-hot", !yearOnly && "font-semibold")}
            >
              {fmtTemp(o.maxTemperature, units)}
            </td>
            <td className={cn(cellPad, "text-cold")}>
              {fmtTemp(o.minTemperature, units)}
            </td>
            <td className={cn(cellPad, "text-ink")}>
              {o.precipitation > 0 ? fmtPrecip(o.precipitation, units) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
