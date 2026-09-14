"use client";
import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedDateTime } from "@/components/localized-date-time";
import type { Game } from "@/lib/models";

export const HistoryCard = ({
  games,
  copied,
  onCopy,
}: {
  games: Game[];
  copied: boolean;
  onCopy: () => void;
}) => {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  return (
    <Card className="border-white/8 bg-card/80">
      <CardHeader className="border-b border-white/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge
              variant="outline"
              className="border-amber-300/30 text-amber-200"
            >
              History
            </Badge>
            <CardTitle className="mt-3">Recent games</CardTitle>
          </div>
          <Button variant="secondary" size="sm" onClick={onCopy}>
            {copied ? <Check /> : <Copy />}{" "}
            {copied ? "Copied" : "Copy for Discord"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 px-3">
        {games
          .slice(historyExpanded ? -10 : -3)
          .reverse()
          .map((game) => {
            const teamAWon = game.scoreA > game.scoreB;
            const differential = Math.abs(game.scoreA - game.scoreB);
            return (
              <div
                key={game.id}
                className="grid grid-cols-[2.25rem_1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-white/4"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  #{game.id}
                </span>
                <div className="min-w-0 text-sm">
                  <p
                    className={
                      teamAWon
                        ? "truncate font-medium text-emerald-200"
                        : "truncate text-muted-foreground"
                    }
                  >
                    {game.teamAPlayer1Name} + {game.teamAPlayer2Name}
                  </p>
                  <p
                    className={
                      !teamAWon
                        ? "truncate font-medium text-emerald-200"
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
                        ? "font-semibold text-emerald-200"
                        : "text-muted-foreground"
                    }
                  >
                    {game.scoreA}
                  </p>
                  <p
                    className={
                      !teamAWon
                        ? "font-semibold text-emerald-200"
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
                  <p className="font-mono text-xs text-amber-300">
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
        {games.length > 3 ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-muted-foreground"
            onClick={() => setHistoryExpanded((value) => !value)}
            aria-expanded={historyExpanded}
          >
            {historyExpanded
              ? "Show last 3"
              : `Show all ${Math.min(10, games.length)} games`}
            <ChevronDown
              className={
                historyExpanded
                  ? "rotate-180 transition-transform"
                  : "transition-transform"
              }
            />
          </Button>
        ) : null}
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
