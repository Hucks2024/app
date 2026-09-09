// Free, no-API-key geocoding via OpenStreetMap's Nominatim, used to turn the
// free-text "location" a host types (e.g. "Riverside Park, main entrance")
// into a lat/lng pin for the map view.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a descriptive User-Agent and caps free use at ~1 request/second,
// which comfortably covers "someone posts a run" traffic. Best-effort only —
// callers should treat a null result as "no pin", not an error.
export async function geocodeLocation(
  query: string
): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const res = await fetch(url, {
      headers: {
        // Nominatim rejects requests with no identifying User-Agent.
        "User-Agent": "Pacemates/1.0 (doyoulikepizza.com)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = results[0];
    if (!first) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    // Network hiccup, timeout, rate limit — none of these should block
    // someone from posting a run. They just won't get a map pin.
    return null;
  }
}
