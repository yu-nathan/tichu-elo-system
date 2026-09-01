export type EloPlayer = {
  id: number;
  code: string;
  name: string;
  archivedAt: string | null;
};

export type EloGame = {
  id: number;
  teamAPlayer1Id: number;
  teamAPlayer2Id: number;
  scoreA: number;
  teamBPlayer1Id: number;
  teamBPlayer2Id: number;
  scoreB: number;
  playedAt: string;
  callStats?: GameCallStat[];
};

export type GameCallStat = {
  playerId: number;
  grandTichus: number;
  successfulGrandTichus: number;
  tichus: number;
  successfulTichus: number;
};

export type RatingEntry = EloPlayer & {
  rating: number;
  gamesPlayed: number;
  grandTichus: number;
  successfulGrandTichus: number;
  tichus: number;
  successfulTichus: number;
};
export type FairMatch = {
  teamA: [RatingEntry, RatingEntry];
  teamB: [RatingEntry, RatingEntry];
  ratingA: number;
  ratingB: number;
  gap: number;
  benched: RatingEntry[];
};

export const calculateRatings = (
  players: EloPlayer[],
  games: EloGame[],
  initial = 1000,
  kFactor = 32,
): RatingEntry[] => {
  const state = new Map(
    players.map((player) => [
      player.id,
      {
        rating: initial,
        gamesPlayed: 0,
        grandTichus: 0,
        successfulGrandTichus: 0,
        tichus: 0,
        successfulTichus: 0,
      },
    ]),
  );
  const ordered = [...games].sort(
    (a, b) => a.playedAt.localeCompare(b.playedAt) || a.id - b.id,
  );

  for (const game of ordered) {
    const teamA = [game.teamAPlayer1Id, game.teamAPlayer2Id];
    const teamB = [game.teamBPlayer1Id, game.teamBPlayer2Id];
    const ratingA =
      teamA.reduce((sum, id) => sum + state.get(id)!.rating, 0) / 2;
    const ratingB =
      teamB.reduce((sum, id) => sum + state.get(id)!.rating, 0) / 2;
    const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
    const actualA = game.scoreA > game.scoreB ? 1 : 0;
    const effectiveK =
      game.scoreA < 1000 && game.scoreB < 1000 ? kFactor / 2 : kFactor;
    const delta = effectiveK * (actualA - expectedA);
    for (const id of teamA) {
      const current = state.get(id)!;
      state.set(id, {
        ...current,
        rating: current.rating + delta,
        gamesPlayed: current.gamesPlayed + 1,
      });
    }
    for (const id of teamB) {
      const current = state.get(id)!;
      state.set(id, {
        ...current,
        rating: current.rating - delta,
        gamesPlayed: current.gamesPlayed + 1,
      });
    }
    for (const stat of game.callStats ?? []) {
      const current = state.get(stat.playerId);
      if (!current) continue;
      state.set(stat.playerId, {
        ...current,
        grandTichus: current.grandTichus + stat.grandTichus,
        successfulGrandTichus:
          current.successfulGrandTichus + stat.successfulGrandTichus,
        tichus: current.tichus + stat.tichus,
        successfulTichus: current.successfulTichus + stat.successfulTichus,
      });
    }
  }

  return players.map((player) => ({ ...player, ...state.get(player.id)! }));
};

export const createFairMatch = (entries: RatingEntry[]): FairMatch | null => {
  const active = entries.filter((entry) => !entry.archivedAt);
  if (active.length < 4) return null;
  let best: FairMatch | null = null;
  for (let a = 0; a < active.length - 3; a += 1) {
    for (let b = a + 1; b < active.length - 2; b += 1) {
      for (let c = b + 1; c < active.length - 1; c += 1) {
        for (let d = c + 1; d < active.length; d += 1) {
          const group = [active[a], active[b], active[c], active[d]] as const;
          const splits: Array<
            [[RatingEntry, RatingEntry], [RatingEntry, RatingEntry]]
          > = [
            [
              [group[0], group[1]],
              [group[2], group[3]],
            ],
            [
              [group[0], group[2]],
              [group[1], group[3]],
            ],
            [
              [group[0], group[3]],
              [group[1], group[2]],
            ],
          ];
          for (const [teamA, teamB] of splits) {
            const ratingA = (teamA[0].rating + teamA[1].rating) / 2;
            const ratingB = (teamB[0].rating + teamB[1].rating) / 2;
            const gap = Math.abs(ratingA - ratingB);
            if (!best || gap < best.gap) {
              const used = new Set(
                [...teamA, ...teamB].map((player) => player.id),
              );
              best = {
                teamA,
                teamB,
                ratingA,
                ratingB,
                gap,
                benched: active.filter((p) => !used.has(p.id)),
              };
            }
          }
        }
      }
    }
  }
  return best;
};
