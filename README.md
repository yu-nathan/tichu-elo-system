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
