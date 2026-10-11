// The Worker Cloudflare runs (wrangler.jsonc "main"): OpenNext's, with one
// change to every page. "no-transform" tells Cloudflare not to rewrite
// pages on their way out, so it can't add scripts of its own to them, like
// its visitor-tracking beacon: the app promises no analytics.
import handler from "./.open-next/worker.js";

export default {
  async fetch(request, env, ctx) {
    const response = await handler.fetch(request, env, ctx);
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
    const page = new Response(response.body, response);
    const cacheControl = page.headers.get("cache-control");
    page.headers.set("cache-control", cacheControl ? `${cacheControl}, no-transform` : "no-transform");
    return page;
  },
};
