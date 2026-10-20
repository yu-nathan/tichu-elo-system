# Web development and validation

[← Documentation overview](../README.md)

The web application lives in `web/`. Start from the repository root to install
its locked dependencies and build the application:

```sh
cd web
npm ci
npm run build
```

## Local database setup

On a fresh local database, apply all migrations once before running
`npm run dev`:

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

## Validation

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

## Code organization

The UI is composed from `components/admin` and `components/dashboard`. Browser
requests live in `lib/api-client.ts`; hooks manage mutation, clipboard, and draft
state. Shared contracts live in `lib/models.ts`, input validation in
`lib/input.ts`, and D1 queries in the injectable `lib/repository.ts` with
`lib/store.ts` providing the runtime binding.

## Browser tests

With a local development server running and Playwright plus Chrome available,
run `npm run test:browser` from `web/`. Set `TICHU_TEST_URL` if the server uses a
port other than 3000. An external Playwright installation can be selected via
`PLAYWRIGHT_TEST_MODULE` (the absolute path to its `test.mjs`). These tests mock
mutation requests and cover draft recovery, failed refreshes, clipboard errors,
hydration, and mobile/desktop layouts without changing saved game data.

## External API migrations

Migrations `0004_external_api.sql` and `0005_external_api_reads.sql` only add
security tables; they do not change existing players or games. Apply these to
existing local state before previewing. Sites applies them during an explicitly
authorized deployment. Local changes reach production only through deployment.

## External API integration tests

For the optional local HTTP integration check, run
`node --test tests/external-api-http.test.mjs` from `web/` while the development
server is running. It creates and revokes a local test key, verifies real D1
rollback and alert behavior, and leaves existing players/games unchanged.
`TICHU_TEST_URL` may select another loopback port; non-local URLs are refused.
The browser suite also covers the owner controls at mobile/desktop widths and
API-key rejection by existing admin mutation routes. Production gateway header
sanitization remains a separate post-deployment check.

## Competitive seasons

`web/lib/seasons.ts` owns the Pacific-time calendar and season IDs. Season 1
includes all games before January 1, 2027, at midnight Pacific. Thereafter, seasons
begin every January 1 and July 1. The first season has a null start timestamp;
all boundaries are inclusive at the start and exclusive at the end.

The dashboard leaderboard header selects current or completed standings. Historical
links use `/?seasonId=1`; legacy `/seasons` links redirect to the dashboard.
Matchmaking continues using current ratings regardless of the selected leaderboard.

Ratings and profile statistics replay only that season's games from 1000 Elo.
There is no rollover migration or cron job: the server clock selects the current
season on each read. Corrections update the affected historical results. Current
player names are used in historical views, and archived participants retain their
historical rankings. Existing game and call-stat records are never reset.

Public read endpoints (all return `Cache-Control: no-store`):

- `GET /api/seasons`: `{ season, seasons }`, current season plus newest-first list.
- `GET /api/seasons/{id}`: `{ season, seasons, leaderboard }`; completed rankings
  include participants only, while current standings include all active players.
- `GET /api/players/{id}/profile?seasonId=1`: the existing profile fields plus
  `season`, `seasons`, and nullable `rank`. Omitting `seasonId` selects current.
- `GET /api/games?seasonId=1&playerId=2&cursor=...`: optional season/player filters
  apply before pagination. Omitting the season returns all seasons.
- `GET /api/dashboard`: current-season `{ season, seasons, leaderboard, history }`.

Season metadata is `{ id, label, startsAt, endsAt, timezone, status }`. Status is
`current` or `completed`; malformed, nonexistent, and future season IDs return 400. The separate authenticated `/api/v1/players` and `/api/v1/leaderboard` always
return current-season statistics; see [external API documentation](external-api.md).

Inject the repository/API clock in tests. Browser rollover tests mock read
responses and advance the browser clock, without writing saved game data.
