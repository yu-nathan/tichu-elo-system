"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  LogIn,
  Settings,
  Shuffle,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createFairMatch } from "@/lib/elo";
import { discordHistory, discordLeaderboard } from "@/lib/discord";
import type { FairMatch } from "@/lib/elo";
import type { AppData } from "@/lib/store";

type Props = {
  data: AppData;
  userEmail: string | null;
  isAdmin: boolean;
  signInHref: string;
  signOutHref: string;
};

export const Dashboard = ({
  data,
  userEmail,
  isAdmin,
  signInHref,
  signOutHref,
}: Props) => {
  const active = data.leaderboard.filter((player) => !player.archivedAt);
  const [selected, setSelected] = useState(
    () => new Set(active.map((player) => player.id)),
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [randomMatch, setRandomMatch] = useState<FairMatch | null>(null);
  const match = useMemo(
    () => createFairMatch(active.filter((player) => selected.has(player.id))),
    [active, selected],
  );
  const displayedMatch = randomMatch ?? match;

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const togglePlayer = (id: number) => {
    setRandomMatch(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const randomizeTeams = () => {
    const pool = active.filter((player) => selected.has(player.id));
    if (pool.length !== 4) return;
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
      const swapIndex = Math.floor(random * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    const teamA = [pool[0], pool[1]] as FairMatch["teamA"];
    const teamB = [pool[2], pool[3]] as FairMatch["teamB"];
    const ratingA = (teamA[0].rating + teamA[1].rating) / 2;
    const ratingB = (teamB[0].rating + teamB[1].rating) / 2;
    setRandomMatch({
      teamA,
      teamB,
      ratingA,
      ratingB,
      gap: Math.abs(ratingA - ratingB),
      benched: [],
    });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between border-b border-white/8 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
              <Sparkles className="size-3.5" /> Tichu Elo
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Live standings, match history, and balanced teams.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button size="sm" render={<a href="/admin" />}>
                <Settings /> Manage
              </Button>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground"
                render={<a href={signInHref} target="_top" />}
              >
                <LogIn /> Admin sign in
              </Button>
            )}
            {userEmail && !isAdmin ? (
              <Button
                size="xs"
                variant="ghost"
                render={<a href={signOutHref} target="_top" />}
              >
                Sign out
              </Button>
            ) : null}
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <Card className="border-white/8 bg-card/80 shadow-2xl shadow-black/20">
            <CardHeader className="border-b border-white/8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Badge
                    variant="outline"
                    className="border-amber-300/30 text-amber-200"
                  >
                    Standings
                  </Badge>
                  <CardTitle className="mt-3 text-xl">Leaderboard</CardTitle>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copy("leaderboard", discordLeaderboard(data))}
                >
                  {copied === "leaderboard" ? <Check /> : <Copy />}{" "}
                  {copied === "leaderboard" ? "Copied" : "Copy for Discord"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div className="hidden grid-cols-[3.5rem_1fr_5.5rem_2.5rem_4rem_4rem] px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:grid">
                <span>Rank</span>
                <span>Player</span>
                <span className="text-right">Rating</span>
                <span className="text-right">GP</span>
                <span className="text-right">GT</span>
                <span className="text-right">Tichu</span>
              </div>
              {active.map((player, index) => (
                <div key={player.id} className="border-t border-white/6">
                  <div className="hidden grid-cols-[3.5rem_1fr_5.5rem_2.5rem_4rem_4rem] items-center px-5 py-3.5 sm:grid">
                    <Rank index={index} />
                    <span className="truncate font-medium">{player.name}</span>
                    <span className="text-right font-mono text-emerald-200">
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
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {player.name}
                      </span>
                      <span className="font-mono text-emerald-200">
                        {player.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 pl-8 text-[11px] text-muted-foreground">
                      <span>Games {player.gamesPlayed}</span>
                      <span>
                        GT{" "}
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

          <div className="grid content-start gap-5">
            <Card className="border-emerald-400/15 bg-gradient-to-br from-emerald-400/10 to-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className="bg-emerald-300 text-emerald-950">
                    Matchmaker
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={selected.size !== 4}
                    onClick={randomizeTeams}
                  >
                    <Shuffle /> Randomize teams
                  </Button>
                </div>
                <CardTitle className="mt-3 text-xl">
                  {displayedMatch
                    ? `${displayedMatch.gap.toFixed(1)} rating gap`
                    : "Choose at least 4 players"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Users className="size-3.5" /> Eligible players
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        />
                      }
                    >
                      <span>
                        {selected.size === active.length
                          ? "All players"
                          : `${selected.size} of ${active.length} players`}
                      </span>
                      <ChevronDown />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-64">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Matchmaking pool</DropdownMenuLabel>
                        {active.map((player) => (
                          <DropdownMenuCheckboxItem
                            key={player.id}
                            checked={selected.has(player.id)}
                            closeOnClick={false}
                            onCheckedChange={() => togglePlayer(player.id)}
                          >
                            {player.name}
                            <span className="ml-auto font-mono text-xs text-muted-foreground">
                              {player.rating.toFixed(0)}
                            </span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {displayedMatch ? (
                  <div className="space-y-2">
                    <Team
                      label="Team one"
                      names={displayedMatch.teamA
                        .map((p) => p.name)
                        .join(" + ")}
                      rating={displayedMatch.ratingA}
                    />
                    <Team
                      label="Team two"
                      names={displayedMatch.teamB
                        .map((p) => p.name)
                        .join(" + ")}
                      rating={displayedMatch.ratingB}
                    />
                    {displayedMatch.benched.length ? (
                      <p className="text-xs text-muted-foreground">
                        Benched:{" "}
                        {displayedMatch.benched.map((p) => p.name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copy("history", discordHistory(data))}
                  >
                    {copied === "history" ? <Check /> : <Copy />}{" "}
                    {copied === "history" ? "Copied" : "Copy for Discord"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 px-3">
                {data.games
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
                        <GameCallSummary game={game} />
                      </div>
                    );
                  })}
                {data.games.length > 3 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-muted-foreground"
                    onClick={() => setHistoryExpanded((value) => !value)}
                    aria-expanded={historyExpanded}
                  >
                    {historyExpanded
                      ? "Show last 3"
                      : `Show all ${Math.min(10, data.games.length)} games`}
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
          </div>
        </section>
      </div>
    </main>
  );
};

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

const formatRatio = (successes: number, attempts: number) =>
  attempts ? `${successes}/${attempts}` : "N/A";

const Rank = ({ index }: { index: number }) => (
  <span
    className={
      index < 3 ? "font-mono text-amber-300" : "font-mono text-muted-foreground"
    }
  >
    {String(index + 1).padStart(2, "0")}
  </span>
);

const GameCallSummary = ({ game }: { game: AppData["games"][number] }) => {
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

const Team = ({
  label,
  names,
  rating,
}: {
  label: string;
  names: string;
  rating: number;
}) => {
  return (
    <div className="rounded-lg border border-white/8 bg-black/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-medium">{names}</p>
        </div>
        <span className="font-mono text-xs text-emerald-200">
          {rating.toFixed(1)}
        </span>
      </div>
    </div>
  );
};
