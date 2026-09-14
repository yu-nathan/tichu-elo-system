import type { AdminEntry } from "./admin-access.ts";
import type { AppData, PlayerInput, PlayerUpdate } from "./models.ts";
import type { gameDraftToInput } from "./game-draft.ts";

const request = async (
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
) => {
  const options =
    method === "GET"
      ? { method, cache: "no-store" as const }
      : {
          method,
          cache: "no-store" as const,
          headers:
            body === undefined
              ? undefined
              : { "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        };
  const response = await fetch(url, options);
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "The request failed. Try again.",
    );
  }
  return response;
};

export const fetchAppData = async (): Promise<AppData> => {
  const result = (await (await request("/api/state")).json()) as AppData | null;
  if (
    !result ||
    !Array.isArray(result.players) ||
    !Array.isArray(result.games) ||
    !Array.isArray(result.leaderboard)
  ) {
    throw new Error("Could not load the latest games and players.");
  }
  return result;
};

export const saveGame = async (
  input: ReturnType<typeof gameDraftToInput>,
  id?: number,
) => {
  await request(
    id ? `/api/games/${id}` : "/api/games",
    id ? "PATCH" : "POST",
    input,
  );
};
export const deleteGame = async (id: number) => {
  await request(`/api/games/${id}`, "DELETE");
};
export const createPlayer = async (input: PlayerInput) => {
  await request("/api/players", "POST", input);
};
export const updatePlayer = async (id: number, input: PlayerUpdate) => {
  await request(`/api/players/${id}`, "PATCH", input);
};
export const addAdmin = async (email: string): Promise<AdminEntry[]> => {
  const result = (await (
    await request("/api/admins", "POST", { email })
  ).json()) as { admins?: AdminEntry[] } | null;
  if (!Array.isArray(result?.admins))
    throw new Error("Could not load the admin list. Reload the page.");
  return result!.admins!;
};
