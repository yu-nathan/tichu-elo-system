import type { Game } from "./models.ts";
import { toLocalDateTime } from "./date-time.ts";

export type DraftNumber = number | string;

export type CallCounts = {
  grandTichus: DraftNumber;
  successfulGrandTichus: DraftNumber;
  tichus: DraftNumber;
  successfulTichus: DraftNumber;
};

export type GameDraft = {
  id?: number;
  teamAPlayer1Id: number;
  teamAPlayer2Id: number;
  teamBPlayer1Id: number;
  teamBPlayer2Id: number;
  scoreA: DraftNumber;
  scoreB: DraftNumber;
  playedAt: string;
  callStats: CallCounts[] | null;
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storageKey = "tichu-elo:game-draft:v1";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDraftNumber = (value: unknown): value is DraftNumber =>
  typeof value === "string" || Number.isFinite(value);

const requireNumber = (value: DraftNumber): number => {
  if (typeof value === "string" && !value.trim()) {
    throw new Error("Enter a value for every score and call count.");
  }
  if (
    (typeof value === "string" && !/^-?\d+$/.test(value.trim())) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw new Error("Scores and call counts must be whole numbers.");
  }
  return Number(value);
};

const requireCallCount = (value: DraftNumber): number => {
  const count = requireNumber(value);
  if (count < 0) throw new Error("Call counts cannot be negative.");
  return count;
};

export const gameDraftToInput = (draft: GameDraft) => {
  const playerIds = [
    draft.teamAPlayer1Id,
    draft.teamAPlayer2Id,
    draft.teamBPlayer1Id,
    draft.teamBPlayer2Id,
  ];
  return {
    ...draft,
    scoreA: requireNumber(draft.scoreA),
    scoreB: requireNumber(draft.scoreB),
    playedAt: new Date(draft.playedAt).toISOString(),
    callStats:
      draft.callStats?.map((stat, index) => ({
        playerId: playerIds[index],
        grandTichus: requireCallCount(stat.grandTichus),
        successfulGrandTichus: requireCallCount(stat.successfulGrandTichus),
        tichus: requireCallCount(stat.tichus),
        successfulTichus: requireCallCount(stat.successfulTichus),
      })) ?? null,
  };
};

const isGameDraft = (value: unknown): value is GameDraft => {
  if (!isRecord(value)) return false;
  const numericFields = [
    "teamAPlayer1Id",
    "teamAPlayer2Id",
    "teamBPlayer1Id",
    "teamBPlayer2Id",
  ];
  return (
    (value.id === undefined || Number.isInteger(value.id)) &&
    numericFields.every((key) => Number.isFinite(value[key])) &&
    isDraftNumber(value.scoreA) &&
    isDraftNumber(value.scoreB) &&
    typeof value.playedAt === "string" &&
    (value.callStats === null ||
      (Array.isArray(value.callStats) &&
        value.callStats.length === 4 &&
        value.callStats.every(
          (stat) =>
            isRecord(stat) &&
            [
              "grandTichus",
              "successfulGrandTichus",
              "tichus",
              "successfulTichus",
            ].every((key) => isDraftNumber(stat[key])),
        )))
  );
};

export const readGameDraft = (storage?: DraftStorage): GameDraft | null => {
  try {
    const saved = (storage ?? window.localStorage).getItem(storageKey);
    if (!saved) return null;
    const draft: unknown = JSON.parse(saved);
    return isGameDraft(draft) ? draft : null;
  } catch {
    return null;
  }
};

export const saveGameDraft = (
  draft: GameDraft,
  storage?: DraftStorage,
): boolean => {
  try {
    (storage ?? window.localStorage).setItem(storageKey, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
};

export const clearGameDraft = (storage?: DraftStorage): boolean => {
  try {
    (storage ?? window.localStorage).removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
};

export const emptyCallCounts = (): CallCounts => ({
  grandTichus: 0,
  successfulGrandTichus: 0,
  tichus: 0,
  successfulTichus: 0,
});

export const newGameDraft = (playerIds: number[]): GameDraft => ({
  teamAPlayer1Id: playerIds[0] ?? 0,
  teamAPlayer2Id: playerIds[1] ?? 0,
  teamBPlayer1Id: playerIds[2] ?? 0,
  teamBPlayer2Id: playerIds[3] ?? 0,
  scoreA: 0,
  scoreB: 0,
  playedAt: toLocalDateTime(new Date().toISOString()),
  callStats: null,
});

export const gameToDraft = (game: Game): GameDraft => {
  const playerIds = [
    game.teamAPlayer1Id,
    game.teamAPlayer2Id,
    game.teamBPlayer1Id,
    game.teamBPlayer2Id,
  ];
  return {
    id: game.id,
    teamAPlayer1Id: game.teamAPlayer1Id,
    teamAPlayer2Id: game.teamAPlayer2Id,
    teamBPlayer1Id: game.teamBPlayer1Id,
    teamBPlayer2Id: game.teamBPlayer2Id,
    scoreA: game.scoreA,
    scoreB: game.scoreB,
    playedAt: toLocalDateTime(game.playedAt),
    callStats: game.callStats.length
      ? playerIds.map((playerId) => {
          const stat = game.callStats.find(
            (entry) => entry.playerId === playerId,
          );
          return stat
            ? {
                grandTichus: stat.grandTichus,
                successfulGrandTichus: stat.successfulGrandTichus,
                tichus: stat.tichus,
                successfulTichus: stat.successfulTichus,
              }
            : emptyCallCounts();
        })
      : null,
  };
};
