## Project Configuration

- **Language**: TypeScript
- **Package Manager**: `bun` — NEVER use `npm`, `npx`, `yarn`, or `pnpm`
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, mcp

## Commands

```sh
bun run dev          # dev server
bun run build        # production build → build/
bun run preview      # run built server (bun ./build/index.js), port via PORT env var
bun run check        # svelte-check + tsc
bun run test:unit -- --run   # vitest (non-watch)
bun run test:e2e     # playwright (builds first; requires port 4173 free)
```

## E2E tests

`playwright.config.ts` runs `global-setup.ts` before the server starts.
`global-setup.ts` creates `/tmp/weather-ledger-test.duckdb` with seed data and sets
`process.env.WEATHER_LEDGER_DB_PATH`. The preview server is started with `PORT=4173`.
Do not skip globalSetup or point tests at the production DB.

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
