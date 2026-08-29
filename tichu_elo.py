#!/usr/bin/env python3
"""Calculate an individual Tichu leaderboard from ordered team results."""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path


PLAYERS = {
    "C": "Chanzo B.",
    "Y": "Yash S.",
    "S": "Sreekar M.",
    "R": "Rebekah S.",
    "N": "Nathan Y.",
}

GAME_RE = re.compile(
    r"^\s*([CYSRN]{2})\s*-\s*(-?\d+)\s+([CYSRN]{2})\s*-\s*(-?\d+)\s*$"
)


@dataclass(frozen=True)
class Game:
    team_a: str
    score_a: int
    team_b: str
    score_b: int


def parse_game(line: str, line_number: int) -> Game:
    match = GAME_RE.fullmatch(line)
    if not match:
        raise ValueError(f"line {line_number}: invalid game format: {line!r}")
    team_a, score_a, team_b, score_b = match.groups()
    if len(set(team_a)) != 2 or len(set(team_b)) != 2:
        raise ValueError(f"line {line_number}: a player cannot partner with themselves")
    if set(team_a) & set(team_b):
        raise ValueError(f"line {line_number}: a player cannot be on both teams")
    if score_a == score_b:
        raise ValueError(f"line {line_number}: tied games are not supported")
    return Game(team_a, int(score_a), team_b, int(score_b))


def load_games(path: Path) -> list[Game]:
    games: list[Game] = []
    for line_number, raw_line in enumerate(path.read_text().splitlines(), 1):
        line = raw_line.split("#", 1)[0].strip()
        if line:
            games.append(parse_game(line, line_number))
    return games


def calculate_ratings(
    games: list[Game], initial: float = 1000.0, k_factor: float = 32.0
) -> tuple[dict[str, float], dict[str, int]]:
    ratings = {code: initial for code in PLAYERS}
    games_played = {code: 0 for code in PLAYERS}

    for game in games:
        rating_a = sum(ratings[p] for p in game.team_a) / 2
        rating_b = sum(ratings[p] for p in game.team_b) / 2
        expected_a = 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
        actual_a = 1.0 if game.score_a > game.score_b else 0.0

        # Normalize margin by Tichu's 1,000-point winning target. Negative
        # scores need no special case: the arithmetic margin remains valid.
        margin_multiplier = 1 + abs(game.score_a - game.score_b) / 1000
        delta_a = k_factor * margin_multiplier * (actual_a - expected_a)

        for player in game.team_a:
            ratings[player] += delta_a
            games_played[player] += 1
        for player in game.team_b:
            ratings[player] -= delta_a
            games_played[player] += 1

    return ratings, games_played


def render_leaderboard(ratings: dict[str, float], games_played: dict[str, int]) -> str:
    ordered = sorted(PLAYERS, key=lambda p: (-ratings[p], PLAYERS[p]))
    rows = [
        "| Tichu Leader Board | | | |",
        "|:---|:---|---:|---:|",
        "| Rank | Player | Rating | Games |",
    ]
    for rank, code in enumerate(ordered, 1):
        rows.append(
            f"| {rank} | {PLAYERS[code]} | {ratings[code]:.1f} |"
            f" {games_played[code]} |"
        )
    return "\n".join(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scores", nargs="?", type=Path, default=Path("games.txt"))
    parser.add_argument("--initial", type=float, default=1000.0)
    parser.add_argument("--k-factor", type=float, default=32.0)
    args = parser.parse_args()

    try:
        games = load_games(args.scores)
        ratings, games_played = calculate_ratings(games, args.initial, args.k_factor)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(render_leaderboard(ratings, games_played))


if __name__ == "__main__":
    main()
