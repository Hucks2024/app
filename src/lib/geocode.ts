// Turns the place a host types ("Riverside Park, main entrance") into a
// map pin, using OpenStreetMap's free services. No API key, no account.
//
// Nominatim first. Its usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) wants a
// descriptive User-Agent and no more than about one request a second,
// which "someone posts a meetup" traffic never comes near. If it doesn't
// answer, or finds nothing, Photon (komoot's geocoder over the same
// OpenStreetMap data) is asked too, so one service having a bad day
// doesn't stop anybody posting.
//
// The answer says which of three things happened, because they need
// different words to the host: found (with a short name for the place, so
// they can see it's the right one), not found (try adding the town), or
// unavailable (try again in a minute).
//
// Runs in two places. The posting form calls it from the host's own
// browser first (both services allow that), so the lookup comes from
// their connection, not ours, and a service rate-limiting or blocking our
// server can't stop anyone posting. The server runs it again only if the
// browser couldn't.

export type GeocodeResult =
  | { status: "found"; latitude: number; longitude: number; label: string }
  | { status: "not_found" }
  | { status: "unavailable" };

const USER_AGENT = "Packmates/1.0 (packmates.live)";

/** Nominatim asks servers to say who they are. A browser can't set the
 * User-Agent (and trying would make the request fail its CORS check), and
 * sends the page it's on instead, which does the same job. */
function headers(extra: Record<string, string> = {}): Record<string, string> {
  return typeof window === "undefined" ? { "User-Agent": USER_AGENT, ...extra } : extra;
}

/** "Hyde Park, City of Westminster, London, Greater London, England, …"
 * down to the first three parts, which is plenty to recognise it by. */
function shortLabel(parts: (string | undefined)[]): string {
  return [...new Set(parts.filter((p): p is string => Boolean(p && p.trim())))]
    .slice(0, 3)
    .join(", ");
}

async function nominatim(query: string): Promise<GeocodeResult> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      headers: headers({ "Accept-Language": "en" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: "unavailable" };
    const results = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    const first = results[0];
    if (!first) return { status: "not_found" };
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { status: "not_found" };
    return {
      status: "found",
      latitude,
      longitude,
      label: shortLabel((first.display_name ?? query).split(",").map((s) => s.trim())),
    };
  } catch {
    return { status: "unavailable" };
  }
}

async function photon(query: string): Promise<GeocodeResult> {
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");
    url.searchParams.set("lang", "en");
    const res = await fetch(url, {
      headers: headers(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: "unavailable" };
    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: { name?: string; street?: string; city?: string; state?: string; country?: string };
      }>;
    };
    const first = data.features?.[0];
    const [longitude, latitude] = first?.geometry?.coordinates ?? [];
    if (!first || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { status: "not_found" };
    }
    const p = first.properties ?? {};
    return {
      status: "found",
      latitude: latitude as number,
      longitude: longitude as number,
      label: shortLabel([p.name, p.street, p.city, p.state, p.country]) || query,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function geocodeLocation(query: string): Promise<GeocodeResult> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "not_found" };

  const first = await nominatim(trimmed);
  if (first.status === "found") return first;
  // Photon's search is more forgiving of typos and half-names, so it gets
  // a go when Nominatim found nothing as well as when it didn't answer.
  const second = await photon(trimmed);
  if (second.status === "found") return second;
  // Only "unavailable" if neither could say: one clear "no such place"
  // beats a vague "try again".
  return first.status === "not_found" || second.status === "not_found"
    ? { status: "not_found" }
    : { status: "unavailable" };
}
