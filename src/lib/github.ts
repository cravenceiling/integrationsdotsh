// GitHub star count for the nav badge, resolved once per process and cached.
//
// Two contexts call this:
//  - build-time prerender: no worker env — fetch the GitHub API directly by
//    default (one call per build, module-cached), with a 1-hour file cache and
//    stale cache fallback when GitHub is unavailable. Set
//    INTEGRATIONS_SKIP_GITHUB_STARS=1 to skip the fetch for offline builds.
//  - worker SSR: read the baked /disc/meta.json through the ASSETS binding
//    (written at build from the same GitHub fetch), so runtime pages show the
//    same number as the prerendered ones without touching the GitHub API.

import { mkdir, readFile, writeFile } from "node:fs/promises";

const REPO = "UsefulSoftwareCo/integrationsdotsh";
const GITHUB_STARS_URL = `https://api.github.com/repos/${REPO}`;
const STARS_CACHE_DIR = "node_modules/.cache/integrationsdotsh";
const STARS_CACHE_FILE = `${STARS_CACHE_DIR}/github-stars.json`;
const STARS_CACHE_TTL_MS = 60 * 60 * 1000;
export const REPO_URL = `https://github.com/${REPO}`;

interface AssetsFetcher {
  fetch: (request: Request | string) => Promise<Response>;
}

let cached: Promise<number | null> | undefined;

async function readStarsCache(): Promise<{ stars: number; fetchedAt: number } | null> {
  try {
    const data = JSON.parse(await readFile(STARS_CACHE_FILE, "utf8")) as {
      stars?: unknown;
      fetchedAt?: unknown;
    };
    return typeof data.stars === "number" && typeof data.fetchedAt === "number"
      ? { stars: data.stars, fetchedAt: data.fetchedAt }
      : null;
  } catch {
    return null;
  }
}

async function writeStarsCache(stars: number): Promise<void> {
  try {
    await mkdir(STARS_CACHE_DIR, { recursive: true });
    await writeFile(STARS_CACHE_FILE, JSON.stringify({ stars, fetchedAt: Date.now() }));
  } catch {
    // Cache failures should never fail the build.
  }
}

async function fetchGitHubStars(): Promise<number | null> {
  try {
    const res = await fetch(GITHUB_STARS_URL, {
      headers: { "User-Agent": "integrations.sh-build", Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

async function fromGitHub(): Promise<number | null> {
  if (process.env.INTEGRATIONS_SKIP_GITHUB_STARS === "1") return null;
  const cache = await readStarsCache();
  if (cache && Date.now() - cache.fetchedAt < STARS_CACHE_TTL_MS) return cache.stars;
  const stars = await fetchGitHubStars();
  if (stars == null) return cache?.stars ?? null;
  await writeStarsCache(stars);
  return stars;
}

async function fromAssets(assets: AssetsFetcher): Promise<number | null> {
  try {
    const res = await assets.fetch("https://assets.local/disc/meta.json");
    if (!res.ok) return null;
    const meta = (await res.json()) as { stars?: number | null };
    return typeof meta.stars === "number" ? meta.stars : null;
  } catch {
    return null;
  }
}

export function getStars(env?: { ASSETS?: AssetsFetcher }): Promise<number | null> {
  cached ??= env?.ASSETS ? fromAssets(env.ASSETS) : fromGitHub();
  return cached;
}
