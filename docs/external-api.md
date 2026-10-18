# External API reference

[← Documentation overview](../README.md)

Read leaderboard data and create players and games using an owner-issued API
key. See [API access and security](api-security.md) for obtaining a key, expiration,
request limits, automatic revocation, and owner alerts.

Authenticate requests over HTTPS with `Authorization: Bearer <key>`.

## Endpoints

| Endpoint                         | Behavior                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/v1/leaderboard`        | `{ leaderboard: [...] }`, including ratings, games played, and call totals    |
| `GET /api/v1/players?cursor=...` | `{ players: [...], nextCursor }`; up to 50 players, ordered by ID             |
| `GET /api/v1/games?cursor=...`   | `{ games: [...], nextCursor }`; up to 20 games, newest first                  |
| `POST /api/v1/players`           | Create a player; returns `201` with `{ id }`                                  |
| `POST /api/v1/games`             | Create a game and optional call stats atomically; returns `201` with `{ id }` |

Omit `cursor` for the first page, pass the returned `nextCursor` unchanged, and
stop when it is `null`. Read responses exclude creator emails, gender, admin
information, and key/security metadata. Unsupported methods, record-specific
write paths, method overrides, and unknown top-level creation fields are rejected.

## Creation requests and safe retries

Creation requests require `Content-Type: application/json` and an
`Idempotency-Key` header containing 1–128 letters, digits, dots, underscores,
colons, or hyphens. Generate one identifier per intended creation and reuse it
when retrying that operation. Identical retries within 24 hours return the same
`201 { id }` with `Idempotency-Replayed: true`, without creating another record.
Object field ordering does not matter. Reusing the identifier for a different
payload returns `409`. Identifiers are scoped to the API key and endpoint; after
24 hours they may create a new record. Do not blindly retry older requests.

### Create a player

```json
{ "code": "ABC", "name": "Example Player", "gender": "F" }
```

Codes are unique, 1–3 letters/numbers, and normalized to uppercase. Names are
1–40 characters. Gender may be `M` or `F` and defaults to `M`, matching the
existing player form. Creating an existing code never updates that player.

### Create a game

Use IDs returned by the players endpoint:

```json
{
  "teamAPlayer1Id": 1,
  "teamAPlayer2Id": 2,
  "teamBPlayer1Id": 3,
  "teamBPlayer2Id": 4,
  "scoreA": 1000,
  "scoreB": -100,
  "playedAt": "2026-10-18T12:00:00.000Z"
}
```

Games require four distinct active players, whole-number scores, a valid date,
and no tied score. Optional `callStats` must contain exactly one entry per player,
with `playerId`, `grandTichus`, `successfulGrandTichus`, `tichus`, and
`successfulTichus`. Counts must be nonnegative integers; successes cannot exceed
calls. Client-supplied IDs or creator identities are not accepted.

## Example read

Inject the key through your secret manager:

```js
const response = await fetch(
  "https://tichu-elo.nyu1997.chatgpt.site/api/v1/players",
  { headers: { Authorization: `Bearer ${process.env.TICHU_API_KEY}` } },
);
const result = await response.json();
```

## Errors and throttling

See [limits and automatic revocation](api-security.md#limits-and-automatic-revocation)
for quotas, error responses, and retry behavior.
