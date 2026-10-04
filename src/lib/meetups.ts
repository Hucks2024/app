// Which meetups are "on": not called off, and run by somebody who's still
// allowed in. A cancelled meetup, or one whose host has been banned or
// suspended, comes off the map, the list and every count at once, and
// doesn't count for thumbs up, red flags or unlocking posting either,
// because it didn't happen.
export const liveMeetup = {
  cancelledAt: null,
  host: { accountStatus: "ACTIVE" },
} as const;
