/**
 * The REST API — defined once as an Effect HttpApi. The typed server and the
 * OpenAPI document (/openapi.json) both derive from this. Runs as a pure web
 * fetch handler on Cloudflare Workers.
 */
import { FileSystem, Layer, Path } from "effect";
import { Etag, HttpPlatform } from "effect/unstable/http";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import * as OpenApi from "effect/unstable/httpapi/OpenApi";
import { DetectionResult, DetectParams, runDetect } from "./operations.ts";

const Detect = HttpApiEndpoint.get("detect", "/api/:domain/detect", {
  params: DetectParams,
  success: DetectionResult,
});

export const Api = HttpApi.make("integrations.sh")
  .add(HttpApiGroup.make("detect", { topLevel: true }).add(Detect))
  .annotate(OpenApi.Title, "integrations.sh")
  .annotate(OpenApi.Version, "0.1.0")
  .annotate(
    OpenApi.Description,
    "Discover how to integrate with any service — APIs, MCP servers, GraphQL, CLIs — and detect what a domain exposes to agents.",
  );

const DetectGroup = HttpApiBuilder.group(Api, "detect", (handlers) =>
  handlers.handle("detect", (req: { readonly params: { readonly domain: string } }) => runDetect(req.params.domain)),
);

const Platform = Layer.mergeAll(Path.layer, Etag.layerWeak, HttpPlatform.layer).pipe(
  Layer.provideMerge(FileSystem.layerNoop({})),
);

const ApiLive = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide(DetectGroup),
  Layer.provide(Platform),
);

const built = HttpRouter.toWebHandler(ApiLive as never);
export const apiHandler = built.handler as (req: Request) => Promise<Response>;
