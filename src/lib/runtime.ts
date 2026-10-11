/** True when the app is running on Cloudflare Workers rather than a Node
 * server, the way Cloudflare says to tell. */
export const onCloudflare = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
