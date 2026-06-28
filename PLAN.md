# integrations.sh — product plan

*Last updated: 2026-06-12. This doc captures the product shape and the path from
demo to launch. The demo (this repo, `bun run dev`) is the source of truth for
look & feel; this doc is the source of truth for what comes next.*

## Thesis

Agents are only as useful as what they can reach. The services they need expose
a fragmented mess of interfaces — MCP servers, REST/OpenAPI, GraphQL, CLIs —
and that fragmentation is fine; what's missing is the **map**: one place that
says "here is everything {provider} exposes, and here is exactly how to
authenticate to each interface."

Auth is the bet. Discovery takes a minute; auth takes an hour. Every curated
page leads with a grounded, cited, dated auth guide.

## Product shape (built in this demo)

- **`/` homepage** — vision statement, instant search, format counts, curated
  provider grid, agent-readable registry callout, Executor band.
- **`/<provider>/` curated pages** (e.g. `/todoist/`) — the SEO asset. Connect
  tabs (Claude Code / Cursor / Executor / curl), grounded auth guide with
  citations + verified date, interface cards with endpoints/auth/docs, links
  down into the raw catalog.
- **`/browse/`** — the full raw catalog (3.6k records), client-side search +
  kind filters over `/api.json`, popularity-sorted, URL-addressable state.
- **`/<kind>/<slug>/`** raw pages — one per catalog record, with derived
  connect snippets where the data allows, and an upsell banner to the curated
  page when one exists.
- **`/vision/`** — the narrative, for humans and for backlinks.
- **`/api.json`** — the whole registry as one JSON file. The page you read and
  the data your agent fetches are the same content.

Two-layer data model:
- **Raw catalog** (`output/*.json`, from `scripts/normalize.ts`): aggregated
  feeds, noisy by design, breadth.
- **Curated providers** (`curated/*.json`, schema in `src/lib/types.ts`,
  spec in `curated/GENERATION.md`, validator in `scripts/validate-curated.ts`):
  one record per company, every interface, grounded auth guide. Quality.
  The 12 records currently in the repo are demo seeds.

## Content pipeline (next, not yet built)

Curated records must come from a **repeatable cheap-model batch pipeline**, not
hand-editing and not main-loop agent work:

1. **Select** the next N providers by demand signal (catalog popularity,
   search-console queries once live, Executor telemetry).
2. **Gather** grounding per provider with plain fetches: official docs pages
   (auth, MCP, API reference), plus catalog hints (known remote URLs, auth
   types) as leads.
3. **Generate** with a cheap model (e.g. Gemini 2.5 Flash — API key in Rhys's
   1Password) using `curated/GENERATION.md` as the system prompt, emitting the
   `Provider` JSON schema.
4. **Verify** mechanically: `validate-curated.ts` (schema, citation presence,
   placeholder-not-credential checks) + live MCP endpoint probes (the
   unauthenticated `initialize` POST → 401-with-WWW-Authenticate = OAuth,
   200 = authless). Only probed records get `verified: true`.
5. **Review** diffs in PRs — generated records land as commits, never directly
   to prod.
6. **Refresh** on a schedule (monthly, or when a probe starts failing), with
   `generatedAt` exposed on-page so staleness is honest.

## Data noise strategy

- Keep the raw layer raw; never hand-fix records. Fix the **pipeline**
  (normalize.ts dedup rules, version-collapsing for OpenAPI specs like
  GitHub's 20 GHES versions, favicon fallbacks).
- The curated layer is the noise answer users see: search ranks curated first.
- Add a quality score per raw record (has icon, has live endpoint, has tools,
  feed count) and use it for default sort/filtering.
- Grow sources: MCP registry (registry.modelcontextprotocol.io), fig
  completion specs (CLI surface), skills.sh (skills), Google Discovery.

## SEO strategy

- Target queries: "{provider} api auth", "{provider} mcp server",
  "connect {agent} to {provider}". Curated pages are the landing pages.
- Static HTML, canonical URLs, TechArticle JSON-LD with dateModified, fast
  pages — all in place in the demo. Add a sitemap and per-kind hub pages next.
- Long-tail raw pages (3.6k indexed) catch breadth queries and funnel up to
  curated pages via the banner.
- The Executor band on every funnel surface is the conversion path:
  integrations.sh is the top of Executor's funnel.

## Executor integration

- Connect tabs include an Executor snippet on every page where a source is
  derivable (`addSource` with the spec/endpoint).
- Worker already tracks `executor` user-agent hits in PostHog — the registry
  is designed to be read by Executor itself for in-product source search.
- Next: an `executor add integrations.sh/<provider>` deep-link format agreed
  with the Executor CLI, and a `?from=integrations.sh` attribution param.

## Open questions

- Naming: "curated" vs "verified" vs "providers" for the clean layer.
- Whether `/api.json` should split into `/api/providers.json` (curated) and
  `/api/catalog.json` (raw) as the curated layer grows.
- CLI ingestion: fig specs are 600+ commands — separate kind (`cli`) in the
  raw catalog, or curated-only until demand shows up?
