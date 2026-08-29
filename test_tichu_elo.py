import tempfile
import unittest
from pathlib import Path

from tichu_elo import (
    Game,
    calculate_ratings,
    create_fair_matchup,
    load_games,
    parse_game,
    render_leaderboard,
    render_matchup,
)


class TichuEloTests(unittest.TestCase):
    def test_parses_negative_score(self):
        self.assertEqual(parse_game("NY - 1105 SC - -205", 1), Game("NY", 1105, "SC", -205))

    def test_updates_in_input_order(self):
        games = [Game("CY", 1000, "NS", 0), Game("CY", 200, "RS", 1000)]
        forward, _ = calculate_ratings(games)
        reverse, _ = calculate_ratings(list(reversed(games)))
        self.assertNotEqual(forward, reverse)

    def test_rating_points_are_conserved(self):
        games = [Game("NY", 1105, "SC", -205)]
        ratings, _ = calculate_ratings(games)
        self.assertAlmostEqual(sum(ratings.values()), 5 * 1000)

    def test_ignores_blank_lines_and_comments(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "games.txt"
            path.write_text("# old games\n\nCY - 595 NS - 1005 # game one\n")
            self.assertEqual(len(load_games(path)), 1)

    def test_leaderboard_is_discord_ready(self):
        ratings, games_played = calculate_ratings([])
        output = render_leaderboard(ratings, games_played)
        self.assertTrue(output.startswith("```text\n"))
        self.assertTrue(output.endswith("\n```"))
        self.assertIn("|           Tichu Leader Board           |", output)
        self.assertIn("| Rank | Player       |   Rating | Games |", output)
        self.assertNotRegex(output, r"[╔╗╚╝║═╠╣╦╩╬]")

    def test_creates_fairest_team_split(self):
        ratings = {"C": 800, "Y": 1200, "S": 900, "R": 1000, "N": 1100}
        matchup = create_fair_matchup(ratings, ["C", "Y", "S", "N"])
        teams = {frozenset(matchup.team_a), frozenset(matchup.team_b)}
        self.assertEqual(teams, {frozenset(("C", "Y")), frozenset(("S", "N"))})
        self.assertEqual(matchup.rating_gap, 0)

    def test_five_players_includes_bench(self):
        ratings = {player: 1000 for player in "CYSRN"}
        matchup = create_fair_matchup(ratings, list("CYSRN"))
        self.assertIsNotNone(matchup.benched)
        self.assertEqual(len(set(matchup.team_a + matchup.team_b)), 4)

    def test_rejects_invalid_team_selection(self):
        ratings = {player: 1000 for player in "CYSRN"}
        with self.assertRaisesRegex(ValueError, "exactly 4 or 5"):
            create_fair_matchup(ratings, ["C", "Y", "S"])
        with self.assertRaisesRegex(ValueError, "only once"):
            create_fair_matchup(ratings, ["C", "C", "Y", "S"])

    def test_matchup_output_is_discord_ready(self):
        ratings = {player: 1000 for player in "CYSRN"}
        matchup = create_fair_matchup(ratings, list("CYSRN"))
        output = render_matchup(matchup, ratings)
        self.assertTrue(output.startswith("```text\nFair Tichu Matchup"))
        self.assertTrue(output.endswith("\n```"))
        self.assertIn("Rating gap:", output)
        self.assertIn("Benched:", output)


if __name__ == "__main__":
    unittest.main()
