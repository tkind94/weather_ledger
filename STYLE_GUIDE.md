# Style Guide

This document codifies how code is written in Weather Ledger. It is opinionated by design.
If a pattern is not listed here, default to the simplest thing that works.

## Core Principle: The IO Sandwich

All code in this repo follows a strict layering:

```
IO (boundary) → Pure transformation → IO (boundary)
```

- **Top/Bottom:** HTTP calls, database reads/writes, filesystem access.
- **Middle:** Pure functions that take data in and return data out. No side effects.
- **Rule:** If a function does IO AND transformation, split it.

## Data Flow

```
Open-Meteo API
    ↓  fetch.py (boundary: HTTP → DuckDB)
raw_weather table
    ↓
    ├── weather_monthly_extremes (dbt table: monthly aggregation)
    ├── dashboard_summary (dbt table: pre-computed metrics)
    ↓
SvelteKit server load (boundary: DuckDB → JSON)
    ↓
Svelte component (pure rendering)
```

### Who Owns What

| Concern | Owner | Examples |
|---------|-------|---------|
| External API interaction | `fetch.py` | HTTP calls, retry logic, response parsing |
| Schema definition | `fetch.py` (`CREATE TABLE`) | Column names, types, constraints |
| Type casting | `fetch.py` (`CREATE TABLE`) | Column types enforced at ingestion |
| Aggregation | dbt mart models | `SUM`, `AVG`, `MAX`, window functions |
| snake→camelCase aliasing | Frontend SQL queries | `max_temperature_c AS maxTemperatureC` |
| Display formatting | Svelte templates | `.toFixed(1)`, `?? '—'` |
| Client-side computation | **Nobody** | Banned. No `.reduce()`, no `$derived` math. |

## Python (data-pipeline/)

### Data containers

Use `@dataclass(frozen=True)`. No methods on data classes. No inheritance.

```python
@dataclass(frozen=True)
class WeatherDay:
    weather_date: str
    max_temperature_c: float
```

### Boundary validation

Validate at the system edge (API responses, CLI input). Once data enters a typed
container, it is trusted. No `if x is None` inside core logic.

```python
# YES — validate at the boundary
def require_daily_series(payload: dict, key: str) -> list:
    series = payload.get("daily", {}).get(key)
    if not isinstance(series, list):
        raise ValueError(f"Missing daily.{key}")
    return series

# NO — defensive checks inside trusted code
def process_day(day: WeatherDay) -> float:
    if day.max_temperature_c is None:  # WeatherDay guarantees this is float
        return 0.0
```

### Database writes

- `CREATE TABLE IF NOT EXISTS` — never `DROP TABLE`.
- `INSERT OR REPLACE` — upsert on primary key. History accumulates.
- One connection per operation. Use `with duckdb.connect() as conn:`.

### Function shape

Functions are `Input → Output`. Side effects (logging, DB writes) live in `main()`
or at the outermost call site. Core logic is pure.

```python
# YES
def fetch_history() -> list[WeatherDay]: ...
def store_history(rows: list[WeatherDay]) -> None: ...
def main():
    rows = fetch_history()
    store_history(rows)

# NO
def fetch_and_store(): ...  # mixing IO concerns
```

## dbt (data-pipeline/models/)

### Naming

| Layer | Prefix | Materialization | Purpose |
|-------|--------|-----------------|---------|
| Staging | `stg_` | view | Type casting, rename to stable contract |
| Mart | descriptive name | table or incremental | Aggregation, business logic |

No `fct_` or `dim_` prefixes unless the project grows to need them.

### SQL style

- Lowercase keywords (`select`, not `SELECT`).
- CTEs over subqueries. One responsibility per CTE.
- `snake_case` for all column names. The frontend handles casing.
- No `SELECT *`. List columns explicitly.

### Model rules

- Every mart model must be referenced by a frontend query or another model.
  No orphan models.
- Use `LEFT JOIN ... ON TRUE` (not `CROSS JOIN`) when joining single-row CTEs
  to preserve rows when the joined CTE is empty.
- Incremental models must document what triggers re-processing.

## TypeScript (frontend/)

### Types

- Types live in `$lib/weather.ts`. They are passive data shapes — no methods.
- `camelCase` for all fields. SQL aliases do the translation.
- Types must match query output exactly. No extra fields. If the query returns
  3 columns, the type has 3 fields.

```typescript
// YES — matches the SQL query output
export type WeatherObservation = {
    weatherDate: string;
    maxTemperatureC: number;
    precipitationMm: number;
};

// NO — kitchen-sink type with unused fields
export type WeatherObservation = {
    weatherDate: string;
    latitude: number;      // never rendered
    longitude: number;     // never rendered
    timezone: string;      // never rendered
    ...
};
```

### Database access

- One connection per request. Open in `loadDashboard()`, close in `finally`.
- Queries are `const` string literals. No query builders.
- All queries live in `$lib/server/weather.ts`. Route files call exported functions.

### Server load functions

- `+page.server.ts` is a thin call-through to `$lib/server/`. No logic.
- Return type is the exact shape the page component expects.

## Svelte (frontend/src/routes/)

### Components are presentational

- No aggregation. No `.reduce()`. No `$derived` math over arrays.
- `$derived` is for simple bindings: `let x = $derived(data.x)`.
- If you need to compute a value, add it to the dbt model or the server query.

### Props

- Destructure `data` from `$props()`. Type it explicitly.
- Use `?.` and `?? '—'` for nullable summary fields.

### Scoped CSS

- All styles are `<style>` scoped to the component. No global utility classes.
- Use semantic class names (`.metric-card`, `.panel`), not utility-first.
- Prefer CSS custom properties or raw values over Tailwind utilities in component styles.

## Anti-Patterns

These are things that were in the codebase and were removed. Do not re-introduce them.

| Anti-pattern | Why it's wrong | What to do instead |
|---|---|---|
| `DROP TABLE` + `CREATE TABLE` on every run | Destroys history | `CREATE TABLE IF NOT EXISTS` + `INSERT OR REPLACE` |
| Client-side `.reduce()` for metrics | Computation in the wrong layer | dbt model or SQL aggregation |
| `SELECT *` / fetching unused columns | Over-serialization, type drift | Explicit column list matching the type |
| New DB connection per query | Wasteful for file-based DB | Single connection, multiple queries |
| Mixed `camelCase`/`snake_case` in TS types | Inconsistency across files | `camelCase` always, SQL aliases translate |
| POC/implementation text in UI | Exposes internals to users | User-facing labels only |
| Passthrough dbt models (`SELECT * ORDER BY`) | Zero transformation value | Delete or add real logic |
| Defensive null checks inside trusted code | Violates High-Trust contract | Validate at boundaries only |
