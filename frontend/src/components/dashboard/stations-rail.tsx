import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LocationCandidate, LocationRecord } from "@/lib/weather";
import { Caption, Frame, Mono } from "./primitives";

function SearchBox({
  query,
  onChange,
  searching,
}: {
  query: string;
  onChange: (val: string) => void;
  searching: boolean;
}) {
  return (
    <>
      <div className="mb-1.5">
        <Caption tracking="0.16em">Search Station</Caption>
      </div>
      <div className="flex items-center gap-1.5 border border-rule bg-card px-2 py-[5px]">
        <Mono className="text-[10px] text-ink-soft">›</Mono>
        <input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Find a city…"
          className="flex-1 border-none bg-transparent p-0 font-mono text-[11px] text-ink outline-none"
        />
      </div>
      {searching && (
        <Mono className="mt-1 block text-[9px] text-ink-soft">searching…</Mono>
      )}
    </>
  );
}

function SearchResults({
  results,
  loading,
  onSelect,
}: {
  results: LocationCandidate[];
  loading: boolean;
  onSelect: (r: LocationCandidate) => void;
}) {
  return (
    <div className="absolute inset-x-0 top-full z-10 border border-rule bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
      {results.slice(0, 6).map((r) => (
        <button
          key={r.locationKey}
          onClick={() => onSelect(r)}
          className={cn(
            "flex w-full items-center justify-between border-none border-b border-faint bg-transparent px-2.5 py-[7px] text-left font-mono text-[10px] text-ink",
            loading ? "cursor-wait" : "cursor-pointer",
          )}
        >
          <span>{r.displayName}</span>
          <Mono
            className={cn("text-[9px]", r.isCached ? "text-sage" : "text-mute")}
          >
            {r.isCached ? "cached" : "+ add"}
          </Mono>
        </button>
      ))}
    </div>
  );
}

function StationCard({
  loc,
  active,
  onSelect,
  onDelete,
  onRefresh,
}: {
  loc: LocationRecord;
  active: boolean;
  onSelect: (key: string) => void;
  onDelete?: (key: string) => void;
  onRefresh?: (key: string) => void;
}) {
  const iconBtnClass = cn(
    "flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-xs",
    active ? "text-faint" : "text-mute",
  );
  return (
    <div
      onClick={() => onSelect(loc.locationKey)}
      className={cn(
        "flex min-w-0 cursor-pointer items-center justify-between gap-2 border-r border-rule px-4 py-2.5 font-display text-[13px]",
        active ? "bg-ink text-paper" : "bg-transparent text-ink",
      )}
    >
      <div className="min-w-0">
        <div className="whitespace-nowrap font-semibold">{loc.name}</div>
        {loc.admin1 && (
          <div
            className={cn(
              "mt-px whitespace-nowrap font-mono text-[10px]",
              active ? "text-faint" : "text-ink-soft",
            )}
          >
            {loc.admin1}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefresh?.(loc.locationKey);
          }}
          title="Refresh"
          className={iconBtnClass}
        >
          ↻
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(loc.locationKey);
          }}
          title="Delete"
          className={iconBtnClass}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function StationsRail({
  locations,
  selectedKey,
  onSelect,
  onSearch,
  onCache,
  onDelete,
  onRefresh,
  loading,
}: {
  locations: LocationRecord[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onSearch: (q: string) => Promise<LocationCandidate[]>;
  onCache: (loc: LocationCandidate) => void;
  onDelete?: (key: string) => void;
  onRefresh?: (key: string) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleInput(val: string) {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await onSearch(val));
    } finally {
      setSearching(false);
    }
  }

  function handlePick(r: LocationCandidate) {
    if (r.isCached) onSelect(r.locationKey);
    else onCache(r);
    setQuery("");
    setResults([]);
  }

  return (
    <Frame label="§00 Stations">
      <div className="flex">
        <div className="relative flex-none basis-[240px] border-r border-rule bg-paper px-3 py-2.5">
          <SearchBox
            query={query}
            onChange={handleInput}
            searching={searching}
          />
          {results.length > 0 && (
            <SearchResults
              results={results}
              loading={loading}
              onSelect={handlePick}
            />
          )}
        </div>
        <div className="flex flex-1 overflow-x-auto">
          {locations.length === 0 && (
            <div className="px-[18px] py-3">
              <Mono className="text-[10px] text-ink-soft">
                No locations cached — search to add one.
              </Mono>
            </div>
          )}
          {locations.map((loc) => (
            <StationCard
              key={loc.locationKey}
              loc={loc}
              active={loc.locationKey === selectedKey}
              onSelect={onSelect}
              onDelete={onDelete}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}
