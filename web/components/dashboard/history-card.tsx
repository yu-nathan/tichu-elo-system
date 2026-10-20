"use client";
import { SeasonSelect } from "@/components/season-select";
import type { Season } from "@/lib/seasons";
import { useGameHistory } from "@/hooks/use-game-history";
import { HistoryPlayerFilter } from "@/components/dashboard/history-player-filter";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedDateTime } from "@/components/localized-date-time";
import type { Game, GamePage, Player } from "@/lib/models";

export const HistoryCard = ({
  initialPage,
  players,
  season,
  seasons,
  copied,
  onCopy,
}: {
  initialPage: GamePage;
  season: Season;
  seasons: Season[];
  players: Player[];
  copied: boolean;
  onCopy: (games: Game[], season: Season | null) => void;
}) => {
  const {
    games,
    hasMore,
    playerId,
    selectPlayer,
    seasonId,
    selectSeason,
    loading,
    error,
    loadMore,
    rootRef,
    sentinelRef,
  } = useGameHistory(initialPage, season.id);
  return (
    <Card className="h-full min-h-0 border-white/8 bg-card/80">
      <CardHeader className="shrink-0 border-b border-white/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge
              variant="outline"
              className="border-seasonal-rank/30 text-seasonal-badge"
            >
              History
            </Badge>
            <CardTitle className="mt-3">Recent games</CardTitle>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={!games.length}
            onClick={() =>
              onCopy(games, seasons.find(({ id }) => id === seasonId) ?? null)
            }
          >
            {copied ? <Check /> : <Copy />}{" "}
            {copied ? "Copied" : "Copy for Discord"}
          </Button>
        </div>
        <SeasonSelect
          seasons={seasons}
          value={seasonId}
          onChange={selectSeason}
          label="Filter game history by season"
          allowAll
        />
        <HistoryPlayerFilter
          players={players}
          playerId={playerId}
          onChange={selectPlayer}
        />
      </CardHeader>
      <CardContent
        as="section"
        ref={(node) => {
          rootRef.current = node;
        }}
        aria-label="Recent games list"
        aria-busy={loading}
        tabIndex={0}
        className="relative min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {games.map((game) => {
          const teamAWon = game.scoreA > game.scoreB;
          const differential = Math.abs(game.scoreA - game.scoreB);
          return (
            <div
              key={game.id}
              data-game-id={game.id}
              className="grid grid-cols-[2.25rem_1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-white/4"
            >
              <span className="font-mono text-xs text-muted-foreground">
                #{game.id}
              </span>
              <div className="min-w-0 text-sm">
                <p
                  className={
                    teamAWon
                      ? "truncate font-medium text-seasonal-rating"
                      : "truncate text-muted-foreground"
                  }
                >
                  {game.teamAPlayer1Name} + {game.teamAPlayer2Name}
                </p>
                <p
                  className={
                    !teamAWon
                      ? "truncate font-medium text-seasonal-rating"
                      : "truncate text-muted-foreground"
                  }
                >
                  {game.teamBPlayer1Name} + {game.teamBPlayer2Name}
                </p>
              </div>
              <div className="text-right font-mono text-sm">
                <p
                  className={
                    teamAWon
                      ? "font-semibold text-seasonal-rating"
                      : "text-muted-foreground"
                  }
                >
                  {game.scoreA}
                </p>
                <p
                  className={
                    !teamAWon
                      ? "font-semibold text-seasonal-rating"
                      : "text-muted-foreground"
                  }
                >
                  {game.scoreB}
                </p>
              </div>
              <div className="min-w-12 text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Diff
                </p>
                <p className="font-mono text-xs text-seasonal-rank">
                  +{differential}
                </p>
              </div>
              <time
                dateTime={game.playedAt}
                className="col-span-4 text-xs text-muted-foreground"
              >
                <LocalizedDateTime value={game.playedAt} />
              </time>
              <GameCallSummary game={game} />
            </div>
          );
        })}
        <div ref={sentinelRef} className="h-1" aria-hidden="true" />
        {error ? (
          <div className="space-y-2 p-2">
            <p role="alert" className="text-sm">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              Retry loading games
            </Button>
          </div>
        ) : hasMore || loading ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            className="w-full text-muted-foreground"
            onClick={() => void loadMore()}
          >
            {loading ? "Loading games…" : "Load older games"}
          </Button>
        ) : (
          <p className="p-2 text-center text-xs text-muted-foreground">
            {games.length
              ? "All games loaded"
              : playerId !== null
                ? "No games found for this player"
                : "No games played yet"}
          </p>
        )}
        <output className="sr-only">
          {loading ? "Loading games" : `${games.length} games loaded`}
        </output>
      </CardContent>
    </Card>
  );
};
const GameCallSummary = ({ game }: { game: Game }) => {
  const players = new Map([
    [game.teamAPlayer1Id, game.teamAPlayer1Name],
    [game.teamAPlayer2Id, game.teamAPlayer2Name],
    [game.teamBPlayer1Id, game.teamBPlayer1Name],
    [game.teamBPlayer2Id, game.teamBPlayer2Name],
  ]);
  const callers = game.callStats.filter(
    ({ grandTichus, tichus }) => grandTichus > 0 || tichus > 0,
  );
  return (
    <div className="col-span-4 mt-1 border-t border-white/6 pt-2 text-[11px] text-muted-foreground">
      {callers.length ? (
        <div className="space-y-1">
          {callers.map((stat) => (
            <p key={stat.playerId}>
              <span className="text-foreground">
                Called by {players.get(stat.playerId)}:
              </span>{" "}
              {stat.grandTichus
                ? `Grand Tichu ${stat.successfulGrandTichus}/${stat.grandTichus} successful`
                : ""}
              {stat.grandTichus && stat.tichus ? " · " : ""}
              {stat.tichus
                ? `Tichu ${stat.successfulTichus}/${stat.tichus} successful`
                : ""}
            </p>
          ))}
        </div>
      ) : game.callStats.length ? (
        <span>No Tichu calls this game</span>
      ) : (
        <span>Calls: N/A</span>
      )}
    </div>
  );
};
