/**
 * The tool registry — write once, projected to MCP (here) and REST (the worker's
 * /api routes). Each tool declares its schema + handler once; the same handler
 * backs every transport. The `integrations` CLI is the local client.
 *
 * Runs as a pure web fetch handler (Effect v4), so it lives in the Cloudflare
 * Worker alongside the static site.
 */
import { Effect, Layer, Schema } from "effect";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { detect } from "../src/lib/detect.ts";

// ── tools ─────────────────────────────────────────────────────────────────────
const Detect = Tool.make("detect", {
  description:
    "Detect a domain's agent-readiness: well-known manifests (api-catalog, MCP " +
    "server-card, agent-card, agent-skills, llms.txt) plus live capability " +
    "detection — MCP self-onboarding (DCR/CIMD) and the live OpenAPI schema.",
  parameters: Schema.Struct({ domain: Schema.String }),
  success: Schema.Unknown,
});

export const toolkit = Toolkit.make(Detect);

const HandlersLayer = toolkit.toLayer({
  detect: ({ domain }) => Effect.promise(() => detect(String(domain).trim().toLowerCase())),
} as never);

// ── MCP over HTTP at /mcp ─────────────────────────────────────────────────────
const McpLayer = Layer.mergeAll(
  McpServer.layerHttp({ name: "integrations.sh", version: "0.1.0", path: "/mcp" }),
  McpServer.toolkit(toolkit),
).pipe(Layer.provide(HandlersLayer));

const mcp = HttpRouter.toWebHandler(McpLayer as never);
export const mcpHandler = mcp.handler as (req: Request) => Promise<Response>;
