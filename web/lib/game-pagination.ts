import { InputError } from "./input.ts";

export const GAME_PAGE_SIZE = 20;
export type GameCursor = { playedAt: string; id: number };

export const encodeGameCursor = ({ playedAt, id }: GameCursor) =>
  btoa(JSON.stringify({ playedAt, id }));

export const decodeGameCursor = (value: string | null): GameCursor | null => {
  if (value === null) return null;
  try {
    if (!value || value.length > 256) throw new Error();
    const cursor = JSON.parse(atob(value));
    if (
      typeof cursor?.playedAt !== "string" ||
      cursor.playedAt.length > 40 ||
      !Number.isFinite(Date.parse(cursor.playedAt)) ||
      !Number.isSafeInteger(cursor.id) ||
      cursor.id <= 0
    )
      throw new Error();
    return { playedAt: cursor.playedAt, id: cursor.id };
  } catch {
    throw new InputError("Invalid game history cursor.");
  }
};
