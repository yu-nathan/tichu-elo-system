import type { AppData } from "@/lib/store";

export const discordLeaderboard = (data: AppData): string => {
  const active = data.leaderboard.filter((player) => !player.archivedAt);
  const nameWidth = Math.max(12, ...active.map((player) => player.name.length));
  const top = `╔${"═".repeat(6)}╦${"═".repeat(nameWidth + 2)}╦${"═".repeat(10)}╦${"═".repeat(7)}╗`;
  const middle = `╠${"═".repeat(6)}╬${"═".repeat(nameWidth + 2)}╬${"═".repeat(10)}╬${"═".repeat(7)}╣`;
  const bottom = `╚${"═".repeat(6)}╩${"═".repeat(nameWidth + 2)}╩${"═".repeat(10)}╩${"═".repeat(7)}╝`;
  const width = top.length - 2;
  const rows = [
    "```text",
    `╔${"═".repeat(width)}╗`,
    `║${"Tichu Leader Board".padStart(Math.floor((width + 18) / 2)).padEnd(width)}║`,
    top.replace(/^╔/, "╠").replace(/╗$/, "╣"),
    `║ Rank ║ ${"Player".padEnd(nameWidth)} ║   Rating ║ Games ║`,
    middle,
    ...active.map(
      (player, index) =>
        `║ ${String(index + 1)
          .padStart(2)
          .padEnd(
            4,
          )} ║ ${player.name.padEnd(nameWidth)} ║ ${player.rating.toFixed(1).padStart(8)} ║ ${String(player.gamesPlayed).padStart(3).padEnd(5)} ║`,
    ),
    bottom,
    "```",
  ];
  return rows.join("\n");
};

export const discordHistory = (data: AppData): string => {
  const games = data.games.slice(-10);
  const rows = [
    "```text",
    "╔═════════════════════════════════╗",
    "║          Last 10 Games          ║",
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
  return rows.join("\n");
};
