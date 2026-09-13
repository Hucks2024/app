// The Packmates mark: a map pin with a pack of three inside it.
//
// Inline SVG rather than an emoji, so it looks the same on every device
// instead of whatever 🏃 happens to be on that platform. The same geometry
// builds the home-screen icons in scripts/generate-icons.mjs; change one,
// change the other.

/** The one brand colour. The nav bar, the map pins and the app icon are
 *  all this violet, and it's the top stop of the page gradient in
 *  globals.css, so the mark never disagrees with what's behind it.
 *  Exported so the map markers, which are built as raw SVG strings for
 *  Leaflet, can't quietly drift away from it. */
export const BRAND = "#6d28d9";

/** Which way round the mark is drawn.
 *
 * "brand" (default) is a violet drop with white figures, for light
 * surfaces. "white" inverts it, a white drop with violet figures, which
 * is what the violet nav and the purple page background need: violet on
 * violet has nothing to stand against. */
export default function Logo({
  size = 26,
  className = "",
  variant = "brand",
}: {
  size?: number;
  className?: string;
  variant?: "brand" | "white";
}) {
  const white = variant === "white";
  const dropFill = white ? "#fff" : BRAND;
  const figureFill = white ? BRAND : "#fff";
  return (
    <svg
      width={size * (240 / 344)}
      height={size}
      viewBox="136 74 240 344"
      role="img"
      aria-label="Packmates"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M256 74 q-120 0 -120 120 q0 90 120 224 q120 -134 120 -224 q0 -120 -120 -120 Z"
        fill={dropFill}
      />
      <g fill={figureFill}>
        <g transform="translate(256 236) scale(0.62)">
          <circle cx="0" cy="-78" r="32" />
          <path d="M0 -34 Q40 -34 44 12 Q48 52 38 66 Q20 74 0 74 Q-20 74 -38 66 Q-48 52 -44 12 Q-40 -34 0 -34 Z" />
        </g>
        <g transform="translate(186 250) scale(0.48)">
          <circle cx="0" cy="-78" r="32" />
          <path d="M0 -34 Q40 -34 44 12 Q48 52 38 66 Q20 74 0 74 Q-20 74 -38 66 Q-48 52 -44 12 Q-40 -34 0 -34 Z" />
        </g>
        <g transform="translate(326 250) scale(0.48)">
          <circle cx="0" cy="-78" r="32" />
          <path d="M0 -34 Q40 -34 44 12 Q48 52 38 66 Q20 74 0 74 Q-20 74 -38 66 Q-48 52 -44 12 Q-40 -34 0 -34 Z" />
        </g>
      </g>
    </svg>
  );
}
