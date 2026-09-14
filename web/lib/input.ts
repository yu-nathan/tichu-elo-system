import type { GameCallStat } from "./elo.ts";

export class InputError extends Error {}

export const requireRecord = (input: unknown): Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new InputError("Expected a JSON object.");
  return input as Record<string, unknown>;
};

const requireInteger = (value: unknown, label: string): number => {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^-?\d+$/.test(value.trim())) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new InputError(`${label} must be whole numbers.`);
  return Number(value);
};

export const cleanPlayerInput = (input: unknown) => {
  const data = requireRecord(input);
  const code = (typeof data.code === "string" ? data.code : "")
    .trim()
    .toUpperCase();
  const name = (typeof data.name === "string" ? data.name : "").trim();
  if (!/^[A-Z0-9]{1,3}$/.test(code))
    throw new InputError("Player code must be 1–3 letters or numbers.");
  if (!name || name.length > 40)
    throw new InputError("Player name must be 1–40 characters.");
  return { code, name };
};

export const gameInput = (input: unknown) => {
  const data = requireRecord(input);
  const ids = [
    "teamAPlayer1Id",
    "teamAPlayer2Id",
    "teamBPlayer1Id",
    "teamBPlayer2Id",
  ].map((key) => requireInteger(data[key], "Player IDs"));
  const scoreA = requireInteger(data.scoreA, "Scores");
  const scoreB = requireInteger(data.scoreB, "Scores");
  const date = new Date(typeof data.playedAt === "string" ? data.playedAt : "");
  if (!Number.isFinite(date.getTime()))
    throw new InputError("Enter a valid played-at date.");
  const playedAt = date.toISOString();
  if (
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(ids).size !== 4
  )
    throw new InputError("A game requires four distinct players.");
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB))
    throw new InputError("Scores must be whole numbers.");
  if (scoreA === scoreB) throw new InputError("Tied games are not supported.");
  const callStatsInput = data.callStats;
  let callStats: GameCallStat[] = [];
  if (callStatsInput !== null && callStatsInput !== undefined) {
    if (!Array.isArray(callStatsInput) || callStatsInput.length !== 4)
      throw new InputError("Call stats require one entry for each player.");
    callStats = callStatsInput.map((value) => {
      const stat = requireRecord(value);
      const parsed = {
        playerId: requireInteger(stat.playerId, "Call counts"),
        grandTichus: requireInteger(stat.grandTichus, "Call counts"),
        successfulGrandTichus: requireInteger(
          stat.successfulGrandTichus,
          "Call counts",
        ),
        tichus: requireInteger(stat.tichus, "Call counts"),
        successfulTichus: requireInteger(stat.successfulTichus, "Call counts"),
      };
      if (
        !Object.values(parsed).every(Number.isInteger) ||
        parsed.grandTichus < 0 ||
        parsed.successfulGrandTichus < 0 ||
        parsed.tichus < 0 ||
        parsed.successfulTichus < 0
      )
        throw new InputError("Call counts must be non-negative whole numbers.");
      if (
        parsed.successfulGrandTichus > parsed.grandTichus ||
        parsed.successfulTichus > parsed.tichus
      )
        throw new InputError("Successful calls cannot exceed total calls.");
      return parsed;
    });
    const statIds = callStats
      .map(({ playerId }) => playerId)
      .sort((a, b) => a - b);
    if (statIds.join(",") !== [...ids].sort((a, b) => a - b).join(","))
      throw new InputError("Call stats must match the four selected players.");
  }
  return { ids, scoreA, scoreB, playedAt, callStats };
};
