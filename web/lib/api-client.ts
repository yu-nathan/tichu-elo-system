import type { SeasonalPlayerProfile } from "./player-profile.ts";
import type { AdminEntry } from "./admin-access.ts";
import type {
  AppData,
  DashboardData,
  SeasonStandings,
  GamePage,
  PlayerInput,
  PlayerUpdate,
} from "./models.ts";
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

export const fetchGamePage = async (
  cursor: string | null,
  signal?: AbortSignal,
  playerId: number | null = null,
  seasonId: number | null = null,
): Promise<GamePage> => {
  const params = new URLSearchParams();
  if (cursor !== null) params.set("cursor", cursor);
  if (playerId !== null) params.set("playerId", String(playerId));
  if (seasonId !== null) params.set("seasonId", String(seasonId));
  const response = await fetch(`/api/games${params.size ? `?${params}` : ""}`, {
    cache: "no-store",
    signal,
  });
  const message = cursor
    ? "Could not load older games. Try again."
    : "Could not load games. Try again.";
  if (!response.ok) throw new Error(message);
  const page = (await response.json()) as GamePage;
  if (
    !Array.isArray(page?.games) ||
    !(page.nextCursor === null || typeof page.nextCursor === "string")
  )
    throw new Error(message);
  return page;
};

export const fetchPlayerProfile = async (
  id: number,
  signal: AbortSignal,
  seasonId: number | null = null,
): Promise<SeasonalPlayerProfile> => {
  const response = await fetch(
    `/api/players/${id}/profile${seasonId === null ? "" : `?seasonId=${seasonId}`}`,
    {
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) throw new Error("Could not load this profile. Try again.");
  const profile = (await response.json()) as SeasonalPlayerProfile;
  if (
    profile?.player?.id !== id ||
    !Array.isArray(profile.history) ||
    !profile.season ||
    !Array.isArray(profile.seasons) ||
    !profile.seasons.length
  )
    throw new Error("Could not load this profile. Try again.");
  return profile;
};

export const fetchDashboard = async (
  signal: AbortSignal,
): Promise<DashboardData> => {
  const response = await fetch("/api/dashboard", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Could not refresh standings. Try again.");
  const data = (await response.json()) as DashboardData;
  if (
    !data.season ||
    !Array.isArray(data.seasons) ||
    !Array.isArray(data.leaderboard) ||
    !Array.isArray(data.history?.games)
  )
    throw new Error("Could not refresh standings. Try again.");
  return data;
};
export const fetchSeasonStandings = async (
  id: number,
  signal: AbortSignal,
): Promise<SeasonStandings> => {
  const response = await fetch(`/api/seasons/${id}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Could not load this season. Try again.");
  const data = (await response.json()) as SeasonStandings;
  if (
    data.season?.id !== id ||
    !Array.isArray(data.seasons) ||
    !Array.isArray(data.leaderboard)
  )
    throw new Error("Could not load this season. Try again.");
  return data;
};
