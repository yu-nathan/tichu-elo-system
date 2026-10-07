import {
  calculateRatingHistory,
  type EloGame,
  type EloPlayer,
  type RatingEntry,
  type RatingHistoryPoint,
} from "./elo.ts";

export type PartnerSummary = {
  id: number;
  name: string;
  games: number;
  wins: number;
  losses: number;
};

export type PlayerProfile = {
  player: RatingEntry;
  wins: number;
  losses: number;
  history: RatingHistoryPoint[];
  bestFriends: PartnerSummary[];
  carryingMe: PartnerSummary[];
  draggingMeDown: PartnerSummary[];
};

const leadingPartners = (
  partners: PartnerSummary[],
  field: "games" | "wins" | "losses",
) => {
  const most = partners.reduce(
    (max, partner) => Math.max(max, partner[field]),
    0,
  );
  return partners
    .filter((partner) => most > 0 && partner[field] === most)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
};

export const calculatePlayerProfile = (
  players: EloPlayer[],
  games: EloGame[],
  playerId: number,
): PlayerProfile | null => {
  const { player, history } = calculateRatingHistory(players, games, playerId);
  if (!player) return null;
  const names = new Map(players.map(({ id, name }) => [id, name]));
  const partners = new Map<number, PartnerSummary>();
  let wins = 0;
  let losses = 0;

  for (const game of games) {
    const teamA = [game.teamAPlayer1Id, game.teamAPlayer2Id];
    const teamB = [game.teamBPlayer1Id, game.teamBPlayer2Id];
    const team = teamA.includes(playerId)
      ? teamA
      : teamB.includes(playerId)
        ? teamB
        : null;
    if (!team) continue;
    const won =
      team === teamA ? game.scoreA > game.scoreB : game.scoreB > game.scoreA;
    if (won) wins += 1;
    else losses += 1;
    const partnerId = team.find((id) => id !== playerId)!;
    const partner = partners.get(partnerId) ?? {
      id: partnerId,
      name: names.get(partnerId)!,
      games: 0,
      wins: 0,
      losses: 0,
    };
    partner.games += 1;
    if (won) partner.wins += 1;
    else partner.losses += 1;
    partners.set(partnerId, partner);
  }

  const summaries = [...partners.values()];
  return {
    player,
    wins,
    losses,
    history,
    bestFriends: leadingPartners(summaries, "games"),
    carryingMe: leadingPartners(summaries, "wins"),
    draggingMeDown: leadingPartners(summaries, "losses"),
  };
};
