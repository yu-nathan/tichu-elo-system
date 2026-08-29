import tempfile
import unittest
from pathlib import Path

from tichu_elo import Game, calculate_ratings, load_games, parse_game, render_leaderboard


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

    def test_leaderboard_is_copy_friendly_markdown(self):
        ratings, games_played = calculate_ratings([])
        output = render_leaderboard(ratings, games_played)
        self.assertTrue(output.startswith("| Tichu Leader Board | | | |"))
        self.assertIn("| Rank | Player | Rating | Games |", output)
        self.assertNotRegex(output, r"[╔╗╚╝║═╠╣╦╩╬]")


if __name__ == "__main__":
    unittest.main()
