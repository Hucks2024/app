/** Set by src/proxy.ts on every page request.
 *
 * Its own module so the proxy, which runs on the edge runtime, can share
 * the name with the server components that read it without either one
 * dragging the other's imports along.
 */
export const PATHNAME_HEADER = "x-pathname";
