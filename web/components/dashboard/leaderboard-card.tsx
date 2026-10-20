"use client";

import { seasonDateLabel, type Season } from "@/lib/seasons";
import { THEME_LABELS, type SeasonalTheme } from "@/lib/seasonal-theme";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SeasonSelect } from "@/components/season-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRatio } from "@/lib/format";
import type { RatingEntry } from "@/lib/elo";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { PlayerProfileLoader } from "@/components/dashboard/player-profile-loader";
import { SeasonalArt } from "@/components/dashboard/seasonal-decorations";

export const LeaderboardCard = ({
  active,
  season,
  seasons,
  onSeasonChange,
  loading,
  error,
  onRetry,
  theme = "default",
  copied,
  onCopy,
}: {
  active: RatingEntry[];
  season: Season;
  seasons: Season[];
  onSeasonChange: (id: number) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  theme?: SeasonalTheme;
  copied: boolean;
  onCopy: () => void;
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  return (
    <Dialog>
      <Card className="h-full min-h-0 border-white/8 bg-card/80 shadow-2xl shadow-black/20">
        <CardHeader className="shrink-0 border-b border-white/8">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="seasonal-heading-art pointer-events-none aspect-square w-32 shrink-0 sm:w-48"
              aria-hidden="true"
            >
              {theme !== "default" ? (
                <SeasonalArt theme={theme} variant={0} />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-full">
                <Badge
                  variant="outline"
                  className="max-w-full whitespace-normal border-seasonal-rank/30 text-seasonal-badge"
                >
                  {Object.entries(THEME_LABELS).map(([name, label]) => (
                    <span
                      key={name}
                      className={`seasonal-standings-label seasonal-standings-label--${name}`}
                    >
                      {name === "default" ? "Standings" : `${label} standings`}
                    </span>
                  ))}
                </Badge>
                <CardTitle className="mt-3 text-xl">Leaderboard</CardTitle>
                <div className="mt-2">
                  <SeasonSelect
                    seasons={seasons}
                    value={season.id}
                    label="Leaderboard season"
                    onChange={(id) => {
                      if (id !== null) onSeasonChange(id);
                    }}
                  />
                </div>
                {season.status === "completed" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Final standings · All participants
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {seasonDateLabel(season)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onCopy}
                disabled={loading || Boolean(error)}
              >
                {copied ? <Check /> : <Copy />}{" "}
                {copied ? "Copied" : "Copy for Discord"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent
          as="section"
          aria-label="Leaderboard players"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_5rem_6rem_6rem_4rem] gap-3 px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:grid">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Rating</span>
            <span className="text-right">Games played</span>
            <span className="text-right">Grand Tichu</span>
            <span className="text-right">Tichu</span>
          </div>
          {error ? (
            <div role="alert" className="p-5 text-sm">
              {error}{" "}
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry season
              </Button>
            </div>
          ) : loading ? (
            <p role="status" className="p-5 text-sm text-muted-foreground">
              Loading season…
            </p>
          ) : (
            !active.length && (
              <p className="p-5 text-sm text-muted-foreground">
                No participants in this season.
              </p>
            )
          )}
          {!error &&
            !loading &&
            active.map((player, index) => (
              <div key={player.id} className="border-t border-white/6">
                <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_5rem_6rem_6rem_4rem] gap-3 items-center px-5 py-3.5 sm:grid">
                  <Rank index={index} />
                  <PlayerTrigger
                    player={player}
                    onSelect={setSelectedPlayerId}
                  />
                  <span className="text-right font-mono text-seasonal-rating">
                    {player.rating.toFixed(1)}
                  </span>
                  <span className="text-right font-mono text-muted-foreground">
                    {player.gamesPlayed}
                  </span>
                  <SuccessRatio
                    successes={player.successfulGrandTichus}
                    attempts={player.grandTichus}
                  />
                  <SuccessRatio
                    successes={player.successfulTichus}
                    attempts={player.tichus}
                  />
                </div>
                <div className="px-4 py-3.5 sm:hidden">
                  <div className="flex items-center gap-3">
                    <Rank index={index} />
                    <div className="min-w-0 flex-1">
                      <PlayerTrigger
                        player={player}
                        onSelect={setSelectedPlayerId}
                      />
                    </div>
                    <span className="font-mono text-seasonal-rating">
                      {player.rating.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 pl-8 text-[11px] text-muted-foreground">
                    <span>Games played {player.gamesPlayed}</span>
                    <span>
                      Grand Tichu{" "}
                      {formatRatio(
                        player.successfulGrandTichus,
                        player.grandTichus,
                      )}
                    </span>
                    <span>
                      Tichu{" "}
                      {formatRatio(player.successfulTichus, player.tichus)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
      {selectedPlayerId !== null ? (
        <PlayerProfileLoader
          key={`${selectedPlayerId}:${season.id}`}
          initialSeason={season}
          seasons={seasons}
          playerId={selectedPlayerId}
          name={
            active.find(({ id }) => id === selectedPlayerId)?.name ?? "Player"
          }
        />
      ) : null}
    </Dialog>
  );
};

const PlayerTrigger = ({
  player,
  onSelect,
}: {
  player: RatingEntry;
  onSelect: (id: number) => void;
}) => (
  <DialogTrigger
    onClick={() => onSelect(player.id)}
    aria-label={`View ${player.name}'s profile`}
    className="min-w-0 max-w-full cursor-pointer truncate rounded-sm text-left font-medium underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
  >
    {player.name}
  </DialogTrigger>
);

const SuccessRatio = ({
  successes,
  attempts,
}: {
  successes: number;
  attempts: number;
}) => (
  <span className="text-right font-mono text-xs text-muted-foreground">
    {formatRatio(successes, attempts)}
  </span>
);

const Rank = ({ index }: { index: number }) => (
  <span
    className={
      index < 3
        ? "font-mono text-leaderboard-rank"
        : "font-mono text-muted-foreground"
    }
  >
    {String(index + 1).padStart(2, "0")}
  </span>
);
