import {
  calculateRatingHistory,
  type EloGame,
  type EloPlayer,
  type RatingEntry,
  type RatingHistoryPoint,
  type PlayerGender,
} from "./elo.ts";

export type OpponentSummary = {
  id: number;
  name: string;
  gender: PlayerGender;
  games: number;
  wins: number;
  losses: number;
};

export type PartnerSummary = OpponentSummary & {
  tichus: number;
  successfulTichus: number;
};

export type PlayerProfile = {
  player: RatingEntry;
  wins: number;
  losses: number;
  history: RatingHistoryPoint[];
  bestFriends: PartnerSummary[];
  carryingMe: PartnerSummary[];
  draggingMeDown: PartnerSummary[];
  hasEligiblePartners: boolean;
  imHisBitch: PartnerSummary[];
  nemesis: OpponentSummary[];
  curbstomped: OpponentSummary[];
  hasEligibleOpponents: boolean;
};

export const MIN_PARTNER_GAMES = 3;
export const MIN_OPPONENT_GAMES = MIN_PARTNER_GAMES;
const PARTNER_SCORE_Z = 1.96;

export const tichuPartnerTitle = (
  partners: Pick<PartnerSummary, "gender">[],
) => {
  const possessive =
    partners.length === 1
      ? partners[0].gender === "F"
        ? "her"
        : "his"
      : "their";
  return `I'm ${possessive} bitch`;
};

// Lower endpoint of the 95% Wilson interval, used as a conservative ranking
// heuristic rather than a displayed win/loss percentage. Larger samples get
// less of a penalty, without letting game count replace the outcome rate.
// https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
const partnerRateScore = (rate: number, games: number) => {
  const zSquared = PARTNER_SCORE_Z ** 2;
  return (
    (rate +
      zSquared / (2 * games) -
      PARTNER_SCORE_Z *
        Math.sqrt((rate * (1 - rate)) / games + zSquared / (4 * games ** 2))) /
    (1 + zSquared / games)
  );
};

const leadingPlayers = <T extends OpponentSummary>(
  partners: T[],
  field: "games" | "wins" | "losses",
) => {
  const eligible = partners
    .filter(
      (partner) =>
        partner.games >= (field === "games" ? 1 : MIN_PARTNER_GAMES) &&
        partner[field] > 0,
    )
    .map((partner) => ({
      partner,
      score:
        field === "games"
          ? partner.games
          : partnerRateScore(partner[field] / partner.games, partner.games),
    }));
  if (!eligible.length) return [];
  const bestScore = eligible.reduce(
    (best, { score }) => Math.max(best, score),
    0,
  );
  return eligible
    .filter(({ score }) => score === bestScore)
    .map(({ partner }) => partner)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
};

const leadingTichuPartners = (partners: PartnerSummary[]) => {
  const eligible = partners
    .filter(
      ({ games, tichus, successfulTichus }) =>
        games >= MIN_PARTNER_GAMES && tichus > 0 && successfulTichus > 0,
    )
    .map((partner) => ({
      partner,
      // Calls determine the rate; games together determine its sample weight,
      // matching the other outcome highlights without treating calls as games.
      score: partnerRateScore(
        partner.successfulTichus / partner.tichus,
        partner.games,
      ),
    }));
  const bestScore = Math.max(...eligible.map(({ score }) => score));
  return eligible
    .filter(({ score }) => score === bestScore)
    .map(({ partner }) => partner)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
};

export const calculatePlayerProfile = (
  players: EloPlayer[],
  games: EloGame[],
  playerId: number,
): PlayerProfile | null => {
  const { player, history } = calculateRatingHistory(players, games, playerId);
  if (!player) return null;
  const playersById = new Map(players.map((player) => [player.id, player]));
  const partners = new Map<number, PartnerSummary>();
  const opponents = new Map<number, OpponentSummary>();
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
      name: playersById.get(partnerId)!.name,
      gender: playersById.get(partnerId)!.gender,
      games: 0,
      wins: 0,
      losses: 0,
      tichus: 0,
      successfulTichus: 0,
    };
    const calls = game.callStats?.find(
      ({ playerId }) => playerId === partnerId,
    );
    partner.tichus += calls?.tichus ?? 0;
    partner.successfulTichus += calls?.successfulTichus ?? 0;
    partner.games += 1;
    if (won) partner.wins += 1;
    else partner.losses += 1;
    partners.set(partnerId, partner);
    for (const opponentId of team === teamA ? teamB : teamA) {
      const opponent = opponents.get(opponentId) ?? {
        id: opponentId,
        name: playersById.get(opponentId)!.name,
        gender: playersById.get(opponentId)!.gender,
        games: 0,
        wins: 0,
        losses: 0,
      };
      opponent.games += 1;
      if (won) opponent.wins += 1;
      else opponent.losses += 1;
      opponents.set(opponentId, opponent);
    }
  }

  const summaries = [...partners.values()];
  const opponentSummaries = [...opponents.values()];
  return {
    nemesis: leadingPlayers(opponentSummaries, "losses"),
    curbstomped: leadingPlayers(opponentSummaries, "wins"),
    hasEligibleOpponents: opponentSummaries.some(
      ({ games }) => games >= MIN_OPPONENT_GAMES,
    ),
    player,
    wins,
    losses,
    history,
    imHisBitch: leadingTichuPartners(summaries),
    bestFriends: leadingPlayers(summaries, "games"),
    carryingMe: leadingPlayers(summaries, "wins"),
    draggingMeDown: leadingPlayers(summaries, "losses"),
    hasEligiblePartners: summaries.some(
      ({ games }) => games >= MIN_PARTNER_GAMES,
    ),
  };
};
