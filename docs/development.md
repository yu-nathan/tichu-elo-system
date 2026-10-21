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

`web/lib/seasons.ts` owns the Pacific-time calendar and season IDs. The persisted
`season_settings` singleton selects a cadence of 1, 3, 6 (default), or 12 calendar
months, anchored to July 2026. At the default cadence, Season 1 includes all games
before January 1, 2027, at midnight Pacific; later seasons begin January 1 and
July 1. The first season has a null start timestamp. All boundaries are inclusive
at the start and exclusive at the end.

Migration `0006_season_cadence.sql` creates and seeds the singleton without changing
games, players, or call stats. Apply it to existing local preview state before
running the app. Reads capture the saved cadence once for each aggregate response.
Changing cadence atomically updates the setting; all results replay from the raw
games on subsequent reads, including historical standings and external APIs.
Authoritative statistics are derived from raw games. Public dashboard snapshots
are disposable and invalidated transactionally when settings or game data change.

`PATCH /api/seasons/settings` accepts `{ cadenceMonths, revision }` from a signed-in
owner with a same-origin request. API bearer credentials and other admins are
rejected. An outdated revision returns 409 without changing settings; refresh
`/api/state` to obtain the latest `seasonSettings` before retrying.

The dashboard leaderboard header selects current or completed standings. Historical
links use `/?seasonId=1`; legacy `/seasons` links redirect to the dashboard.
Matchmaking continues using current ratings regardless of the selected leaderboard.

Ratings and profile statistics replay only that season's games from 1000 Elo.
There is no rollover migration or cron job: the server clock selects the current
season on each read. Corrections update the affected historical results. Current
player names are used in historical views, and archived participants retain their
historical rankings. Existing game and call-stat records are never reset.

Public read endpoints (all return `Cache-Control: no-store`):

- `GET /api/seasons`: `{ season, seasons, seasonSettings }`, current season plus newest-first list.
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

## Initial-load performance and dashboard snapshots

The homepage wraps its asynchronous data/authentication work in a server
Suspense boundary. A public header and card placeholders stream first; standings
remain server-rendered when the data resolves. The boundary is scoped to the
homepage so admin authentication and redirects retain their existing behavior.

Matchmaker and History are dynamically imported after hydration on desktop and
only on first tab selection on mobile. Once requested, they stay mounted across
tab changes and resizing to preserve selections and filters. The media query
matches Tailwind's `lg` breakpoint. Loading placeholders reserve panel space;
failed code downloads show a reload action. Tests wait for visible dashboard
controls rather than a timestamp in an initially unmounted History panel.

The homepage and `/api/dashboard` share a public D1 dashboard snapshot. Each
request checks the singleton data revision and season settings before reusing it.
Snapshots expire after five minutes or at Pacific season rollover, whichever
comes first. Revision triggers on players, games, game-player statistics, and
season settings invalidate snapshots in the same transaction as a write. This
includes external API game creation; idempotent replays do not write again.

Migration `0007_dashboard_cache.sql` follows `0006_season_cadence.sql`. Apply it
once to an existing local database before starting the updated build:

```sh
cd web
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0007_dashboard_cache.sql
```

Production migration remains part of the separately authorized Sites release.
The snapshot stores derived public data only, not user identity or permissions.
Reads never change authoritative game records. A rebuild is published only if
its starting revision still matches; continuous concurrent changes produce a
retryable error rather than stale standings. No process-memory result cache is
used. In-flight rebuilds are deduplicated within each Worker and database binding.
When changing the dashboard payload or rating semantics, increment the cache
schema version in `web/lib/dashboard-cache.ts`.

`dashboard_timing` logs contain aggregate durations only. The dashboard endpoint
also returns aggregate `Server-Timing` durations while retaining `Cache-Control:
no-store`. Timing fields for replay reads and Elo calculation are absent on hits.

Profile/chart code is loaded on hover, focus, or open, with an additional idle
preload after the window load event. Hover/focus prefetches only the selected
player and season through the existing client cache. Refresh invalidates those
entries. Production module-download retries use a new query on the same-origin
profile chunk identified by Vite module-preload links; update that lookup if the
bundler asset path changes. Successfully preloaded content is reused synchronously
to avoid a skeleton flash. API writes invalidate the server snapshot; already-open browsers update
on their next refresh/focus, without push notifications.

### Seasonal WebP assets

Original PNGs are retained in `web/assets/seasonal-originals`, outside the served
public directory. Run `npm run assets:seasonal` from `web/` to generate transparent
WebP files at quality 85 and alpha quality 100, plus the content-hashed URL manifest
`web/lib/seasonal-assets.json`. Dimensions remain unchanged so atlas clipping
coordinates remain valid. Review the output visually before removing superseded
hashed files. Social preview images and SVG icons are independent.

### Reproducing measurements

Run a local production build, apply local migrations, then start Wrangler against
`dist/server/wrangler.json` with the same persisted local database. The measurement
script performs five fresh/repeat pairs for desktop and mobile (390 × 844, 4× CPU
slowdown, 150 ms network latency, 200 KB/s download). Each sample includes a
three-second post-load observation and waits for network idle, so total bytes
include decorative artwork and idle preloads. Resource start times distinguish
critical downloads from deferred code. JavaScript time uses Chrome's per-document
`ScriptDuration`; it is not a time-to-interactive metric.

```sh
npm run measure:performance -- http://127.0.0.1:8788 outputs/performance.json
npm run test:performance:browser
```

Set `PLAYWRIGHT_TEST_MODULE` to an installed Playwright module when it is not
available in the project. Set `TICHU_TEST_URL` for browser tests. Tests require a
local production build; the measurement script also supports read-only live-site
measurements. Keep production and local results separate, and run browser
measurements without other concurrent browser suites.
