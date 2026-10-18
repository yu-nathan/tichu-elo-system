# Tichu Elo leaderboard

This lightweight program recalculates individual Elo ratings from team results in
the exact order they appear in `games.txt`. Every player starts at 1000.

Run it with:

```sh
python3 tichu_elo.py
```

The Discord-ready output creates separate code blocks for the leaderboard and a
chronological history of the 10 most recent games. Copy each block into its own
Discord message for a mobile-friendly layout.

Generate the fairest matchup from all players:

```sh
python3 tichu_elo.py --teams
```

The command chooses four players, balances the two teams by average Elo rating,
and lists any benched players. To balance a specific group of four, provide their
initials:

```sh
python3 tichu_elo.py --teams C Y S N
```

To add a result, append another line to `games.txt` and run the command again:

```text
NY - 1105 SC - -205
```

Each team is two player initials. Scores may be positive or negative. Blank lines,
comments beginning with `#`, and trailing comments are allowed. Invalid teams,
shared players, ties, and malformed lines produce a clear error.

## Rating rule

For each game, the team's rating is the average of its two players' ratings.
Expected win probability uses the standard Elo formula with a 400-point scale.
The winning team receives the same rating increase for each partner, and each
opponent loses that amount.

The default K-factor is 32. Ratings use only the win or loss; the point
differential does not affect the update:

```text
rating change = K-factor * (actual result - expected result)
```

If both final scores are below 1,000, the result is treated as a game to 500 and
uses half the normal K-factor (16 by default). Negative scores are supported and
still only determine which team won. The starting rating and K-factor can be
changed with `--initial` and `--k-factor`.

## Web admin access

The owner (`nyu1997@gmail.com`) can add admins in the management panel's
**Admins** section. Enter the email they use to sign in with ChatGPT. Added
admins can manage games and players; only the owner can add more admins. This
grants access without sending an invitation email. The owner always retains
access, and additional grants are stored in D1.

## Web development and validation

The web application lives in `web/`. Install its locked dependencies with
`npm ci`, then run `npm run build`. On a fresh local database, apply all migrations
once before running `npm run dev`:

```sh
for migration in drizzle/*.sql; do
  npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$migration"
done
```

Run this initialization only against a fresh local database. Existing local
state already has its tables and imported games; apply only missing migrations
there. Sites tracks and applies production migrations during deployment.

Production schema and the original data import belong to the existing Drizzle
migrations. Application reads never create tables or reinsert deleted games.

Run web validation from `web/`:

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Run the CLI regression suite from the repository root with
`python3 -m unittest`. Web repository tests run the actual migration and query SQL
against an in-memory SQLite database, including transaction rollback failures.

The UI is composed from `components/admin` and `components/dashboard`. Browser
requests live in `lib/api-client.ts`; hooks manage mutation, clipboard, and draft
state. Shared contracts live in `lib/models.ts`, input validation in
`lib/input.ts`, and D1 queries in the injectable `lib/repository.ts` with
`lib/store.ts` providing the runtime binding.

With a local development server running and Playwright plus Chrome available,
run `npm run test:browser` from `web/`. Set `TICHU_TEST_URL` if the server uses a
port other than 3000. An external Playwright installation can be selected via
`PLAYWRIGHT_TEST_MODULE` (the absolute path to its `test.mjs`). These tests mock
mutation requests and cover draft recovery, failed refreshes, clipboard errors,
hydration, and mobile/desktop layouts without changing saved game data.

## External API

The owner can generate named API keys under **Admin console → API access**.
Each key expires exactly 365 days after creation. The full key is displayed once;
save it in a password manager or your integration's secret store. Only its
SHA-256 hash is stored in D1. Lost keys cannot be retrieved. Revoke a lost key and
generate a replacement. Up to 10 keys can be active at once; creation is also
limited to 10 keys per hour to bound security metadata storage.

Only the owner's ChatGPT browser session can manage keys and alerts. API keys
cannot manage admins or keys, edit/archive players, or update/delete games.
The existing signed-in admin controls and public leaderboard remain available.
This API's quotas apply to `/api/v1`, not the site's existing public pages.

Send keys only over HTTPS in the `Authorization: Bearer <key>` header. Do not put
them in URLs, browser storage, logs, or source code. The API does not enable
cross-origin browser access; use it from a server-side integration.

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

