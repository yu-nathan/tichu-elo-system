import { InputError } from "./input.ts";
import type { RatingEntry } from "./elo.ts";

export const SEASON_TIMEZONE = "America/Los_Angeles";
export type Season = {
  id: number;
  label: string;
  startsAt: string | null;
  endsAt: string;
  timezone: typeof SEASON_TIMEZONE;
  status: "current" | "completed";
};

const calendar = new Intl.DateTimeFormat("en-US", {
  timeZone: SEASON_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});
const partsAt = (time: number) =>
  Object.fromEntries(
    calendar
      .formatToParts(time)
      .map(({ type, value }) => [type, Number(value)]),
  );

// Resolve local midnight through the named zone, rather than assuming a fixed UTC offset.
const midnight = (year: number, month: number) => {
  const local = Date.UTC(year, month - 1, 1);
  let instant = local;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsAt(instant);
    instant +=
      local -
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      );
  }
  return new Date(instant).toISOString();
};

export const currentSeasonId = (now = Date.now()) => {
  const { year, month } = partsAt(now);
  return Math.max(1, 2 + (year - 2027) * 2 + (month >= 7 ? 1 : 0));
};

export const getSeason = (id: number, now = Date.now()): Season => {
  const currentId = currentSeasonId(now);
  if (!Number.isSafeInteger(id) || id < 1 || id > currentId)
    throw new InputError("Invalid or unavailable season.");
  const year = 2027 + Math.floor((id - 2) / 2);
  const firstHalf = id % 2 === 0;
  return {
    id,
    label: `Season ${id}`,
    startsAt: id === 1 ? null : midnight(year, firstHalf ? 1 : 7),
    endsAt: midnight(firstHalf ? year : year + 1, firstHalf ? 7 : 1),
    timezone: SEASON_TIMEZONE,
    status: id === currentId ? "current" : "completed",
  };
};

export const getCurrentSeason = (now = Date.now()) =>
  getSeason(currentSeasonId(now), now);
export const getSeasons = (now = Date.now()) =>
  Array.from({ length: currentSeasonId(now) }, (_, index) =>
    getSeason(currentSeasonId(now) - index, now),
  );

export const parseSeasonId = (
  value: string | null,
  now = Date.now(),
): number | null => {
  if (value === null) return null;
  if (!/^[1-9]\d*$/.test(value)) throw new InputError("Invalid season ID.");
  return getSeason(Number(value), now).id;
};

export const isInSeason = (playedAt: string, season: Season) =>
  (season.startsAt === null || playedAt >= season.startsAt) &&
  playedAt < season.endsAt;

export const sortRatings = (entries: RatingEntry[]) =>
  entries.sort(
    (a, b) =>
      b.rating - a.rating || a.name.localeCompare(b.name) || a.id - b.id,
  );
export const rankedPlayers = (entries: RatingEntry[], season: Season) =>
  sortRatings(
    entries.filter((player) =>
      season.status === "completed"
        ? player.gamesPlayed > 0
        : !player.archivedAt,
    ),
  );

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: SEASON_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
export const seasonDateLabel = (season: Season) =>
  `${season.startsAt ? dateLabel(season.startsAt) : "Beginning"} – ${dateLabel(new Date(Date.parse(season.endsAt) - 1).toISOString())} · Pacific time`;
