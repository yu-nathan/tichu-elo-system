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
        self.assertAlmostEqual(sum(ratings.values()), len(ratings) * 1000)

    def test_score_margin_does_not_affect_rating_change(self):
        close_ratings, _ = calculate_ratings([Game("NY", 1000, "SC", 900)])
        blowout_ratings, _ = calculate_ratings([Game("NY", 1400, "SC", -200)])
        self.assertEqual(close_ratings, blowout_ratings)

    def test_game_under_1000_uses_half_rating_change(self):
        normal_ratings, _ = calculate_ratings([Game("NY", 1000, "SC", 0)])
        short_ratings, _ = calculate_ratings([Game("NY", 500, "SC", 0)])
        normal_change = normal_ratings["N"] - 1000
        short_change = short_ratings["N"] - 1000
        self.assertAlmostEqual(short_change, normal_change / 2)

    def test_ignores_blank_lines_and_comments(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "games.txt"
            path.write_text("# old games\n\nCY - 595 NS - 1005 # game one\n")
            self.assertEqual(len(load_games(path)), 1)

    def test_leaderboard_is_discord_ready(self):
        ratings, games_played = calculate_ratings([])
        output = render_leaderboard(ratings, games_played, [])
        self.assertTrue(output.startswith("```text\n"))
        self.assertTrue(output.endswith("\n```"))
        title_row = next(line for line in output.splitlines() if "Tichu Leader Board" in line)
        self.assertTrue(title_row.startswith("║"))
        self.assertTrue(title_row.endswith("║"))
        self.assertIn("║ Rank ║ Player       ║   Rating ║ Games ║", output)
        self.assertIn("║  1   ║", output)
        self.assertIn("╠══════╬══════════════╬══════════╬═══════╣", output)
        self.assertIn("Last 10 Games", output)
        self.assertIn("No games played", output)

    def test_leaderboard_shows_only_ten_most_recent_games(self):
        games = [Game("CY", 1000 + number, "NS", number) for number in range(12)]
        ratings, games_played = calculate_ratings(games)
        output = render_leaderboard(ratings, games_played, games)
        self.assertNotIn("║   2 ║", output)
        self.assertIn("║   3 ║ CY ║   1002 ║ NS ║      2 ║", output)
        self.assertIn("║  12 ║ CY ║   1011 ║ NS ║     11 ║", output)

    def test_creates_fairest_team_split(self):
        ratings = {"C": 800, "Y": 1200, "S": 900, "R": 1000, "N": 1100}
        matchup = create_fair_matchup(ratings, ["C", "Y", "S", "N"])
        teams = {frozenset(matchup.team_a), frozenset(matchup.team_b)}
        self.assertEqual(teams, {frozenset(("C", "Y")), frozenset(("S", "N"))})
        self.assertEqual(matchup.rating_gap, 0)

    def test_five_players_includes_bench(self):
        ratings = {player: 1000 for player in "CYSRN"}
        matchup = create_fair_matchup(ratings, list("CYSRN"))
        self.assertTrue(matchup.benched)
        self.assertEqual(len(set(matchup.team_a + matchup.team_b)), 4)

    def test_rejects_invalid_team_selection(self):
        ratings = {player: 1000 for player in "CYSRN"}
        with self.assertRaisesRegex(ValueError, "at least 4"):
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

    def test_parser_accepts_players_from_player_mapping(self):
        self.assertEqual(parse_game("NJ - 340 SC - 555", 1), Game("NJ", 340, "SC", 555))


if __name__ == "__main__":
    unittest.main()
