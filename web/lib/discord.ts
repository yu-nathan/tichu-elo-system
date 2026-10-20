import type { Season } from "./seasons.ts";
import { formatRatio } from "./format.ts";
import type { AppData } from "./models.ts";

export const discordLeaderboard = (
  data: Pick<AppData, "leaderboard"> & { season?: Season },
): string => {
  const active = data.leaderboard.filter(
    (player) => data.season?.status === "completed" || !player.archivedAt,
  );
  const nameWidth = Math.max(12, ...active.map((player) => player.name.length));
  const top = `╔${"═".repeat(6)}╦${"═".repeat(nameWidth + 2)}╦${"═".repeat(10)}╦${"═".repeat(7)}╦${"═".repeat(7)}╦${"═".repeat(7)}╗`;
  const middle = `╠${"═".repeat(6)}╬${"═".repeat(nameWidth + 2)}╬${"═".repeat(10)}╬${"═".repeat(7)}╬${"═".repeat(7)}╬${"═".repeat(7)}╣`;
  const bottom = `╚${"═".repeat(6)}╩${"═".repeat(nameWidth + 2)}╩${"═".repeat(10)}╩${"═".repeat(7)}╩${"═".repeat(7)}╩${"═".repeat(7)}╝`;
  const width = top.length - 2;
  const rows = [
    "```text",
    `╔${"═".repeat(width)}╗`,
    `║${"Tichu Leader Board".padStart(Math.floor((width + 18) / 2)).padEnd(width)}║`,
    top.replace(/^╔/, "╠").replace(/╗$/, "╣"),
    `║ Rank ║ ${"Player".padEnd(nameWidth)} ║   Rating ║ Games ║  GT   ║ Tichu ║`,
    middle,
    ...active.map(
      (player, index) =>
        `║ ${String(index + 1)
          .padStart(2)
          .padEnd(
            4,
          )} ║ ${player.name.padEnd(nameWidth)} ║ ${player.rating.toFixed(1).padStart(8)} ║ ${String(player.gamesPlayed).padStart(3).padEnd(5)} ║ ${formatRatio(player.successfulGrandTichus, player.grandTichus).padStart(5)} ║ ${formatRatio(player.successfulTichus, player.tichus).padStart(5)} ║`,
    ),
    bottom,
    "```",
  ];
  return [
    data.season
      ? `${data.season.label} · ${data.season.status === "completed" ? "Final standings" : "Current standings"}`
      : null,
    ...rows,
  ]
    .filter((line) => line !== null)
    .join("\n");
};

export const discordHistory = (
  data: Pick<AppData, "games"> & { season?: Season | null },
): string => {
  const games = [...data.games]
    .sort(
      (a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || a.id - b.id,
    )
    .slice(-10);
  const rows = [
    "```text",
    "╔═════════════════════════════════╗",
    "║          Last 10 games          ║",
    "╠═════╦════╦════════╦════╦════════╣",
    "║  #  ║ T1 ║  Score ║ T2 ║  Score ║",
    "╠═════╬════╬════════╬════╬════════╣",
    ...games.map(
      (game) =>
        `║ ${String(game.id).padStart(3)} ║ ${game.teamACode.padEnd(2)} ║ ${String(game.scoreA).padStart(6)} ║ ${game.teamBCode.padEnd(2)} ║ ${String(game.scoreB).padStart(6)} ║`,
    ),
    "╚═════╩════╩════════╩════╩════════╝",
    "```",
  ];
  return [
    data.season === undefined
      ? null
      : data.season === null
        ? "All seasons"
        : data.season.label,
    ...rows,
  ]
    .filter((line) => line !== null)
    .join("\n");
};
