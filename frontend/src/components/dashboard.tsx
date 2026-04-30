import { useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { useWeatherActions } from "@/hooks/use-weather";
import { WeatherChart } from "@/components/weather-chart";
import {
  computeTodayVsHistorical,
  computeRecords,
  computeStreaks,
  computeAnomalies,
  computeYoY,
  computeTempHistogram,
  computePrecipHistogram,
  computeCalendarYear,
  computeRangeAgg,
  type LocationCandidate,
  type TodayVsHistorical,
  type Records,
  type Streaks,
  type Anomaly,
  type YoYEntry,
  type TempHistogram,
  type PrecipBucket,
  type RangeAgg,
  type WeatherObservation,
  type LocationRecord,
} from "@/lib/weather";

// ── Palette ──────────────────────────────────────────────────────────────────

const P = {
  paper: "#F1ECDF",
  card: "#F7F3E6",
  ink: "#1F2925",
  inkSoft: "#5C6660",
  faint: "#D6CFB8",
  rule: "#A89D7C",
  hot: "#B0563A",
  cold: "#3F6B6B",
  sage: "#7A8868",
  mute: "#B8AE8C",
  highlight: "#E5C26B",
} as const;

const RANGE_DAYS: Record<"7d" | "30d" | "1y" | "all", number | null> = {
  "7d": 7,
  "30d": 30,
  "1y": 365,
  all: null,
};

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtTemp(c: number, units: "metric" | "imperial"): string {
  return units === "imperial"
    ? `${((c * 9) / 5 + 32).toFixed(0)}°F`
    : `${c.toFixed(0)}°C`;
}

function fmtPrecip(mm: number, units: "metric" | "imperial"): string {
  return units === "imperial"
    ? `${(mm / 25.4).toFixed(2)}"`
    : `${mm.toFixed(1)}mm`;
}

function fmtDate(s: string): string {
  return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtDateYear(s: string): string {
  return new Date(s + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function tempColor(t: number, tMin: number, tMax: number): string {
  const norm =
    tMax === tMin ? 0.5 : Math.max(0, Math.min(1, (t - tMin) / (tMax - tMin)));
  const r = Math.round(63 + 113 * norm);
  const g = Math.round(107 - 21 * norm);
  const b = Math.round(107 - 49 * norm);
  return `rgb(${r},${g},${b})`;
}

// ── Primitive components ──────────────────────────────────────────────────────

function Mono({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", ...style }}>
      {children}
    </span>
  );
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${P.rule}`,
        background: P.card,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${P.rule}`,
          padding: "5px 12px",
          background: P.paper,
        }}
      >
        <Mono
          style={{
            fontSize: 9,
            letterSpacing: "0.18em",
            color: P.inkSoft,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Mono>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { k: string; l: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <div style={{ display: "flex", border: `1px solid ${P.rule}` }}>
      {options.map((o, i) => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          style={{
            background: value === o.k ? P.ink : "transparent",
            color: value === o.k ? P.paper : P.inkSoft,
            border: "none",
            borderRight:
              i < options.length - 1 ? `1px solid ${P.rule}` : "none",
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function DeltaPill({
  delta,
  units,
}: {
  delta: number;
  units: "metric" | "imperial";
}) {
  const sign = delta >= 0 ? "+" : "";
  const color = delta >= 0 ? P.hot : P.cold;
  return (
    <Mono
      style={{
        fontSize: 11,
        color,
        background: `${color}22`,
        padding: "2px 6px",
        borderRadius: 2,
        marginLeft: 8,
      }}
    >
      {sign}
      {fmtTemp(delta, units)}
    </Mono>
  );
}

function Bigstat({
  n,
  label,
  unit,
  tone,
  last,
}: {
  n: string;
  label: string;
  unit?: string;
  tone?: "hot" | "cold" | "neutral";
  last?: boolean;
}) {
  const color = tone === "hot" ? P.hot : tone === "cold" ? P.cold : P.ink;
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRight: !last ? `1px solid ${P.rule}` : undefined,
      }}
    >
      <Mono
        style={{
          fontSize: 9,
          color: P.inkSoft,
          letterSpacing: "0.14em",
          display: "block",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Mono>
      <div
        style={{
          fontFamily: "'Inter Tight', sans-serif",
          fontSize: 24,
          fontWeight: 700,
          color,
          lineHeight: 1,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {n}
        {unit && (
          <span style={{ fontSize: 11, color: P.inkSoft, marginLeft: 4 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Section: Header ───────────────────────────────────────────────────────────

function AppHeader({
  units,
  setUnits,
  range,
  setRange,
  location,
}: {
  units: "metric" | "imperial";
  setUnits: (u: "metric" | "imperial") => void;
  range: "7d" | "30d" | "1y" | "all";
  setRange: (r: "7d" | "30d" | "1y" | "all") => void;
  location: LocationRecord | null;
}) {
  const now = new Date();
  return (
    <header
      style={{
        borderBottom: `2px solid ${P.ink}`,
        padding: "12px 18px",
        background: P.paper,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <Mono
          style={{
            fontSize: 9,
            letterSpacing: "0.24em",
            color: P.inkSoft,
            textTransform: "uppercase",
            display: "block",
          }}
        >
          SECTION I — STATION OVERVIEW
        </Mono>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            margin: "4px 0 2px",
            letterSpacing: "-0.01em",
            color: P.ink,
            fontFamily: "'Inter Tight', sans-serif",
          }}
        >
          Weather Ledger
        </h1>
        {location && (
          <Mono style={{ fontSize: 11, color: P.inkSoft, display: "block" }}>
            STN · {location.name.toUpperCase()}
            {location.admin1 ? `, ${location.admin1.toUpperCase()}` : ""} ·{" "}
            {Math.abs(location.latitude).toFixed(3)}°
            {location.latitude >= 0 ? "N" : "S"}{" "}
            {Math.abs(location.longitude).toFixed(3)}°
            {location.longitude >= 0 ? "E" : "W"}
            {location.elevation != null
              ? ` · ELEV ${location.elevation}m`
              : ""}{" "}
            · {location.timezone}
          </Mono>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Mono style={{ fontSize: 9, color: P.inkSoft, letterSpacing: "0.1em" }}>
          {now.toISOString().slice(0, 16).replace("T", " ")}Z
        </Mono>
        <Toggle
          options={[
            { k: "metric", l: "°C/mm" },
            { k: "imperial", l: "°F/in" },
          ]}
          value={units}
          onChange={(k) => setUnits(k as "metric" | "imperial")}
        />
        <Toggle
          options={[
            { k: "7d", l: "7D" },
            { k: "30d", l: "30D" },
            { k: "1y", l: "1Y" },
            { k: "all", l: "ALL" },
          ]}
          value={range}
          onChange={(k) => setRange(k as "7d" | "30d" | "1y" | "all")}
        />
      </div>
    </header>
  );
}

// ── Section §00: Stations Rail ────────────────────────────────────────────────

function StationsRail({
  locations,
  selectedKey,
  onSelect,
  onSearch,
  onCache,
  loading,
}: {
  locations: LocationRecord[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onSearch: (q: string) => Promise<LocationCandidate[]>;
  onCache: (loc: LocationCandidate) => void;
  loading: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LocationCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleInput(val: string) {
    setQ(val);
    if (!val.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await onSearch(val);
      setResults(r);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Frame label="§00 Stations">
      <div style={{ display: "flex" }}>
        <div
          style={{
            flex: "0 0 240px",
            padding: "10px 12px",
            borderRight: `1px solid ${P.rule}`,
            background: P.paper,
            position: "relative",
          }}
        >
          <Mono
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              color: P.inkSoft,
              display: "block",
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            Search Station
          </Mono>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${P.rule}`,
              padding: "5px 8px",
              background: P.card,
            }}
          >
            <Mono style={{ fontSize: 10, color: P.inkSoft }}>›</Mono>
            <input
              value={q}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="Find a city…"
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                flex: 1,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: P.ink,
                padding: 0,
              }}
            />
          </div>
          {searching && (
            <Mono
              style={{
                fontSize: 9,
                color: P.inkSoft,
                display: "block",
                marginTop: 4,
              }}
            >
              searching…
            </Mono>
          )}
          {results.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 10,
                border: `1px solid ${P.rule}`,
                background: P.card,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              {results.slice(0, 6).map((r) => (
                <button
                  key={r.locationKey}
                  onClick={() => {
                    if (r.isCached) onSelect(r.locationKey);
                    else onCache(r);
                    setQ("");
                    setResults([]);
                  }}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textAlign: "left",
                    padding: "7px 10px",
                    border: "none",
                    borderBottom: `1px solid ${P.faint}`,
                    background: "transparent",
                    cursor: loading ? "wait" : "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: P.ink,
                  }}
                >
                  <span>{r.displayName}</span>
                  <Mono
                    style={{ fontSize: 9, color: r.isCached ? P.sage : P.mute }}
                  >
                    {r.isCached ? "cached" : "+ add"}
                  </Mono>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", overflowX: "auto", flex: 1 }}>
          {locations.length === 0 && (
            <div style={{ padding: "12px 18px" }}>
              <Mono style={{ fontSize: 10, color: P.inkSoft }}>
                No locations cached — search to add one.
              </Mono>
            </div>
          )}
          {locations.map((loc) => {
            const active = loc.locationKey === selectedKey;
            return (
              <button
                key={loc.locationKey}
                onClick={() => onSelect(loc.locationKey)}
                style={{
                  background: active ? P.ink : "transparent",
                  color: active ? P.paper : P.ink,
                  border: "none",
                  padding: "10px 16px",
                  borderRight: `1px solid ${P.rule}`,
                  cursor: "pointer",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600 }}>{loc.name}</div>
                {loc.admin1 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: active ? P.faint : P.inkSoft,
                      marginTop: 1,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {loc.admin1}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

// ── Section §01: Hero — Today vs Historical ───────────────────────────────────

function HeroSection({
  todayVs,
  units,
}: {
  todayVs: TodayVsHistorical;
  units: "metric" | "imperial";
}) {
  const t = todayVs.today;
  const deltaH = t.maxTemperature - todayVs.avgHigh;
  const deltaL = t.minTemperature - todayVs.avgLow;

  return (
    <Frame label={`§01 Today vs. Historical · ${fmtDate(t.weatherDate)}`}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr" }}>
        {/* Left: hero numbers */}
        <div
          style={{
            padding: "14px 18px",
            borderRight: `1px solid ${P.rule}`,
          }}
        >
          <Mono
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              color: P.inkSoft,
              textTransform: "uppercase",
              display: "block",
            }}
          >
            OBSERVATION · {fmtDateYear(t.weatherDate).toUpperCase()}
          </Mono>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: 52,
                  fontWeight: 700,
                  color: P.hot,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtTemp(t.maxTemperature, units)}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: 4,
                  gap: 4,
                }}
              >
                <Mono style={{ fontSize: 10, color: P.inkSoft }}>
                  AVG {fmtTemp(todayVs.avgHigh, units)}
                </Mono>
                <DeltaPill delta={deltaH} units={units} />
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: 36,
                  fontWeight: 700,
                  color: P.cold,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtTemp(t.minTemperature, units)}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: 4,
                  gap: 4,
                }}
              >
                <Mono style={{ fontSize: 10, color: P.inkSoft }}>
                  AVG {fmtTemp(todayVs.avgLow, units)}
                </Mono>
                <DeltaPill delta={deltaL} units={units} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Mono style={{ fontSize: 11, color: P.inkSoft }}>
              Rank #{todayVs.rankHigh} warmest{" "}
              {fmtDate(t.weatherDate).split(" ")[0]} in{" "}
              {todayVs.yearsOfRecord + 1} years of record
            </Mono>
          </div>
          {t.precipitation > 0 && (
            <div style={{ marginTop: 4 }}>
              <Mono style={{ fontSize: 11, color: P.cold }}>
                Precip: {fmtPrecip(t.precipitation, units)} (avg{" "}
                {fmtPrecip(todayVs.avgPrecip, units)})
              </Mono>
            </div>
          )}
        </div>

        {/* Right: same-day history table */}
        <div style={{ overflowY: "auto", maxHeight: 220 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${P.rule}` }}>
                {["Year", "High", "Low", "Precip"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "4px 10px",
                      textAlign: "left",
                      color: P.inkSoft,
                      fontWeight: 400,
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...todayVs.sameDayHistory]
                .sort((a, b) => b.weatherDate.localeCompare(a.weatherDate))
                .map((o) => (
                  <tr
                    key={o.weatherDate}
                    style={{ borderBottom: `1px solid ${P.faint}` }}
                  >
                    <td style={{ padding: "4px 10px", color: P.inkSoft }}>
                      {o.weatherDate.slice(0, 4)}
                    </td>
                    <td style={{ padding: "4px 10px", color: P.hot }}>
                      {fmtTemp(o.maxTemperature, units)}
                    </td>
                    <td style={{ padding: "4px 10px", color: P.cold }}>
                      {fmtTemp(o.minTemperature, units)}
                    </td>
                    <td style={{ padding: "4px 10px", color: P.ink }}>
                      {o.precipitation > 0
                        ? fmtPrecip(o.precipitation, units)
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </Frame>
  );
}

// ── Section §02: Aggregates ───────────────────────────────────────────────────

function AggregatesSection({
  agg,
  units,
  range,
}: {
  agg: RangeAgg;
  units: "metric" | "imperial";
  range: string;
}) {
  return (
    <Frame label={`§02 Summary · ${range.toUpperCase()} · ${agg.n} days`}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
        }}
      >
        <Bigstat label="Avg High" n={fmtTemp(agg.avgHigh, units)} tone="hot" />
        <Bigstat label="Avg Low" n={fmtTemp(agg.avgLow, units)} tone="cold" />
        <Bigstat label="Total Precip" n={fmtPrecip(agg.totalPrecip, units)} />
        <Bigstat
          label="Hottest"
          n={fmtTemp(agg.hottest.temp, units)}
          unit={fmtDate(agg.hottest.date)}
          tone="hot"
        />
        <Bigstat
          label="Coldest"
          n={fmtTemp(agg.coldest.temp, units)}
          unit={fmtDate(agg.coldest.date)}
          tone="cold"
          last
        />
      </div>
    </Frame>
  );
}

// ── Section §03: Chart ────────────────────────────────────────────────────────

function ChartSection({
  observations,
  units,
}: {
  observations: WeatherObservation[];
  units: "metric" | "imperial";
}) {
  return (
    <Frame label="§03 Temperature & Precipitation · full history">
      <div style={{ padding: "0" }}>
        <WeatherChart observations={observations} units={units} />
      </div>
    </Frame>
  );
}

// ── Section §04-05: Recent & Streaks ─────────────────────────────────────────

function RecentAndStreaks({
  observations,
  streaks,
  units,
}: {
  observations: WeatherObservation[];
  streaks: Streaks;
  units: "metric" | "imperial";
}) {
  const recent = observations.slice(-14).reverse();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14 }}>
      {/* Recent 14 days */}
      <Frame label="§04 Recent Observations · last 14 days">
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${P.rule}` }}>
                {["Date", "High", "Low", "Precip"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "5px 12px",
                      textAlign: "left",
                      color: P.inkSoft,
                      fontWeight: 400,
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr
                  key={o.weatherDate}
                  style={{ borderBottom: `1px solid ${P.faint}` }}
                >
                  <td style={{ padding: "5px 12px", color: P.inkSoft }}>
                    {fmtDate(o.weatherDate)}
                  </td>
                  <td
                    style={{
                      padding: "5px 12px",
                      color: P.hot,
                      fontWeight: 600,
                    }}
                  >
                    {fmtTemp(o.maxTemperature, units)}
                  </td>
                  <td style={{ padding: "5px 12px", color: P.cold }}>
                    {fmtTemp(o.minTemperature, units)}
                  </td>
                  <td style={{ padding: "5px 12px", color: P.ink }}>
                    {o.precipitation > 0
                      ? fmtPrecip(o.precipitation, units)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Frame>

      {/* Streaks */}
      <Frame label="§05 Streaks · all-time">
        <div
          style={{
            padding: "12px 18px",
            minWidth: 220,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {[
            {
              label: "CURRENT DRY STREAK",
              value: `${streaks.currentDry}d`,
              color: P.highlight,
            },
            {
              label: "LONGEST DRY",
              value: `${streaks.longestDry}d`,
              sub: streaks.longestDryRange
                ? `${fmtDate(streaks.longestDryRange[0])} – ${fmtDate(streaks.longestDryRange[1])}`
                : undefined,
              color: P.mute,
            },
            {
              label: "LONGEST WET",
              value: `${streaks.longestWet}d`,
              color: P.cold,
            },
            {
              label: "ABOVE FREEZE",
              value: `${streaks.longestAboveFreeze}d`,
              color: P.hot,
            },
            {
              label: "BELOW FREEZE",
              value: `${streaks.longestBelowFreeze}d`,
              color: P.cold,
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                borderLeft: `2px solid ${s.color}`,
                paddingLeft: 10,
              }}
            >
              <Mono
                style={{
                  fontSize: 8,
                  color: P.inkSoft,
                  letterSpacing: "0.14em",
                  display: "block",
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </Mono>
              <div
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  color: s.color,
                  lineHeight: 1,
                  marginTop: 2,
                }}
              >
                {s.value}
              </div>
              {s.sub && (
                <Mono
                  style={{
                    fontSize: 9,
                    color: P.inkSoft,
                    display: "block",
                    marginTop: 2,
                  }}
                >
                  {s.sub}
                </Mono>
              )}
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}

// ── Section §06: Calendar Heatmap ────────────────────────────────────────────

function CalendarSection({ calYear }: { calYear: WeatherObservation[] }) {
  if (calYear.length === 0) return null;

  const tMin = Math.min(...calYear.map((o) => o.maxTemperature));
  const tMax = Math.max(...calYear.map((o) => o.maxTemperature));
  const obsMap = new Map(calYear.map((o) => [o.weatherDate, o]));

  const firstDate = new Date(calYear[0]!.weatherDate + "T00:00:00Z");
  const lastDate = new Date(
    calYear[calYear.length - 1]!.weatherDate + "T00:00:00Z",
  );
  const totalDays =
    Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1;
  const startDow = firstDate.getUTCDay();

  const CELL = 12;
  const LABEL_W = 20;
  const MONTH_H = 18;

  const cells: {
    col: number;
    row: number;
    obs: WeatherObservation | null;
    date: string;
  }[] = [];

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(firstDate.getTime() + i * 86400000);
    const date = d.toISOString().slice(0, 10);
    const col = Math.floor((i + startDow) / 7);
    const row = (i + startDow) % 7;
    cells.push({ col, row, obs: obsMap.get(date) ?? null, date });
  }

  const numCols =
    cells.length > 0 ? Math.max(...cells.map((c) => c.col)) + 1 : 0;
  const svgW = LABEL_W + numCols * CELL;
  const svgH = MONTH_H + 7 * CELL;

  const months: { col: number; label: string }[] = [];
  let prevMonth = -1;
  for (const cell of cells) {
    const d = new Date(cell.date + "T00:00:00Z");
    const m = d.getUTCMonth();
    if (m !== prevMonth) {
      months.push({
        col: cell.col,
        label: d.toLocaleDateString("en-US", {
          month: "short",
          timeZone: "UTC",
        }),
      });
      prevMonth = m;
    }
  }

  const DOW = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <Frame label="§06 Calendar Heatmap · last 365 days · daily max temperature">
      <div
        style={{
          padding: "12px 18px",
          overflowX: "auto",
        }}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{ display: "block", height: "auto" }}
          aria-label="Calendar heatmap"
        >
          {DOW.map((l, i) => (
            <text
              key={i}
              x={LABEL_W - 3}
              y={MONTH_H + i * CELL + 9}
              fontSize={7}
              fontFamily="'JetBrains Mono', monospace"
              fill={P.inkSoft}
              textAnchor="end"
            >
              {i % 2 === 1 ? l : ""}
            </text>
          ))}
          {months.map((m, i) => (
            <text
              key={i}
              x={LABEL_W + m.col * CELL + 1}
              y={MONTH_H - 5}
              fontSize={7}
              fontFamily="'JetBrains Mono', monospace"
              fill={P.inkSoft}
            >
              {m.label}
            </text>
          ))}
          {cells.map((c, i) => (
            <rect
              key={i}
              x={LABEL_W + c.col * CELL + 1}
              y={MONTH_H + c.row * CELL + 1}
              width={10}
              height={10}
              rx={1}
              fill={
                c.obs ? tempColor(c.obs.maxTemperature, tMin, tMax) : P.faint
              }
              opacity={c.obs ? 0.85 : 0.2}
            >
              <title>
                {c.date}
                {c.obs
                  ? `: ${c.obs.maxTemperature.toFixed(1)}°C`
                  : " (no data)"}
              </title>
            </rect>
          ))}
        </svg>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
          }}
        >
          <Mono style={{ fontSize: 8, color: P.inkSoft }}>
            {tMin.toFixed(0)}°C
          </Mono>
          <svg width={80} height={8}>
            <defs>
              <linearGradient id="tempRamp" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={P.cold} />
                <stop offset="100%" stopColor={P.hot} />
              </linearGradient>
            </defs>
            <rect width={80} height={8} rx={2} fill="url(#tempRamp)" />
          </svg>
          <Mono style={{ fontSize: 8, color: P.inkSoft }}>
            {tMax.toFixed(0)}°C
          </Mono>
        </div>
      </div>
    </Frame>
  );
}

// ── Section §07: Records ──────────────────────────────────────────────────────

function RecordsSection({
  records,
  units,
}: {
  records: Records;
  units: "metric" | "imperial";
}) {
  return (
    <Frame label="§07 All-Time Records · on file">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 0,
        }}
      >
        {[
          {
            label: "HIGHEST MAX",
            value: fmtTemp(records.hi, units),
            date: fmtDateYear(records.hiDate),
            color: P.hot,
          },
          {
            label: "LOWEST MIN",
            value: fmtTemp(records.lo, units),
            date: fmtDateYear(records.loDate),
            color: P.cold,
          },
          {
            label: "WETTEST DAY",
            value: fmtPrecip(records.maxPrecip, units),
            date: fmtDateYear(records.maxPrecipDate),
            color: P.cold,
          },
        ].map((r, i) => (
          <div
            key={r.label}
            style={{
              padding: "14px 18px",
              borderLeft: i > 0 ? `1px solid ${P.rule}` : undefined,
            }}
          >
            <div
              style={{
                borderLeft: `2px solid ${r.color}`,
                paddingLeft: 10,
              }}
            >
              <Mono
                style={{
                  fontSize: 9,
                  color: P.inkSoft,
                  letterSpacing: "0.14em",
                  display: "block",
                  textTransform: "uppercase",
                }}
              >
                {r.label}
              </Mono>
              <div
                style={{
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: 28,
                  fontWeight: 700,
                  color: r.color,
                  lineHeight: 1,
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.value}
              </div>
              <Mono
                style={{
                  fontSize: 10,
                  color: P.inkSoft,
                  marginTop: 4,
                  display: "block",
                }}
              >
                {r.date}
              </Mono>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ── Section §08: Year-over-Year ───────────────────────────────────────────────

function YoYSection({
  yoy,
  units,
}: {
  yoy: YoYEntry[];
  units: "metric" | "imperial";
}) {
  if (yoy.length === 0) return null;

  const allTemps = yoy.flatMap((e) => [e.avgHigh, e.avgLow]);
  const tMin = Math.min(...allTemps);
  const tMax = Math.max(...allTemps);
  const range = tMax - tMin || 1;
  const BAR_W = 260;
  const ROW_H = 22;
  const LABEL_W = 36;

  return (
    <Frame label="§08 Year-over-Year · this calendar week ±3 days">
      <div
        style={{
          padding: "12px 18px",
          overflowX: "auto",
        }}
      >
        <svg
          viewBox={`0 0 ${LABEL_W + BAR_W + 60} ${yoy.length * ROW_H + 10}`}
          width="100%"
          style={{ display: "block", height: "auto" }}
        >
          {yoy.map((e, i) => {
            const loX = ((e.avgLow - tMin) / range) * BAR_W;
            const hiX = ((e.avgHigh - tMin) / range) * BAR_W;
            const y = i * ROW_H;
            return (
              <g key={e.year}>
                <text
                  x={LABEL_W - 4}
                  y={y + ROW_H * 0.72}
                  fontSize={9}
                  fontFamily="'JetBrains Mono', monospace"
                  fill={P.inkSoft}
                  textAnchor="end"
                >
                  {e.year}
                </text>
                <rect
                  x={LABEL_W}
                  y={y + 4}
                  width={loX}
                  height={ROW_H - 8}
                  fill={P.cold}
                  fillOpacity={0.45}
                  rx={1}
                />
                <rect
                  x={LABEL_W + loX}
                  y={y + 4}
                  width={Math.max(0, hiX - loX)}
                  height={ROW_H - 8}
                  fill={P.hot}
                  fillOpacity={0.65}
                  rx={1}
                />
                <text
                  x={LABEL_W + hiX + 5}
                  y={y + ROW_H * 0.72}
                  fontSize={9}
                  fontFamily="'JetBrains Mono', monospace"
                  fill={P.inkSoft}
                >
                  {fmtTemp(e.avgHigh, units)} / {fmtTemp(e.avgLow, units)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Frame>
  );
}

// ── Section §09: Distributions ────────────────────────────────────────────────

function DistributionsSection({
  tempHist,
  precipHist,
  units,
}: {
  tempHist: TempHistogram;
  precipHist: PrecipBucket[];
  units: "metric" | "imperial";
}) {
  const maxTempCount = Math.max(...tempHist.counts, 1);
  const maxPrecipCount = Math.max(...precipHist.map((b) => b.count), 1);
  const BAR_H = 60;
  const TEMP_W = 8;
  const PRECIP_W = 28;
  const GAP = 2;

  const tempSvgW = tempHist.binCount * (TEMP_W + GAP);
  const precipSvgW = precipHist.length * (PRECIP_W + GAP);

  return (
    <Frame label="§09 Distributions · all-time">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderTop: `1px solid ${P.rule}`,
        }}
      >
        {/* Temp histogram */}
        <div
          style={{
            padding: "12px 18px",
            borderRight: `1px solid ${P.rule}`,
          }}
        >
          <Mono
            style={{
              fontSize: 9,
              color: P.inkSoft,
              letterSpacing: "0.12em",
              display: "block",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Daily Max Temperature Distribution
          </Mono>
          <svg
            viewBox={`0 0 ${tempSvgW} ${BAR_H + 16}`}
            width="100%"
            style={{ display: "block", height: "auto" }}
          >
            {tempHist.counts.map((count, i) => {
              const h = (count / maxTempCount) * BAR_H;
              const centerTemp = tempHist.min + (i + 0.5) * tempHist.binWidth;
              const fill = tempColor(centerTemp, tempHist.min, tempHist.max);
              return (
                <g key={i}>
                  <rect
                    x={i * (TEMP_W + GAP)}
                    y={BAR_H - h}
                    width={TEMP_W}
                    height={h}
                    fill={fill}
                    fillOpacity={0.8}
                    rx={1}
                  >
                    <title>
                      {fmtTemp(tempHist.min + i * tempHist.binWidth, units)} –{" "}
                      {fmtTemp(
                        tempHist.min + (i + 1) * tempHist.binWidth,
                        units,
                      )}
                      : {count} days
                    </title>
                  </rect>
                </g>
              );
            })}
            <text
              x={0}
              y={BAR_H + 13}
              fontSize={7}
              fontFamily="'JetBrains Mono', monospace"
              fill={P.inkSoft}
            >
              {fmtTemp(tempHist.min, units)}
            </text>
            <text
              x={tempSvgW}
              y={BAR_H + 13}
              fontSize={7}
              fontFamily="'JetBrains Mono', monospace"
              fill={P.inkSoft}
              textAnchor="end"
            >
              {fmtTemp(tempHist.max, units)}
            </text>
          </svg>
        </div>

        {/* Precip histogram */}
        <div style={{ padding: "12px 18px" }}>
          <Mono
            style={{
              fontSize: 9,
              color: P.inkSoft,
              letterSpacing: "0.12em",
              display: "block",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Daily Precipitation Distribution
          </Mono>
          <svg
            viewBox={`0 0 ${precipSvgW} ${BAR_H + 28}`}
            width="100%"
            style={{ display: "block", height: "auto" }}
          >
            {precipHist.map((b, i) => {
              const h = (b.count / maxPrecipCount) * BAR_H;
              return (
                <g key={b.label}>
                  <rect
                    x={i * (PRECIP_W + GAP)}
                    y={BAR_H - h}
                    width={PRECIP_W}
                    height={h}
                    fill={P.sage}
                    fillOpacity={0.7}
                    rx={1}
                  >
                    <title>
                      {b.label}: {b.count} days
                    </title>
                  </rect>
                  <text
                    x={i * (PRECIP_W + GAP) + PRECIP_W / 2}
                    y={BAR_H + 11}
                    fontSize={7}
                    fontFamily="'JetBrains Mono', monospace"
                    fill={P.inkSoft}
                    textAnchor="middle"
                  >
                    {b.label}
                  </text>
                  <text
                    x={i * (PRECIP_W + GAP) + PRECIP_W / 2}
                    y={BAR_H + 22}
                    fontSize={7}
                    fontFamily="'JetBrains Mono', monospace"
                    fill={P.mute}
                    textAnchor="middle"
                  >
                    {b.count}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </Frame>
  );
}

// ── Section: Anomaly Banner ───────────────────────────────────────────────────

function AnomalyBanner({
  anomaly,
  units,
}: {
  anomaly: Anomaly;
  units: "metric" | "imperial";
}) {
  const color = anomaly.label === "warmer" ? P.hot : P.cold;
  const sign = anomaly.delta >= 0 ? "+" : "";
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        background: `${color}12`,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Mono
        style={{
          fontSize: 9,
          color,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        ANOMALY
      </Mono>
      <span
        style={{
          fontFamily: "'Inter Tight', sans-serif",
          fontSize: 13,
          color: P.ink,
        }}
      >
        Last 7 days avg high{" "}
        <strong style={{ color }}>
          {sign}
          {fmtTemp(anomaly.delta, units)}
        </strong>{" "}
        vs same week last year ({fmtTemp(anomaly.currentAvgHigh, units)} vs{" "}
        {fmtTemp(anomaly.lastYearAvgHigh, units)})
      </span>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function Dashboard() {
  const {
    state,
    selectLocation,
    searchLocations,
    cacheLocation,
    refreshCurrentLocation,
    deleteLocation,
  } = useWeatherActions();

  void deleteLocation;
  void refreshCurrentLocation;

  const { selectedLocation, observations, locations, loading, error } = state;

  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [range, setRange] = useState<"7d" | "30d" | "1y" | "all">("30d");

  const todayVs = useMemo(
    () => computeTodayVsHistorical(observations),
    [observations],
  );
  const records = useMemo(() => computeRecords(observations), [observations]);
  const streaks = useMemo(() => computeStreaks(observations), [observations]);
  const anomaly = useMemo(() => computeAnomalies(observations), [observations]);
  const yoy = useMemo(() => computeYoY(observations), [observations]);
  const tempHist = useMemo(
    () => computeTempHistogram(observations),
    [observations],
  );
  const precipHist = useMemo(
    () => computePrecipHistogram(observations),
    [observations],
  );
  const calYear = useMemo(
    () => computeCalendarYear(observations),
    [observations],
  );
  const rangeAgg = useMemo(
    () => computeRangeAgg(observations, RANGE_DAYS[range]),
    [observations, range],
  );

  const hasData = observations.length > 0;

  return (
    <div
      style={{
        background: P.paper,
        color: P.ink,
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        minHeight: "100vh",
        backgroundImage: `repeating-linear-gradient(0deg, ${P.faint}20 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, ${P.faint}20 0 1px, transparent 1px 24px)`,
      }}
    >
      <AppHeader
        units={units}
        setUnits={setUnits}
        range={range}
        setRange={setRange}
        location={selectedLocation}
      />

      <div
        style={{
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxWidth: 1440,
          margin: "0 auto",
        }}
      >
        <StationsRail
          locations={locations}
          selectedKey={selectedLocation?.locationKey ?? null}
          onSelect={selectLocation}
          onSearch={searchLocations}
          onCache={(loc) => cacheLocation(loc)}
          loading={loading}
        />

        {error && (
          <div
            style={{
              border: `1px solid ${P.hot}`,
              background: `${P.hot}12`,
              padding: "8px 14px",
            }}
          >
            <Mono style={{ fontSize: 11, color: P.hot }}>{error}</Mono>
          </div>
        )}

        {!selectedLocation && !loading && (
          <div
            style={{
              padding: "48px 18px",
              textAlign: "center",
              border: `1px dashed ${P.rule}`,
              background: P.card,
            }}
          >
            <Mono style={{ fontSize: 12, color: P.inkSoft }}>
              Search for a station above to load weather data.
            </Mono>
          </div>
        )}

        {loading && !hasData && (
          <div
            style={{
              padding: "48px 18px",
              textAlign: "center",
              border: `1px solid ${P.rule}`,
              background: P.card,
            }}
          >
            <Mono style={{ fontSize: 12, color: P.inkSoft }}>
              Loading station data…
            </Mono>
          </div>
        )}

        {hasData && (
          <>
            {anomaly && <AnomalyBanner anomaly={anomaly} units={units} />}
            {todayVs && <HeroSection todayVs={todayVs} units={units} />}
            {rangeAgg && (
              <AggregatesSection agg={rangeAgg} units={units} range={range} />
            )}
            <ChartSection observations={observations} units={units} />
            <RecentAndStreaks
              observations={observations}
              streaks={streaks}
              units={units}
            />
            <CalendarSection calYear={calYear} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <YoYSection yoy={yoy} units={units} />
              {records && <RecordsSection records={records} units={units} />}
            </div>
            <DistributionsSection
              tempHist={tempHist}
              precipHist={precipHist}
              units={units}
            />
          </>
        )}
      </div>

      <footer
        style={{
          borderTop: `2px solid ${P.ink}`,
          padding: "10px 18px",
          background: P.paper,
          display: "flex",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <Mono
          style={{ fontSize: 9, color: P.inkSoft, letterSpacing: "0.18em" }}
        >
          WEATHER LEDGER · DATA · OPEN-METEO.COM · OPEN-METEO GEOCODING API
        </Mono>
        <Mono style={{ fontSize: 9, color: P.inkSoft, letterSpacing: "0.1em" }}>
          {observations.length > 0
            ? `${observations.length} OBSERVATIONS ON FILE`
            : "NO DATA"}
        </Mono>
      </footer>
    </div>
  );
}
