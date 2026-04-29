import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, MapPin, RefreshCw } from "lucide-react";
import type { LocationCandidate, LocationRecord } from "@/lib/weather";

interface LocationSearchProps {
  locations: LocationRecord[];
  selectedLocationKey: string | null;
  onSearch: (query: string) => Promise<LocationCandidate[]>;
  onSelect: (locationKey: string) => void;
  onCache: (candidate: LocationCandidate) => void;
  onDelete: (locationKey: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function LocationSearch({
  locations,
  selectedLocationKey,
  onSearch,
  onSelect,
  onCache,
  onDelete,
  onRefresh,
  loading,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const trimmed = query.trim();
      if (!trimmed) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setSearching(true);
      setError(null);
      try {
        const candidates = await onSearch(trimmed);
        setResults(candidates);
        setShowResults(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, onSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col gap-4">
      {/* Search input */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search for a city..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="rounded-xl"
        />

        {/* Results dropdown */}
        {showResults && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border bg-card shadow-lg max-h-64 overflow-y-auto">
            {searching ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-5/6" />
              </div>
            ) : results.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No results found
              </p>
            ) : (
              results.map((candidate) => (
                <div
                  key={candidate.locationKey}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (candidate.isCached) {
                      onSelect(candidate.locationKey);
                    }
                    setShowResults(false);
                    setQuery("");
                  }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {candidate.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[candidate.admin1, candidate.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                  {candidate.isCached ? (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      Cached
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCache(candidate);
                        setShowResults(false);
                        setQuery("");
                      }}
                    >
                      Fetch & cache
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Cached locations list */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Cached locations
        </p>
        {locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cached locations</p>
        ) : (
          locations.map((loc) => (
            <div
              key={loc.locationKey}
              className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                loc.locationKey === selectedLocationKey
                  ? "bg-accent-warm"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => onSelect(loc.locationKey)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-sm truncate">{loc.displayName}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {loc.locationKey === selectedLocationKey && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefresh();
                    }}
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(loc.locationKey);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
