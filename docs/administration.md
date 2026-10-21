# Web administration

[← Documentation overview](../README.md)

## Admin access

The owner (`nyu1997@gmail.com`) can add admins in the management panel's
**Admins** section. Enter the email they use to sign in with ChatGPT. Added
admins can manage games and players; only the owner can add more admins. This
grants access without sending an invitation email. The owner always retains
access, and additional grants are stored in D1.

## API keys and alerts

See [API access and security](api-security.md) for owner-only key management,
automatic revocation, and dashboard alerts. Integrations use the
[external API reference](external-api.md).

## Ranked season cadence

Only the owner can change **Ranked seasons → Season cadence** in the admin
console. Choose monthly, every 3 months, every 6 months (the default), or yearly,
review the resulting current-season dates, then select **Save and recalculate**.

The schedule is anchored to July 2026 in Pacific time. Monthly seasons start on
the first; quarterly seasons start in January, April, July, and October;
six-month seasons start in January and July; yearly seasons start July 1.
Season 1 includes all earlier games. Changing the cadence applies retroactively:
season numbers and historical results may change, including bookmarked season
links. All Elo, call statistics, profiles, standings, and matchmaking are replayed
from saved games, with each season starting at 1000 Elo. Game records are preserved.
The external API uses the same current-season results.

Settings persist in D1. If another owner tab saves first, the stale save is
rejected: use **Refresh settings**, review the current schedule, and choose again.
Open leaderboard tabs refresh when they regain focus. If a save succeeds but the
admin refresh fails, refresh the data instead of submitting the change again.
