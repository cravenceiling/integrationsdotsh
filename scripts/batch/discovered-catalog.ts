import type { AuthStatus, StoredDiscovery, Surface } from "../../src/lib/discovery-schema.ts";
import { canonicalDomain } from "../../src/lib/domain-aliases.ts";

export type CatalogPackage = {
  registryType: string;
  identifier: string;
  runtimeHint?: string;
};

export type CatalogSurface = {
  slug: string;
  name: string;
  type: Surface["type"];
  url?: string;
  spec?: string;
  command?: string;
  packages?: CatalogPackage[];
  authStatus: AuthStatus["status"];
};

export type CatalogDomain = {
  domain: string;
  description?: string;
  summary: string;
  discoveredAt?: string;
  surfaces: CatalogSurface[];
};

export type Catalog = {
  domains: CatalogDomain[];
};

export type CatalogMergeStats = {
  new: number;
  updated: number;
  unchanged: number;
};

export type CatalogMergeResult = {
  catalog: Catalog;
  stats: CatalogMergeStats;
  changes: Array<{ kind: "new" | "updated"; domain: string; previousDiscoveredAt?: string; nextDiscoveredAt?: string }>;
};

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function authStatusValue(value: unknown): AuthStatus["status"] {
  return value === "none" || value === "required" || value === "unknown" ? value : "unknown";
}

function compactPackages(value: unknown): CatalogPackage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const packages = value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const registryType = stringValue(item.registryType);
    const identifier = stringValue(item.identifier);
    if (!registryType || !identifier) return [];
    const runtimeHint = stringValue(item.runtimeHint);
    return [{ registryType, identifier, ...(runtimeHint ? { runtimeHint } : {}) }];
  });
  return packages.length ? packages : undefined;
}

export function compactSurface(surface: Surface): CatalogSurface {
  const out: CatalogSurface = {
    slug: surface.slug,
    name: surface.name,
    type: surface.type,
    authStatus: surface.auth.status,
  };
  if ("url" in surface && surface.url) out.url = surface.url;
  if ("spec" in surface && surface.spec) out.spec = surface.spec;
  if (surface.type === "cli") {
    if (surface.command) out.command = surface.command;
    if (surface.packages?.length) out.packages = compactPackages(surface.packages);
  }
  return out;
}

function compactLooseSurface(value: unknown): CatalogSurface | null {
  if (!isRecord(value)) return null;
  const slug = stringValue(value.slug);
  const name = stringValue(value.name);
  const rawType = stringValue(value.type);
  if (!slug || !name || !rawType) return null;
  const type = rawType === "openapi" || rawType === "rest" ? "http" : rawType;
  if (type !== "http" && type !== "graphql" && type !== "mcp" && type !== "cli") return null;

  const auth = isRecord(value.auth) ? authStatusValue(value.auth.status) : authStatusValue(value.authStatus);
  const out: CatalogSurface = { slug, name, type, authStatus: auth };
  const url = stringValue(value.url);
  const spec = stringValue(value.spec);
  const command = stringValue(value.command);
  if (url) out.url = url;
  if (spec) out.spec = spec;
  if (type === "cli") {
    if (command) out.command = command;
    const packages = compactPackages(value.packages);
    if (packages) out.packages = packages;
  }
  return out;
}

export function catalogDomainFromStored(stored: StoredDiscovery): CatalogDomain | null {
  const result = stored.result;
  const surfaces = (result.surfaces ?? []).map(compactSurface);
  if (surfaces.length === 0) return null;
  return {
    domain: result.domain.toLowerCase(),
    description: result.description,
    summary: result.summary,
    discoveredAt: stored.discoveredAt || result.discoveredAt,
    surfaces,
  };
}

export function catalogDomainFromLooseStored(value: unknown, fallbackDomain?: string): CatalogDomain | null {
  if (!isRecord(value)) return null;
  const result = isRecord(value.result) ? value.result : value;
  const domain = stringValue(result.domain) ?? fallbackDomain;
  if (!domain) return null;
  const surfaces = (Array.isArray(result.surfaces) ? result.surfaces : []).flatMap((surface) => {
    const compact = compactLooseSurface(surface);
    return compact ? [compact] : [];
  });
  if (surfaces.length === 0) return null;
  const summary = stringValue(result.summary) ?? stringValue(result.description) ?? `${domain.toLowerCase()} integration surfaces`;
  const discoveredAt = stringValue(value.discoveredAt) ?? stringValue(result.discoveredAt);
  return {
    domain: domain.toLowerCase(),
    description: stringValue(result.description),
    summary,
    ...(discoveredAt ? { discoveredAt } : {}),
    surfaces,
  };
}

function discoveredTime(domain: CatalogDomain): number {
  if (!domain.discoveredAt) return 0;
  const time = Date.parse(domain.discoveredAt);
  return Number.isFinite(time) ? time : 0;
}

function stableDomainJson(domain: CatalogDomain): string {
  return JSON.stringify(domain);
}

export function mergeCatalogs(existing: Catalog, incomingDomains: readonly CatalogDomain[]): CatalogMergeResult {
  const byCanonical = new Map<string, CatalogDomain>();
  for (const domain of existing.domains ?? []) {
    const key = canonicalDomain(domain.domain);
    const prior = byCanonical.get(key);
    if (!prior || discoveredTime(domain) > discoveredTime(prior)) byCanonical.set(key, domain);
  }

  const stats: CatalogMergeStats = { new: 0, updated: 0, unchanged: 0 };
  const changes: CatalogMergeResult["changes"] = [];
  const touched = new Set<string>();

  for (const incoming of incomingDomains) {
    const key = canonicalDomain(incoming.domain);
    touched.add(key);
    const prior = byCanonical.get(key);
    if (!prior) {
      byCanonical.set(key, incoming);
      stats.new++;
      changes.push({ kind: "new", domain: incoming.domain, nextDiscoveredAt: incoming.discoveredAt });
      continue;
    }

    const priorTime = discoveredTime(prior);
    const incomingTime = discoveredTime(incoming);
    const incomingChanged = stableDomainJson(prior) !== stableDomainJson(incoming);
    if (incomingTime > priorTime || (incomingTime === priorTime && incomingTime > 0 && incomingChanged)) {
      byCanonical.set(key, incoming);
      stats.updated++;
      changes.push({
        kind: "updated",
        domain: incoming.domain,
        previousDiscoveredAt: prior.discoveredAt,
        nextDiscoveredAt: incoming.discoveredAt,
      });
    } else {
      stats.unchanged++;
    }
  }

  for (const key of byCanonical.keys()) {
    if (!touched.has(key)) stats.unchanged++;
  }

  const domains = [...byCanonical.values()].sort((a, b) => a.domain.localeCompare(b.domain));
  return { catalog: { domains }, stats, changes };
}
