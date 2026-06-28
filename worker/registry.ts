/**
 * MCP projection — the same operations (worker/operations.ts), exposed as MCP
 * tools. Schema + handler are shared with the REST API; only the transport
 * differs. Served over HTTP at /mcp (via a Durable Object for session state).
 */
import { Layer } from "effect";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { DETECT_DESCRIPTION, DetectionResult, DetectParams, runDetect } from "./operations.ts";

const Detect = Tool.make("detect", {
  description: DETECT_DESCRIPTION,
  parameters: DetectParams,
  success: DetectionResult,
});

export const toolkit = Toolkit.make(Detect);

const HandlersLayer = toolkit.toLayer({
  detect: ({ domain }) => runDetect(domain),
} as never);

const McpLayer = Layer.mergeAll(
  McpServer.layerHttp({ name: "integrations.sh", version: "0.1.0", path: "/mcp" }),
  McpServer.toolkit(toolkit),
).pipe(Layer.provide(HandlersLayer));

const mcp = HttpRouter.toWebHandler(McpLayer as never);
export const mcpHandler = mcp.handler as (req: Request) => Promise<Response>;
