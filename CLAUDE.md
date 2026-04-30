# Weather Ledger — Agent Instructions

## Toolchain (strict)

| Layer             | Tool  | NEVER use                    |
| ----------------- | ----- | ---------------------------- |
| Node / TypeScript | `bun` | `npm`, `npx`, `yarn`, `pnpm` |

Every command that touches the frontend must go through `bun`. There is no Python, dbt,
or DuckDB runtime left in this repo.

## Test commands

```sh
# Frontend unit tests
cd frontend && bun run test:unit

# Frontend typecheck
cd frontend && bun run check

# Frontend lint
cd frontend && bun run lint

# Frontend build
cd frontend && bun run build
```

## Environment variables

- `WEATHER_LEDGER_SQLITE_PATH` — overrides the SQLite path for the frontend server
- `WEATHER_LEDGER_HISTORY_START` — earliest date fetched for a newly cached location
- `WEATHER_LEDGER_DEFAULT_LOCATION_*` — overrides the seeded default location
- `PORT` — controls the Next.js port (default 3000)

## Architecture rules

### Data flow

```
Open-Meteo API → Next.js route handler → SQLite cache
                                          ↓
                             React server component page
```

- Route handlers fetch remote data and server helpers write it straight into SQLite.
- SQLite owns the persisted schema. Use `CREATE TABLE IF NOT EXISTS` and upserts.
- Server modules under `frontend/src/lib/server/` own persistence and read models.
- The dashboard page stays server-rendered. Client components are only for search and navigation.

### What goes where

| Concern                 | Where                                                                     | NOT here          |
| ----------------------- | ------------------------------------------------------------------------- | ----------------- |
| Remote HTTP calls       | `frontend/src/app/api/**`, `frontend/src/lib/server/open-meteo.ts`        | client components |
| Persistence             | `frontend/src/lib/server/sqlite.ts`, `frontend/src/lib/server/weather.ts` | route files       |
| Aggregation and shaping | server helpers                                                            | client components |
| Display formatting      | React components                                                          | SQLite schema     |

### Frontend types

- Types in `frontend/src/lib/weather.ts` must match what the server returns — no extra fields.
- All types use **camelCase**. The SQL query aliases handle `snake_case` → `camelCase`.
- Query only the columns the UI renders. Do not `SELECT *`.

## Project structure

```
frontend/        Next.js app (Bun + TypeScript)
database/        Shared weather.sqlite3 (gitignored)
docker-compose.yml
```

Key files most likely to need editing:

- `frontend/src/lib/server/weather.ts`
- `frontend/src/lib/server/open-meteo.ts`
- `frontend/src/lib/server/sqlite.ts`
- `frontend/src/app/page.tsx`
- `frontend/src/components/location-search-panel.tsx`


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
