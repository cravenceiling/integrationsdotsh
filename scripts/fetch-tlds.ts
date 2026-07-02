/**
 * Refresh src/data/tlds.json from IANA's root-zone TLD list. Vendored (not
 * fetched at build) so builds are hermetic; re-run occasionally — new TLDs
 * appear a few times a year.
 *
 *   bun scripts/fetch-tlds.ts
 */
const IANA = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

const res = await fetch(IANA);
if (!res.ok) throw new Error(`IANA fetch failed: ${res.status}`);
const tlds = (await res.text())
  .split("\n")
  .map((l) => l.trim().toLowerCase())
  .filter((l) => l && !l.startsWith("#"));
if (tlds.length < 1000) throw new Error(`suspiciously few TLDs (${tlds.length}) — refusing to write`);

await Bun.write(new URL("../src/data/tlds.json", import.meta.url), JSON.stringify(tlds));
console.log(`wrote ${tlds.length} TLDs to src/data/tlds.json`);
