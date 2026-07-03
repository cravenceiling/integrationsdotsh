import type { APIRoute } from "astro";

export const prerender = true;

const SITEMAPS = ["sitemap-0.xml", "sitemap-surfaces.xml"] as const;

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error("Missing Astro site config for sitemap.xml");
  }

  const entries = SITEMAPS.map((path) => {
    const loc = new URL(`/${path}`, site).href;
    return `  <sitemap><loc>${escapeXml(loc)}</loc></sitemap>`;
  });

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</sitemapindex>\n`,
    {
      headers: { "content-type": "application/xml; charset=utf-8" },
    },
  );
};
