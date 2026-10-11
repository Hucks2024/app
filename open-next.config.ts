import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page that changes is drawn fresh for each visit (it depends on who's
// signed in), so the only cached pages are the ones built once, like Terms:
// served straight from the files, nothing else to pay for.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
