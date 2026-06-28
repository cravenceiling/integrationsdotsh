// Validate curated/<slug>.json provider records against the spec in
// curated/GENERATION.md, and compute the `related` field deterministically
// by joining against the raw catalog (output/index.json).
//
// Usage:
//   bun scripts/validate-curated.ts            # all records
//   bun scripts/validate-curated.ts todoist    # one record
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Provider } from "../src/lib/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CURATED = join(ROOT, "curated");
const INDEX = join(ROOT, "output", "index.json");

interface IndexRecord {
  id: string;
  kind: string;
  slug: string;
  name: string;
  url?: string;
  popularity?: number;
}

const FORMATS = new Set(["mcp", "openapi", "graphql", "cli"]);
const AUTH_KINDS = new Set(["oauth", "api_key", "token", "none", "mixed"]);
const METHOD_TYPES = new Set(["oauth2", "api_key", "pat", "token", "none"]);

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Match catalog records to a provider: exact slug, slug prefix, or exact normalized name. */
function computeRelated(p: Provider, index: IndexRecord[]): string[] {
  const nameKey = normName(p.name);
  const ids = new Set<string>();
  for (const r of index) {
    if (
      r.slug === p.slug ||
      normName(r.name) === nameKey ||
      // openapi slugs look like "stripe-com"; match on the provider domain too
      r.slug === p.domain.replace(/\./g, "-")
    ) {
      ids.add(r.id);
    }
  }
  // Deterministic order: by kind then slug.
  return [...ids].sort();
}

function validate(slug: string, index: IndexRecord[]): string[] {
  const errors: string[] = [];
  const path = join(CURATED, `${slug}.json`);
  let p: Provider;
  try {
    p = JSON.parse(readFileSync(path, "utf8")) as Provider;
  } catch (e) {
    return [`invalid JSON: ${(e as Error).message}`];
  }

  const err = (m: string) => errors.push(m);

  if (p.slug !== slug) err(`slug "${p.slug}" must equal filename "${slug}"`);
  if (!p.name) err("missing name");
  if (!p.tagline) err("missing tagline");
  else if (p.tagline.length > 90) err(`tagline too long (${p.tagline.length} > 90)`);
  if (!p.description) err("missing description");
  if (!p.domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(p.domain)) err(`bad domain "${p.domain}"`);
  if (!Array.isArray(p.categories) || p.categories.length === 0) err("need ≥1 category");
  else for (const c of p.categories) {
    if (!/^[a-z0-9-]+$/.test(c)) err(`category "${c}" must be lowercase kebab-case`);
  }

  // auth
  if (!p.auth) err("missing auth");
  else {
    if (!p.auth.methods?.length) err("auth.methods empty");
    else for (const m of p.auth.methods) {
      if (!METHOD_TYPES.has(m.type)) err(`auth method type "${m.type}" invalid`);
      if (!m.label) err("auth method missing label");
    }
    if (!p.auth.guide || p.auth.guide.length < 200) err("auth.guide missing or too short (<200 chars)");
    if (p.auth.guide && !p.auth.guide.includes("```")) err("auth.guide must include at least one code block");
    if (!p.auth.sources?.length) err("auth.sources empty — guides must cite fetched pages");
    else for (const s of p.auth.sources) {
      if (!s.title || !/^https:\/\//.test(s.url ?? "")) err(`bad source: ${JSON.stringify(s)}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.auth.generatedAt ?? "")) err("auth.generatedAt must be YYYY-MM-DD");
  }

  // interfaces
  if (!p.interfaces?.length) err("need ≥1 interface");
  else for (const i of p.interfaces) {
    const tag = `interface "${i.name ?? "?"}"`;
    if (!FORMATS.has(i.format)) err(`${tag}: bad format "${i.format}"`);
    if (!i.name) err(`${tag}: missing name`);
    if (i.origin !== "vendor" && i.origin !== "community") {
      err(`${tag}: origin must be "vendor" or "community"`);
    }
    if (i.origin === "community" && !i.maintainer) {
      err(`${tag}: community interfaces must name a maintainer`);
    }
    if (!AUTH_KINDS.has(i.auth)) err(`${tag}: bad auth "${i.auth}"`);
    if (i.format !== "cli" && !i.endpoint && !i.install) {
      err(`${tag}: needs endpoint or install`);
    }
    if (i.endpoint && !/^https:\/\//.test(i.endpoint)) err(`${tag}: endpoint must be https`);
    if (i.specUrl && !/^https:\/\//.test(i.specUrl)) err(`${tag}: specUrl must be https`);
    if (i.authHeader && !/\{[a-z_]+\}/i.test(i.authHeader)) {
      err(`${tag}: authHeader must use a {placeholder}, never a literal credential`);
    }
  }

  // Recompute `related` from the catalog; the LLM never sets it.
  if (errors.length === 0 && existsSync(INDEX)) {
    const related = computeRelated(p, index);
    const current = JSON.stringify(p.related ?? []);
    if (current !== JSON.stringify(related)) {
      p.related = related;
      writeFileSync(path, JSON.stringify(p, null, 2) + "\n");
      console.log(`  ${slug}: related ← [${related.join(", ")}]`);
    }
  }

  return errors;
}

function main() {
  const index: IndexRecord[] = existsSync(INDEX)
    ? JSON.parse(readFileSync(INDEX, "utf8"))
    : [];
  const args = process.argv.slice(2);
  const slugs = args.length
    ? args
    : readdirSync(CURATED).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));

  let failed = 0;
  for (const slug of slugs) {
    const errors = validate(slug, index);
    if (errors.length) {
      failed++;
      console.error(`✗ ${slug}`);
      for (const e of errors) console.error(`    ${e}`);
    } else {
      console.log(`✓ ${slug}`);
    }
  }
  if (failed) {
    console.error(`\n${failed}/${slugs.length} records failed validation`);
    process.exit(1);
  }
  console.log(`\nall ${slugs.length} records valid`);
}

main();
