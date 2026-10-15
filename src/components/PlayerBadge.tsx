import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { Level } from "@/lib/level";
import type { CurrentUser } from "@/lib/auth";

/** You, as the game piece: your face in a ring that fills with gold as
 * you earn points, and your level on a tag underneath. Sits in the map's
 * top corner and opens your level on Me. */
export default function PlayerBadge({
  user,
  level,
}: {
  user: Pick<CurrentUser, "id" | "profilePhotoType" | "photoUpdatedAt">;
  level: Level;
}) {
  const r = 26;
  const around = 2 * Math.PI * r;
  const filled = (around * level.into) / level.span;
  return (
    <Link
      href="/profile#level"
      className="player-badge"
      aria-label={`Level ${level.level}, ${level.title}. ${level.into} of ${level.span} points to the next level.`}
    >
      <svg viewBox="0 0 60 60" className="player-ring" aria-hidden="true">
        <circle cx="30" cy="30" r={r} className="player-ring-track" />
        {/* None yet, no gold: a round line end would leave a dot. */}
        {level.into > 0 && (
          <circle
            cx="30"
            cy="30"
            r={r}
            className="player-ring-fill"
            strokeDasharray={`${filled} ${around}`}
            transform="rotate(-90 30 30)"
          />
        )}
      </svg>
      <span className="player-face">
        <Avatar userId={user.id} hasPhoto={!!user.profilePhotoType} version={user.photoUpdatedAt} size={11} />
      </span>
      <span className="player-level" aria-hidden="true">
        Lv {level.level}
      </span>
    </Link>
  );
}
