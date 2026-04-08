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
    ↓  Next.js route handler / server helper (boundary: HTTP → SQLite)
SQLite cache
    ↓
React server component page (boundary: SQLite → JSX)
    ↓
Client components (search and navigation only)
```

### Who Owns What

| Concern                  | Owner                                              | Examples                                         |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------ |
| External API interaction | `frontend/src/lib/server/open-meteo.ts`            | HTTP calls, query construction, response parsing |
| Schema definition        | `frontend/src/lib/server/sqlite.ts`                | `CREATE TABLE`, indexes, pragmas                 |
| Persistence              | `frontend/src/lib/server/weather.ts`               | upserts, read queries, server-side shaping       |
| Aggregation              | server helpers or SQL                              | `SUM`, `AVG`, `MAX`, derived summaries           |
| Display formatting       | React components                                   | `toFixed(1)`, labels, empty states               |
| Client-side computation  | Client components only when interaction demands it | search state, router transitions                 |

## TypeScript (frontend/)

### Types

- Types live in `src/lib/weather.ts`. They are passive data shapes — no methods.
- `camelCase` for all fields.
- Types must match the server return shape exactly. No extra fields.

```typescript
// YES — matches the server return shape
export type WeatherObservation = {
    weatherDate: string;
    maxTemperature: number;
    minTemperature: number;
    precipitation: number;
};

// NO — kitchen-sink type with unused fields
export type WeatherObservation = {
    weatherDate: string;
    latitude: number;
    longitude: number;
    timezone: string;
    ...
};
```

### Database access

- Keep SQLite access in `src/lib/server/` only.
- Use `CREATE TABLE IF NOT EXISTS` and upserts. Never rebuild the database from scratch.
- Prefer straightforward SQL strings and prepared statements over abstractions.

### Server boundaries

- Route handlers and server helpers own all external IO.
- Return the exact shape the page or client component expects.
- Validate inbound request payloads at the route boundary.

## React and Next.js (frontend/src/)

### Components are presentational by default

- Server components should read already-shaped data and render it.
- Client components should handle interaction state, not persistence.
- If you need a metric or aggregation, compute it in a server helper or SQL.

### Hooks and state

- Prefer `useDeferredValue` and `useTransition` for UI interactions when they fit naturally.
- Keep search and router state local to the interactive component.
- Avoid inventing client-side caches when SQLite already owns persistence.

### Styling

- Use CSS modules or global CSS with semantic class names.
- Prefer CSS custom properties over ad hoc one-off values where reuse is obvious.
- Preserve the repo’s visual direction: warm surfaces, clear contrast, and intentional typography.

## Anti-Patterns

These are things that were in the codebase and were removed. Do not re-introduce them.

| Anti-pattern                                     | Why it's wrong                         | What to do instead                                  |
| ------------------------------------------------ | -------------------------------------- | --------------------------------------------------- |
| Reintroducing Python/dbt/DuckDB stages           | Restores the complexity we removed     | Fetch and persist directly from Next.js server code |
| Client-side metric calculations                  | Puts domain logic in the wrong layer   | Compute in server helpers or SQL                    |
| `SELECT *` / fetching unused columns             | Over-serialization and type drift      | Explicit column lists matching the type             |
| Dropping and recreating SQLite tables            | Destroys history and local cache value | `CREATE TABLE IF NOT EXISTS` + upserts              |
| Mixing server persistence into client components | Breaks the IO boundary                 | Use route handlers or server modules                |
| Defensive null checks inside trusted core logic  | Violates High-Trust contract           | Validate at boundaries only                         |
