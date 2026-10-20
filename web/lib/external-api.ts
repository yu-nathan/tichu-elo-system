import { getCurrentSeason } from "./seasons.ts";
import { createRepository } from "./repository.ts";
import { InputError, requireRecord } from "./input.ts";
import {
  API_POLICY as P,
  ApiFailure,
  apiJson,
  externalError,
  hashSecret,
  readApiJson,
} from "./external-api-policy.ts";
import {
  createApiStore,
  type ApiDatabase,
  type ApiResource,
} from "./external-api-store.ts";
import type { ApiKeyInfo } from "./external-api-types.ts";

const playerFields = ["code", "name", "gender"];
const gameFields = [
  "teamAPlayer1Id",
  "teamAPlayer2Id",
  "teamBPlayer1Id",
  "teamBPlayer2Id",
  "scoreA",
  "scoreB",
  "playedAt",
  "callStats",
];
// Object key order is immaterial to retry identity; array order is significant.
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
};

export const createExternalApi =
  (db: ApiDatabase, clock: () => number = Date.now) =>
  async (request: Request): Promise<Response> => {
    const store = createApiStore(db);
    let key: ApiKeyInfo | undefined;
    let resource: ApiResource | "requests" = "requests";
    try {
      const now = clock();
      // No per-attacker rows: unknown credentials share a single bounded bucket.
      try {
        await store.consume("pre-auth", P.preAuthPerMinute, now);
      } catch (error) {
        if (error instanceof ApiFailure && error.status === 429) {
          // Even a pre-auth throttle revokes an identifiable valid key, never an unverified ID.
          try {
            key = await store.authenticate(request, now);
          } catch (authError) {
            if (!(authError instanceof ApiFailure && authError.status === 401))
              throw authError;
          }
        }
        throw error;
      }
      key = await store.authenticate(request, now);
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, "");
      if (path === "/api/v1/games") resource = "games";
      if (path === "/api/v1/players") resource = "players";
      await store.consume("authenticated", P.requestsGlobal, now);
      if (request.method === "GET" || request.method === "HEAD")
        await store.admitRead(key.id, now);
      await store.cleanup(now);
      await store.touchKey(key.id, now);
      if (
        ["x-http-method-override", "x-method-override", "x-http-method"].some(
          (header) => request.headers.has(header),
        ) ||
        url.searchParams.has("_method")
      )
        throw new ApiFailure(400, "Method overrides are not supported.");
      if (
        !["/api/v1/players", "/api/v1/games", "/api/v1/leaderboard"].includes(
          path,
        )
      )
        throw new ApiFailure(404, "API endpoint not found.");
      const allowed = resource === "requests" ? ["GET"] : ["GET", "POST"];
      if (!allowed.includes(request.method))
        return apiJson({ error: "Method not allowed." }, 405, {
          Allow: allowed.join(", "),
        });
      const repository = createRepository(db, () => now);
      if (request.method === "GET") {
        if (resource === "players") {
          const cursor = url.searchParams.get("cursor");
          if (
            cursor !== null &&
            (!/^[1-9]\d{0,15}$/.test(cursor) ||
              !Number.isSafeInteger(Number(cursor)))
          )
            throw new ApiFailure(400, "Invalid player cursor.");
          const results = (await repository.getPlayerRatings())
            .filter(({ id }) => id > (cursor === null ? 0 : Number(cursor)))
            .sort((a, b) => a.id - b.id)
            .slice(0, 51);
          const players = results
            .slice(0, 50)
            .map(({ id, code, name, archivedAt, rating }) => ({
              id,
              code,
              name,
              archivedAt,
              rating,
            }));
          return apiJson({
            season: getCurrentSeason(now),
            players,
            nextCursor: results.length > 50 ? String(players.at(-1)!.id) : null,
          });
        }
        if (resource === "games") {
          const page = await repository.getGamePage(
            url.searchParams.get("cursor"),
          );
          return apiJson({
            games: page.games.map((game) => ({
              id: game.id,
              teamAPlayer1Id: game.teamAPlayer1Id,
              teamAPlayer2Id: game.teamAPlayer2Id,
              teamBPlayer1Id: game.teamBPlayer1Id,
              teamBPlayer2Id: game.teamBPlayer2Id,
              scoreA: game.scoreA,
              scoreB: game.scoreB,
              playedAt: game.playedAt,
              callStats: game.callStats,
            })),
            nextCursor: page.nextCursor,
          });
        }
        const { leaderboard, season } = await repository.getDashboardData();
        return apiJson({
          season,
          leaderboard: leaderboard.map((player) => ({
            id: player.id,
            code: player.code,
            name: player.name,
            archivedAt: player.archivedAt,
            rating: player.rating,
            gamesPlayed: player.gamesPlayed,
            grandTichus: player.grandTichus,
            successfulGrandTichus: player.successfulGrandTichus,
            tichus: player.tichus,
            successfulTichus: player.successfulTichus,
          })),
        });
      }
      if (resource === "requests")
        throw new ApiFailure(405, "Method not allowed.");
      await store.admitWrite(key, resource, now);
      const token = request.headers.get("idempotency-key");
      if (!token || !/^[A-Za-z0-9_.:-]{1,128}$/.test(token))
        throw new ApiFailure(
          400,
          "An Idempotency-Key of 1–128 letters, digits, dots, underscores, colons or hyphens is required.",
        );
      const input = requireRecord(await readApiJson(request));
      const fields = resource === "players" ? playerFields : gameFields;
      if (Object.keys(input).some((field) => !fields.includes(field)))
        throw new ApiFailure(400, "Unknown fields are not allowed.");
      const tokenHash = await hashSecret(token);
      const payloadHash = await hashSecret(canonicalJson(input));
      // Re-check after the bounded body read, so expiration/revocation while reading takes effect.
      const commitTime = clock();
      await store.touchKey(key.id, commitTime);
      const previous = await store.replay(
        key.id,
        resource,
        tokenHash,
        payloadHash,
        commitTime,
      );
      if (previous !== null)
        return apiJson({ id: previous }, 201, {
          "Idempotency-Replayed": "true",
        });
      const transaction = store.creationTransaction(
        key.id,
        resource,
        tokenHash,
        payloadHash,
        commitTime,
      );
      try {
        const id =
          resource === "players"
            ? await repository.createPlayer(input, transaction)
            : await repository.createGame(
                input,
                `api-key:${key.id}`,
                transaction,
              );
        return apiJson({ id }, 201);
      } catch (error) {
        // A concurrent winner commits its ID atomically. Losing batches insert nothing.
        const replayed = await store.replay(
          key.id,
          resource,
          tokenHash,
          payloadHash,
          clock(),
        );
        if (replayed !== null)
          return apiJson({ id: replayed }, 201, {
            "Idempotency-Replayed": "true",
          });
        throw error;
      }
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 429 && key) {
        try {
          await store.recordBlocked(key, resource, clock());
          return apiJson(
            {
              error:
                "This API key was revoked after exceeding a throttle limit. The owner must generate a replacement.",
            },
            429,
            {
              "Retry-After": String(error.retryAfter ?? 60),
              "X-API-Key-Revoked": "true",
            },
          );
        } catch {
          return externalError(null);
        }
      }
      if (error instanceof InputError)
        return apiJson({ error: error.message }, 400);
      return externalError(error);
    }
  };
