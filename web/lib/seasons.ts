import { InputError } from "./input.ts";
import type { RatingEntry } from "./elo.ts";

export const SEASON_TIMEZONE = "America/Los_Angeles";
export const SEASON_CADENCES = [
  { months: 1, label: "Monthly" },
  { months: 3, label: "Every 3 months" },
  { months: 6, label: "Every 6 months" },
  { months: 12, label: "Yearly" },
] as const;
export type SeasonCadence = (typeof SEASON_CADENCES)[number]["months"];
export type SeasonSettings = { cadenceMonths: SeasonCadence; revision: number };
export const DEFAULT_SEASON_CADENCE: SeasonCadence = 6;

export const parseSeasonCadence = (value: unknown): SeasonCadence => {
  if (!SEASON_CADENCES.some(({ months }) => months === value))
    throw new InputError("Choose a season cadence of 1, 3, 6, or 12 months.");
  return value as SeasonCadence;
};

export class SeasonSettingsConflict extends Error {}

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

// July 2026 anchors the original six-month Season 1. Earlier games remain
// in Season 1 for every cadence; subsequent boundaries use calendar months.
const boundary = (offset: number) => {
  const month = 6 + offset;
  return midnight(2026 + Math.floor(month / 12), (month % 12) + 1);
};

export const currentSeasonId = (
  now = Date.now(),
  cadence: SeasonCadence = DEFAULT_SEASON_CADENCE,
) => {
  const { year, month } = partsAt(now);
  return Math.max(
    1,
    1 + Math.floor(((year - 2026) * 12 + month - 7) / cadence),
  );
};

export const getSeason = (
  id: number,
  now = Date.now(),
  cadence: SeasonCadence = DEFAULT_SEASON_CADENCE,
): Season => {
  const currentId = currentSeasonId(now, cadence);
  if (!Number.isSafeInteger(id) || id < 1 || id > currentId)
    throw new InputError("Invalid or unavailable season.");
  return {
    id,
    label: `Season ${id}`,
    startsAt: id === 1 ? null : boundary((id - 1) * cadence),
    endsAt: boundary(id * cadence),
    timezone: SEASON_TIMEZONE,
    status: id === currentId ? "current" : "completed",
  };
};

export const getCurrentSeason = (
  now = Date.now(),
  cadence: SeasonCadence = DEFAULT_SEASON_CADENCE,
) => getSeason(currentSeasonId(now, cadence), now, cadence);
export const getSeasons = (
  now = Date.now(),
  cadence: SeasonCadence = DEFAULT_SEASON_CADENCE,
) => {
  const currentId = currentSeasonId(now, cadence);
  return Array.from({ length: currentId }, (_, index) =>
    getSeason(currentId - index, now, cadence),
  );
};

// HTTP parsing validates syntax; the repository validates availability against
// the persisted cadence captured for the entire response.
export const parseRequestedSeasonId = (value: string | null): number | null => {
  if (value === null) return null;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new InputError("Invalid season ID.");
  return Number(value);
};
export const parseSeasonId = (
  value: string | null,
  now = Date.now(),
  cadence: SeasonCadence = DEFAULT_SEASON_CADENCE,
): number | null => {
  const id = parseRequestedSeasonId(value);
  return id === null ? null : getSeason(id, now, cadence).id;
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
