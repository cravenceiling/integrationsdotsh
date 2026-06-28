# integrations.sh — vocabulary

Working definitions. These appear in URLs, nav, schema fields, and generated
content. Status: services are settled; the access-path layer is deliberately
loose — we group by format instead of forcing a unifying noun.

## Launch scope (decided 2026-06-12)

v1 covers **official interfaces only**, in three formats: **OpenAPI (REST),
GraphQL, MCP**. CLIs, SDKs, community-maintained software, and the
vendor/community trust machinery are explicitly out of scope for launch —
they return later as their own chapter once the official layer is solid.
"Official" at launch means vendor-operated/vendor-published; nothing else is
listed, so no per-row origin signaling is needed.

The community layer is **designed now, rendered later** (see Contribution
below): the schema accommodates it from day one so adding it doesn't require
a remodel, but no community content ships in the launch UI.

## Contribution (post-launch pillar, schema-ready at launch)

A **contribution** is community-shared, agent-usable material attached to one
or more services. Kinds:

- **snippet** — a runnable piece of code showing what you can do with a
  service ("auto-label your Gmail inbox", "weekly Stripe revenue digest").
  Has `language`, `entry`, and `depends_on: [service…]`.
- **skill** — an agent skill (SKILL.md-style folder) that teaches an agent a
  workflow over one or more services.
- **connector** — community-maintained software (CLIs like gog, SDKs,
  unofficial MCP servers). The round-8 exploration (maintainer identity
  derived from the GitHub repo: avatar, org, stars) applies here.

Why this is safe to open up: trust is enforced at the **execution level**,
not the attribution level. Executor runs contributed code sandboxed, with a
**domain allowlist derived from `depends_on`** — a snippet that declares
Gmail can reach gmail.googleapis.com and nothing else. The registry's job is
to carry accurate `depends_on` edges and entry metadata so allowlists are
mechanically derivable; the runner's job is enforcement.

Schema implications at launch (cheap now, expensive later):
- every contribution carries `depends_on` service slugs — same edge the
  connector model already uses
- service records keep stable slugs (they're the foreign key everything
  references)
- `api.json` reserves a `contributions` field per service (empty at launch)

## Service

A network-addressable primitive an agent ultimately talks to: **Gmail**,
**Google Calendar**, **Todoist**, **Stripe**. A service owns:

- its API surface (REST/GraphQL endpoints, specs) — calling the API directly
  is always one of the ways to use a service, and it lives on the service
  page itself, not as a separate entity
- its **credential model** — which credential primitives it accepts, where to
  create them, scopes, gotchas

Services are the unit of authentication, and the only universally curated
entity. They are never compositions: "Google Workspace" is not a service;
Gmail is. A brand (Google) may appear as a namespace on service pages, but it
has no page of its own.

URL: `/gmail/`, `/todoist/` · Schema: `services/*.json`

## Access paths (no unifying noun — group by format)

The ways an agent reaches a service, listed on the service page grouped by
format. Deliberately not one entity kind, because they aren't one kind of
thing:

- **API (direct)** — the service's own REST/GraphQL surface. Not an entity;
  it's the service. Zero intermediary: credentials + HTTP.
- **MCP server** — a hosted endpoint or local stdio server. Has origin
  (vendor/community), endpoint or install, and `depends_on` services.
- **CLI** — installable software. Same metadata shape as MCP servers
  (origin, maintainer, install, depends_on) but consumed from a shell.
- **Code / SDK** — libraries and custom functions (a GitHub repo of scripts,
  an npm SDK). The loosest category; often just a repo link + depends_on.

Multi-service software (gog reaches Gmail + Calendar + Drive + …) gets its own
page under its format namespace, listing its dependencies. Single-service
entries may not need a page at all — a row on the service page can carry the
install line and repo link.

URL: `/mcp/github/`, `/cli/gog/` · Schema: `paths/*.json` (format field inside)

## Tool

The individual callable unit something exposes to an agent: `send-email`,
`list_issues`, `query-run`. Matches MCP's and Executor's usage. Tools are
data on a page (listed for MCP servers and CLIs), never pages themselves.

Never use "tool" for the software that exposes tools. The stripe CLI exposes
~50 tools; it is not itself a tool.

## Credential primitive

A reusable authentication mechanism explained once, site-wide: **API key**,
**OAuth 2.0 client**, **personal access token**, **service account**. Each has
an explainer page; service pages reference primitives and add only
service-specific facts (create-at URL, header template, scopes, one gotcha).

URL: `/auth/oauth2-client/`, `/auth/api-key/`

## Format

The shape of an access path: `rest`, `graphql`, `mcp`, `cli`, `sdk`. The
primary grouping users navigate by ("is there an MCP server for X?").

## Relationships

```
credential primitive  ←referenced by─  service  ─exposes→  API (direct)
                                          ↑
                                     depends_on
                                          │
                            MCP servers · CLIs · code/SDKs
                                  (each ─exposes→ tools)
```

Visitor questions map cleanly: "how do I authenticate to Gmail?" → service
page, CREDENTIALS. "Is there a Gmail MCP server?" → service page, grouped
access paths. "What does gog need?" → /cli/gog/, DEPENDS ON. "What's an OAuth
client?" → primitive page.
