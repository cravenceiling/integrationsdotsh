import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Provider } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CURATED = join(ROOT, "curated");

// Display order on the homepage: rough popularity, dev-tools first.
const ORDER = [
  "github", "linear", "stripe", "notion", "slack", "todoist",
  "sentry", "vercel", "supabase", "cloudflare", "posthog", "figma",
  "resend", "asana", "shopify", "spotify", "airtable", "discord",
];

export const providers: Provider[] = existsSync(CURATED)
  ? readdirSync(CURATED)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(CURATED, f), "utf8")) as Provider)
      .sort((a, b) => {
        const ia = ORDER.indexOf(a.slug);
        const ib = ORDER.indexOf(b.slug);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.name.localeCompare(b.name);
      })
  : [];

export const providerBySlug = new Map(providers.map((p) => [p.slug, p]));

/** Raw-catalog record id ("mcp/todoist") → curated provider that claims it. */
export const providerByRelatedId = new Map<string, Provider>();
for (const p of providers) {
  for (const id of p.related ?? []) providerByRelatedId.set(id, p);
}
