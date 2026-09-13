// The Packmates mark: a map pin with a pack of three inside it.
//
// Inline SVG rather than an emoji, so it looks the same on every device
// instead of whatever 🏃 happens to be on that platform. The same geometry
// builds the home-screen icons in scripts/generate-icons.mjs; change one,
// change the other.
/** Which way round the mark is drawn.
 *
 * "gradient" (default) is a gradient drop with white figures, for light
 * surfaces like the nav. "white" inverts it, which is what the purple page
 * background needs: the gradient version shares its colours with that
 * background, so the top of the drop dissolves into it and only the
 * magenta half stays visible. The app icon is the white version too. */
export default function Logo({
  size = 26,
  className = "",
  variant = "gradient",
}: {
  size?: number;
  className?: string;
  variant?: "gradient" | "white";
}) {
  const white = variant === "white";
  const dropFill = white ? "#fff" : "url(#packmates-mark)";
  const figureFill = white ? "#9333ea" : "#fff";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Packmates"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="packmates-mark" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="45%" stopColor="#9333ea" />
          <stop offset="75%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
      </defs>
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
