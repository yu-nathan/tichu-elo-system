# Tichu Elo leaderboard

This lightweight program recalculates individual Elo ratings from team results in
the exact order they appear in `games.txt`. Every player starts at 1000.

Run it with:

```sh
python3 tichu_elo.py
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

The default K-factor is 32. Score margin is normalized against Tichu's 1,000-point
winning target:

```text
rating change = 32 * (1 + absolute score difference / 1000)
                    * (actual result - expected result)
```

Thus a 1,000-point margin doubles the usual update. Negative scores are handled
naturally by the score difference. The starting rating and K-factor can be changed
with `--initial` and `--k-factor`.
