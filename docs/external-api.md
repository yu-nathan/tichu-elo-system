# External API reference

[← Documentation overview](../README.md)

Read leaderboard data and create players and games using an owner-issued API
key. See [API access and security](api-security.md) for obtaining a key, expiration,
request limits, automatic revocation, and owner alerts.

This reference describes the current source implementation. Local changes must
be deployed before they are available on the hosted API.

## Contents

- [Authentication and headers](#authentication-and-headers)
- [Response types](#response-types)
- [Get the leaderboard](#get-the-leaderboard)
- [List players](#list-players)
- [List games](#list-games)
- [Create a player](#create-a-player)
- [Create a game](#create-a-game)
- [Example read](#example-read)
- [Safe retries](#safe-retries)
- [Errors and throttling](#errors-and-throttling)

## Authentication and headers

Base URL: `https://tichu-elo.nyu1997.chatgpt.site/api/v1`

| Header            | Required for  | Value                                                                                     |
| ----------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `Authorization`   | Every request | `Bearer <key>`                                                                            |
| `Content-Type`    | POST requests | `application/json`                                                                        |
| `Idempotency-Key` | POST requests | Unique operation identifier; 1–128 letters, digits, dots, underscores, colons, or hyphens |

Send keys only over HTTPS and inject them from a secret store. The API does not
enable cross-origin browser access; use a server-side integration. GET requests
have no request body. POST bodies must be JSON objects and at most 16 KiB, read
within 5 seconds. Unknown top-level creation fields are rejected.

All application responses are JSON with `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`. API credentials cannot edit, archive, or delete
records, manage admins, or generate keys. Unsupported methods, record-specific
write paths, and method overrides are rejected.

## Response types

The following TypeScript notation describes the JSON schemas. All listed fields
are required unless marked `?`. IDs and counts are integers; `rating` is a number
that can have a fractional part. Timestamps are strings; newly created game dates
are normalized to UTC ISO 8601.

```ts
type Player = {
  id: number;
  name: string;
  code: string;
  rating: number; // Current Elo, calculated from game history.
  archivedAt: string | null; // null means active.
};

type LeaderboardEntry = Player & {
  gamesPlayed: number;
  grandTichus: number;
  successfulGrandTichus: number;
  tichus: number;
  successfulTichus: number;
};

type CallStat = {
  playerId: number;
  grandTichus: number;
  successfulGrandTichus: number;
  tichus: number;
  successfulTichus: number;
};

type Game = {
  id: number;
  teamAPlayer1Id: number;
  teamAPlayer2Id: number;
  teamBPlayer1Id: number;
  teamBPlayer2Id: number;
  scoreA: number;
  scoreB: number;
  playedAt: string;
  callStats: CallStat[];
};

type CreatedResponse = { id: number };
type ErrorResponse = { error: string };
```

Read responses exclude creator emails, gender, admin information, and key/security
metadata. Player IDs link games and call stats to the names and codes returned by
`GET /players`. An archived player remains in player and leaderboard responses.
A player without games has a rating of 1000.

## Get the leaderboard

`GET /leaderboard` — no query parameters or request body are needed.

**200 response schema:**

```ts
type LeaderboardResponse = { leaderboard: LeaderboardEntry[] };
```

Returns all players ordered by rating descending, with names breaking rating ties.
Call counts are totals across game history. This endpoint is not paginated.

**Example response:**

```json
{
  "leaderboard": [
    {
      "id": 1,
      "name": "Example Player",
      "code": "ABC",
      "rating": 1016,
      "archivedAt": null,
      "gamesPlayed": 1,
      "grandTichus": 0,
      "successfulGrandTichus": 0,
      "tichus": 1,
      "successfulTichus": 1
    }
  ]
}
```

## List players

`GET /players?cursor=...` — no request body.

| Query parameter | Type   | Required | Meaning                                                       |
| --------------- | ------ | -------- | ------------------------------------------------------------- |
| `cursor`        | string | No       | The previous response's `nextCursor`; omit for the first page |

**200 response schema:**

```ts
type PlayersResponse = { players: Player[]; nextCursor: string | null };
```

Returns at most 50 players per page, ordered by ID ascending. Each entry includes
name, code, and current Elo (`rating`), using the same game replay as the
leaderboard. Archived players remain in the list with their current rating.

**Example response:**

```json
{
  "players": [
    {
      "id": 1,
      "name": "Example Player",
      "code": "ABC",
      "rating": 1016,
      "archivedAt": null
    }
  ],
  "nextCursor": null
}
```

Pass `nextCursor` unchanged as the next request's `cursor` query value. Stop when
it is `null`. Use `URLSearchParams` to encode query values. There is no configurable
page size; an exhausted page returns `players: []` and `nextCursor: null`.

## List games

`GET /games?cursor=...` — no request body.

| Query parameter | Type   | Required | Meaning                                                                 |
| --------------- | ------ | -------- | ----------------------------------------------------------------------- |
| `cursor`        | string | No       | Opaque `nextCursor` from the previous response; omit for the first page |

**200 response schema:**

```ts
type GamesResponse = { games: Game[]; nextCursor: string | null };
```

Returns at most 20 games per page, newest played date first, then highest game ID
for equal dates. Pass `nextCursor` unchanged using `URLSearchParams`; do not build
or decode it yourself. Stop when it is `null`. There is no configurable page size.
An exhausted page returns `games: []` and `nextCursor: null`.

**Example response:**

```json
{
  "games": [
    {
      "id": 42,
      "teamAPlayer1Id": 1,
      "teamAPlayer2Id": 2,
      "teamBPlayer1Id": 3,
      "teamBPlayer2Id": 4,
      "scoreA": 1000,
      "scoreB": -100,
      "playedAt": "2026-10-18T12:00:00.000Z",
      "callStats": []
    }
  ],
  "nextCursor": null
}
```

`callStats` contains recorded per-player counts using the `CallStat` schema; it is
an empty array when no call stats were recorded.

## Create a player

`POST /players` — requires all three [request headers](#authentication-and-headers).

**Request body schema:**

```ts
type CreatePlayerRequest = {
  code: string;
  name: string;
  gender?: "M" | "F";
};
```

| Field    | Required | Validation                                                                                        |
| -------- | -------- | ------------------------------------------------------------------------------------------------- |
| `code`   | Yes      | Trimmed, uppercased, then 1–3 ASCII letters or digits; must be unique, including archived players |
| `name`   | Yes      | Trimmed; 1–40 characters                                                                          |
| `gender` | No       | `M` or `F`; defaults to `M`                                                                       |

**Example request body:**

```json
{ "code": "ABC", "name": "Example Player", "gender": "F" }
```

**201 response schema:** `CreatedResponse`. The ID identifies the new player.

```json
{ "id": 5 }
```

Creating an existing code returns `400` with
`{ "error": "That player code is already in use." }`; it never updates the player.
Use `GET /players` for the player's name, code, and initial rating of 1000.

## Create a game

`POST /games` — requires all three [request headers](#authentication-and-headers).

**Request body schema:**

```ts
// Send JSON integers. Integer strings are also accepted and normalized.
type IntegerInput = number | string;
type CallStatInput = {
  playerId: IntegerInput;
  grandTichus: IntegerInput;
  successfulGrandTichus: IntegerInput;
  tichus: IntegerInput;
  successfulTichus: IntegerInput;
};
type CreateGameRequest = {
  teamAPlayer1Id: IntegerInput;
  teamAPlayer2Id: IntegerInput;
  teamBPlayer1Id: IntegerInput;
  teamBPlayer2Id: IntegerInput;
  scoreA: IntegerInput;
  scoreB: IntegerInput;
  playedAt: string;
  callStats?: CallStatInput[] | null;
};
```

| Field                | Required | Validation                                                                                        |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| Four team player IDs | Yes      | Positive safe integers identifying four distinct, existing, active players                        |
| `scoreA`, `scoreB`   | Yes      | Safe integers; negative scores are allowed; scores must differ                                    |
| `playedAt`           | Yes      | Valid date string; use ISO 8601 with an explicit timezone, such as `2026-10-18T12:00:00.000Z`     |
| `callStats`          | No       | Omit or use `null` for no stats; otherwise provide exactly one entry for each of the four players |

Each call-stat entry requires all five fields. Counts must be nonnegative safe
integers; successful counts cannot exceed the corresponding total calls. Player
IDs must match the four selected players without duplicates. An empty array is
not a valid creation value: omit `callStats` instead. Client-supplied game IDs or
creator identities are not accepted.

**Example request body with optional call stats:**

```json
{
  "teamAPlayer1Id": 1,
  "teamAPlayer2Id": 2,
  "teamBPlayer1Id": 3,
  "teamBPlayer2Id": 4,
  "scoreA": 1000,
  "scoreB": -100,
  "playedAt": "2026-10-18T12:00:00.000Z",
  "callStats": [
    {
      "playerId": 1,
      "grandTichus": 0,
      "successfulGrandTichus": 0,
      "tichus": 1,
      "successfulTichus": 1
    },
    {
      "playerId": 2,
      "grandTichus": 0,
      "successfulGrandTichus": 0,
      "tichus": 0,
      "successfulTichus": 0
    },
    {
      "playerId": 3,
      "grandTichus": 1,
      "successfulGrandTichus": 0,
      "tichus": 0,
      "successfulTichus": 0
    },
    {
      "playerId": 4,
      "grandTichus": 0,
      "successfulGrandTichus": 0,
      "tichus": 1,
      "successfulTichus": 0
    }
  ]
}
```

**201 response schema:** `CreatedResponse`. The ID identifies the new game.

```json
{ "id": 42 }
```

The game and any call stats are created atomically. Use IDs from `GET /players`
when constructing the request, and `GET /games` to read game records.

## Example read

Inject the key through your secret manager:

```js
const response = await fetch(
  "https://tichu-elo.nyu1997.chatgpt.site/api/v1/players",
  { headers: { Authorization: `Bearer ${process.env.TICHU_API_KEY}` } },
);
const result = await response.json();
```

## Safe retries

Generate one `Idempotency-Key` per intended creation and reuse it for retries.
Identical retries within 24 hours return the original `201 { id }` with the
response header `Idempotency-Replayed: true`, without creating another record.
Object field ordering does not matter; keep values and array ordering unchanged.
Reusing an identifier with a different payload returns `409`.

Identifiers are scoped to the API key and endpoint. After 24 hours, the same
identifier may create a new record. Do not blindly retry older requests or switch
keys after an uncertain outcome. Reuse the same identifier and payload after a
network interruption or `503`, subject to the limits below.

Creation attempts, including invalid requests and retries, count toward the
10-per-hour key allowance. Reads have a separate 300-per-hour allowance. A request
exceeding any throttle permanently revokes an identifiable key, so avoid automatic
retry loops. See [all limits](api-security.md#limits-and-automatic-revocation).

## Errors and throttling

**Error response schema:** `ErrorResponse`. Example:

```json
{ "error": "A valid API key is required." }
```

| HTTP status | Meaning                                                                                                        | Relevant response headers                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `400`       | Invalid JSON, input, cursor, method override, missing/invalid idempotency identifier, or duplicate player code | —                                                                                        |
| `401`       | Missing, invalid, expired, or revoked key                                                                      | —                                                                                        |
| `404`       | Unknown API endpoint                                                                                           | —                                                                                        |
| `405`       | Unsupported method                                                                                             | `Allow` lists supported methods                                                          |
| `408`       | Request body read exceeded 5 seconds                                                                           | —                                                                                        |
| `409`       | Idempotency identifier reused with a different payload                                                         | —                                                                                        |
| `413`       | Request body exceeds 16 KiB or has invalid declared length                                                     | —                                                                                        |
| `415`       | Content type is not `application/json`                                                                         | —                                                                                        |
| `429`       | Throttle exceeded                                                                                              | `Retry-After` in seconds; `X-API-Key-Revoked: true` when the identifiable key is revoked |
| `503`       | Authentication, throttling, or other required storage/processing unavailable                                   | —                                                                                        |

Authentication and throttling fail closed. A throttled key remains revoked after
`Retry-After` elapses; later requests return `401`. The owner must generate a
replacement. Global traffic pressure can also revoke a key before it exhausts
its individual allowance. Do not expose credentials in error logs.

For key lifecycle and owner notifications, see [API access and security](api-security.md).
