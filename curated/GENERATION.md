# Curated provider records — generation spec

This file is the prompt-of-record for generating `curated/<slug>.json` provider
records. Records are produced by LLM agents grounded in live fetches of official
documentation — never written from memory. Re-run generation any time; the spec
plus the validator (`scripts/validate-curated.ts`) define correctness.

## What a record is

One **provider** = one company/service, grouping every agent-callable interface
it exposes (MCP server, OpenAPI/REST, GraphQL, CLI) with a single grounded
"how to authenticate" guide. This is the curated layer over the raw catalog
(`output/*.json`); raw records stay machine-generated and noisy, curated
records are the product.

## Schema

Matches `Provider` in `src/lib/types.ts`:

```ts
interface Provider {
  slug: string;            // kebab-case, equals the filename
  name: string;            // brand name, correct casing
  tagline: string;         // ≤80 chars, agent-angle, no marketing fluff
  description: string;     // 1-3 sentences, what agents can DO with it
  domain: string;          // primary domain, e.g. "todoist.com"
  icon?: string;           // official favicon/logo URL, or google s2 fallback
  categories: string[];    // 1-3 lowercase kebab-case tags
  auth: {
    methods: { type: "oauth2"|"api_key"|"pat"|"token"|"none"; label: string; note?: string }[];
    guide: string;         // markdown, see style rules
    sources: { title: string; url: string }[];  // ONLY pages actually fetched
    generatedAt: string;   // YYYY-MM-DD of generation
    verified: boolean;     // true only if endpoints were probed (see below)
  };
  interfaces: {
    format: "mcp"|"openapi"|"graphql"|"cli";
    name: string;
    origin: "vendor"|"community"; // who maintains it — REQUIRED
    maintainer?: string;   // community only: org/user, e.g. "openclaw"
    repo?: string;         // community only: source repository URL
    endpoint?: string;     // MCP remote URL / REST base / GraphQL endpoint
    specUrl?: string;      // OpenAPI spec URL if known
    auth: "oauth"|"api_key"|"token"|"none"|"mixed";
    authHeader?: string;   // literal template, e.g. "Authorization: Bearer {token}"
    install?: string;      // install/run command for CLIs and stdio MCP servers
    docs?: string;
    note?: string;         // gotchas (non-standard headers, region splits, etc.)
  }[];
  links: { homepage?: string; docs?: string };
  // DO NOT set `related` — computed deterministically by the validator.
}
```

## Grounding rules (non-negotiable)

1. **Fetch before you write.** Every endpoint URL, auth header format, token
   prefix, console path, and scope name must come from a page you fetched this
   session. If you can't fetch a doc, omit the claim.
2. **`auth.sources` lists only pages you actually fetched** and used. 1-4 entries.
3. **Probe MCP endpoints** when listed. An unauthenticated `initialize` POST:
   - `401` + `WWW-Authenticate` header → OAuth-protected, endpoint is live
   - `200` with a result → authless, endpoint is live
   - DNS failure / 404 / HTML page → drop the endpoint or mark it unverified
   ```bash
   curl -s -X POST <endpoint> -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"0.0.1"}}}' -i
   ```
4. **`verified: true`** only if every `endpoint` in the record was probed or
   confirmed against an official doc fetched this session.
5. Prefer **official docs domains** (developer.x.com, docs.x.com, x.dev) over
   blogs, SEO farms, or community wikis.
6. **Vendor vs community is a per-interface fact — verify it.** `origin:
   "vendor"` only if the vendor itself publishes the interface (their docs
   domain, their GitHub org). Living in a vendor-named GitHub org but
   disclaiming official support (e.g. googleworkspace/cli) still counts as
   vendor, but quote the disclaimer in `note`. Everything else is
   `origin: "community"` with `maintainer` + `repo` set. Include a community
   interface only when it's clearly the popular choice (stars, adoption) —
   at most 1-2 per provider, and never present it as vendor-made.

## Auth guide style

- Markdown. Lead with the **fastest credible path** for an agent (usually
  hosted MCP + OAuth, or an API key), then the alternatives.
- Bold-label each path: `**Personal token (fastest):** …`
- Exactly one fenced code block per path, runnable as-is (use `$ENV_VAR`
  placeholders, never fake-looking real keys).
- Include a `claude mcp add …` one-liner when a hosted MCP server exists.
- Call out gotchas explicitly: non-Bearer headers (Linear), custom headers
  (Shopify, Notion's version header), region splits (PostHog), key-type
  confusion (PostHog phx vs phc), token expiry/rotation.
- Mention where in the vendor UI to create the credential, as a markdown link.
- 120-220 words. No marketing language. Write for someone wiring up an agent
  in the next five minutes.

## Catalog hints

The generator passes hints extracted from `output/mcp.json` / `output/index.json`
(known MCP remote URL, auth types, popularity). Treat hints as *leads to verify*,
not facts — the catalog data is noisy; official docs win every conflict.

## Output

Write valid JSON (no comments, no trailing commas) to `curated/<slug>.json`.
Then run `bun scripts/validate-curated.ts <slug>` and fix anything it reports.
