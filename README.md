# Tichu Elo leaderboard

Track individual Elo ratings from Tichu team results with a web leaderboard,
admin console, create-only external API, and Python command-line tool. Every
player starts at 1000; ratings are recalculated in game order.

[Open the leaderboard](https://tichu-elo.nyu1997.chatgpt.site)

## Documentation

| Guide                                           | Contents                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| [Command-line usage](docs/cli.md)               | Run the Python tool, record results, balance teams, and understand rating rules |
| [Web administration](docs/administration.md)    | Owner and admin permissions and access management                               |
| [Web development](docs/development.md)          | Local setup, migrations, code organization, and validation                      |
| [External API reference](docs/external-api.md)  | Authentication, endpoints, payloads, pagination, and safe retries               |
| [API access and security](docs/api-security.md) | Key storage and expiration, throttling, automatic revocation, and alerts        |

## Quick start

Run the command-line leaderboard from the repository root:

```sh
python3 tichu_elo.py
```

For the web application, follow the [development setup](docs/development.md).