Creation requests require `Content-Type: application/json` and an
`Idempotency-Key` header containing 1–128 letters, digits, dots, underscores,
colons, or hyphens. Generate one identifier per intended creation and reuse it
when retrying that operation. Identical retries within 24 hours return the same
`201 { id }` with `Idempotency-Replayed: true`, without creating another record.
Object field ordering does not matter. Reusing the identifier for a different
payload returns `409`. Identifiers are scoped to the API key and endpoint; after
24 hours they may create a new record. Do not blindly retry older requests.

Player payload:

```json
{ "code": "ABC", "name": "Example Player", "gender": "F" }
```

Codes are unique, 1–3 letters/numbers, and normalized to uppercase. Names are
1–40 characters. Gender may be `M` or `F` and defaults to `M`, matching the
existing player form. Creating an existing code never updates that player.

Game payload (use IDs returned by the players endpoint):

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

Example server-side read, with the key injected by your secret manager:

```js
const response = await fetch(
  "https://tichu-elo.nyu1997.chatgpt.site/api/v1/players",
  { headers: { Authorization: `Bearer ${process.env.TICHU_API_KEY}` } },
);
const result = await response.json();
```

### Limits and automatic revocation

| Limit                                   | Allowance                                         |
| --------------------------------------- | ------------------------------------------------- |
| Creation attempts per key               | 10 in any rolling hour                            |
| Reads per key                           | 300 in any rolling hour                           |
| Global creation attempts                | 20 in any rolling minute; 100 in any rolling hour |
| All authenticated API requests          | 300 per fixed minute                              |
| All API requests, before authentication | 600 per fixed minute                              |
| JSON body                               | 16 KiB, read within 5 seconds                     |

The 10/hour creation limit includes invalid authenticated requests and retries.
Reads and creations have separate per-key allowances. Global limits protect
against traffic spread across multiple keys. Shared database checks enforce
quotas across concurrent requests and Worker instances.

**A request exceeding any throttle permanently revokes the identifiable API key.**
The triggering response is `429`, with `Retry-After` and
`X-API-Key-Revoked: true`. Later requests return `401`, including after the rate
window resets. Do not automatically retry a revoked key: the owner must create a
replacement. Global traffic pressure can also trigger revocation, even when a
key has not exhausted its individual allowance. Unknown/invalid credentials
cannot revoke another key.

Other errors return `{ error }`: `400` invalid input, `401` missing/expired/revoked
key, `404` unknown endpoint, `405` unsupported method, `408` body timeout, `409`
idempotency conflict, `413` oversized body, `415` unsupported content type, and
`503` unavailable storage. Authentication and throttling fail closed. Reuse the
same idempotency identifier after an uncertain creation outcome; do not expose
credentials in error logs.

### Owner alerts

Five successful creations within 60 seconds, or an authenticated throttle
violation, create a persistent owner-only alert. Repeated activity is grouped
into 15-minute incident windows. Alerts show key labels, resource types, creation
counts, and blocked-request counts without credentials or request bodies.
Throttled keys are automatically revoked; you can also revoke a key from an alert.
Acknowledging an incident clears its unread state; new activity makes it unread
again. The owner dashboard refreshes every 30 seconds while visible.

Alerts stay for 30 days and appear when you open the owner dashboard. **No email,
push, or notification while the site is closed is sent.** The view shows up to
100 incidents, unread first, and up to 500 recent keys, active first. Temporary
rate records last at most an hour, retry records last 24 hours, and inactive key
metadata is removed 30 days after revocation or expiration. Cleanup runs on
admitted authenticated API requests and owner-management requests.

Migrations `0004_external_api.sql` and `0005_external_api_reads.sql` only add
security tables; they do not change existing players or games. Apply these to
existing local state before previewing. Sites applies them during an explicitly
authorized deployment. The feature is not live until that deployment.

For the optional local HTTP integration check, run
`node --test tests/external-api-http.test.mjs` from `web/` while the development
server is running. It creates and revokes a local test key, verifies real D1
rollback and alert behavior, and leaves existing players/games unchanged.
`TICHU_TEST_URL` may select another loopback port; non-local URLs are refused.
The browser suite also covers the owner controls at mobile/desktop widths and
API-key rejection by existing admin mutation routes. Production gateway header
sanitization remains a separate post-deployment check.
