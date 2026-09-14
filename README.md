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
