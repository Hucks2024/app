import type { ReactNode } from "react";

// Every meetup in the app is a ticket: the app's violet-to-pink on top (or
// down the left, in a list), a notch cut out of each side where it would
// tear, and a dashed line across. The map card, the list under the map,
// Me and the meetup page all use these, so a meetup looks the same
// wherever it turns up. Styles in globals.css (.ticket and friends).

/** The coloured top of a ticket: the meetup's emoji in a white tile, its
 * type over the title. Grey once it's been called off. */
export function TicketHead({
  emoji,
  kind,
  off = false,
  children,
}: {
  emoji: string;
  kind?: string;
  off?: boolean;
  // The title, as whatever element suits the page (an h1 on its own page).
  children: ReactNode;
}) {
  return (
    <div className={`ticket-head ${off ? "ticket-off" : ""}`}>
      <span className="ticket-emoji" aria-hidden="true">
        {emoji}
      </span>
      <div className="min-w-0">
        {kind && <p className="ticket-kind">{kind}</p>}
        {children}
      </div>
    </div>
  );
}

/** A ticket on its side, for lists: the emoji on a coloured stub, the
 * details beside it. */
export function TicketRow({
  emoji,
  off = false,
  small = false,
  children,
}: {
  emoji: string;
  off?: boolean;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`ticket-row meetup-row ${small ? "ticket-row-sm" : ""}`}>
      <span className={`ticket-stub ${off ? "ticket-off" : ""}`} aria-hidden="true">
        <span className="ticket-emoji">{emoji}</span>
      </span>
      <div className="ticket-main">{children}</div>
    </div>
  );
}
