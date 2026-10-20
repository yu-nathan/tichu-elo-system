"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogIn, Settings, Sparkles } from "lucide-react";
import { useSeasonRefresh } from "@/hooks/use-season-refresh";
import { fetchDashboard, fetchSeasonStandings } from "@/lib/api-client";
import { createPlayerProfileCache } from "@/lib/player-profile-cache";
import { cn } from "@/lib/utils";
import { Tabs } from "@base-ui/react/tabs";
import { Button } from "@/components/ui/button";
import { LeaderboardCard } from "@/components/dashboard/leaderboard-card";
import { MatchmakerCard } from "@/components/dashboard/matchmaker-card";
import { HistoryCard } from "@/components/dashboard/history-card";
import { ThemeControls } from "@/components/dashboard/theme-controls";
import { useSiteTheme } from "@/components/seasonal-theme-provider";
import { useClipboard } from "@/hooks/use-clipboard";
import { discordHistory, discordLeaderboard } from "@/lib/discord";
import type { DashboardData, SeasonStandings } from "@/lib/models";

type Props = {
  data: DashboardData;
  initialSeasonId: number | null;
  userEmail: string | null;
  isAdmin: boolean;
  canPreviewThemes: boolean;
  signInHref: string;
  signOutHref: string;
};

export const Dashboard = ({
  data: initialData,
  initialSeasonId,
  userEmail,
  isAdmin,
  canPreviewThemes,
  signInHref,
  signOutHref,
}: Props) => {
  const [data, setData] = useState(initialData);
  const [profileCache] = useState(createPlayerProfileCache);
  // Null follows the current season across rollover; historical selections stay fixed.
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(
    initialSeasonId === initialData.season.id ? null : initialSeasonId,
  );
  const selectedSeason =
    data.seasons.find(({ id }) => id === selectedSeasonId) ?? data.season;
  const historical = selectedSeason.id !== data.season.id;
  const [standings, setStandings] = useState<SeasonStandings | null>(null);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setStandingsError(null);
    setStandings(null);
    if (!historical) return;
    const controller = new AbortController();
    void fetchSeasonStandings(selectedSeason.id, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setStandings(next);
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setStandingsError(error.message);
      });
    return () => controller.abort();
  }, [selectedSeason.id, historical, attempt, data]);
  const selectSeason = (id: number) => {
    setSelectedSeasonId(id === data.season.id ? null : id);
    const url = new URL(window.location.href);
    if (id === data.season.id) url.searchParams.delete("seasonId");
    else url.searchParams.set("seasonId", String(id));
    window.history.replaceState(null, "", url);
  };
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshRequest = useRef<AbortController | null>(null);
  useEffect(() => () => refreshRequest.current?.abort(), []);
  const refresh = () => {
    refreshRequest.current?.abort();
    const controller = new AbortController();
    refreshRequest.current = controller;
    void fetchDashboard(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          profileCache.invalidate();
          setData(next);
          setRefreshError(null);
        }
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setRefreshError(error.message);
      });
  };
  useSeasonRefresh(data.season, refresh);
  const season = useSiteTheme();
  const [view, setView] = useState("leaderboard");
  const active = useMemo(
    () => data.leaderboard.filter((player) => !player.archivedAt),
    [data.leaderboard],
  );
  const selectedStandings = historical
    ? standings?.season.id === selectedSeason.id
      ? standings
      : null
    : { ...data, leaderboard: active };
  const { copied, error, copy } = useClipboard();
  return (
    <main className="h-dvh overflow-hidden text-foreground">
      <div className="relative z-10 mx-auto flex h-full min-h-0 max-w-7xl flex-col px-3 py-3 sm:px-6 lg:px-8">
        <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-seasonal-brand">
              <Sparkles className="size-3.5" /> Tichu Elo
            </div>
            <p className="mt-2 hidden text-sm text-muted-foreground sm:block">
              Live standings, match history, and balanced teams.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            {isAdmin ? (
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={
                      season.preview
                        ? `/admin?theme=${season.preview}`
                        : "/admin"
                    }
                  />
                }
              >
                <Settings /> Manage
              </Button>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground"
                nativeButton={false}
                render={<a href={signInHref} target="_top" />}
              >
                <LogIn /> Admin sign in
              </Button>
            )}
            {userEmail && !isAdmin ? (
              <Button
                size="xs"
                variant="ghost"
                nativeButton={false}
                render={<a href={signOutHref} target="_top" />}
              >
                Sign out
              </Button>
            ) : null}
            <ThemeControls
              season={season}
              canPreviewThemes={canPreviewThemes}
            />
          </div>
        </header>

        {refreshError && (
          <div role="alert" className="mb-3 text-sm">
            {refreshError}{" "}
            <Button size="sm" variant="outline" onClick={refresh}>
              Refresh standings
            </Button>
          </div>
        )}
        {error ? (
          <p role="alert" className="mb-4 text-sm">
            {error}
          </p>
        ) : null}
        <Tabs.Root
          value={view}
          onValueChange={setView}
          className="flex min-h-0 flex-1 flex-col"
        >
          <Tabs.List
            aria-label="Dashboard views"
            className="mb-3 grid shrink-0 grid-cols-3 gap-1 rounded-lg bg-muted p-1 lg:hidden"
          >
            {[
              ["leaderboard", "Leaderboard"],
              ["matchmaker", "Matchmaker"],
              ["history", "Recent games"],
            ].map(([id, label]) => (
              <Tabs.Tab
                key={id}
                value={id}
                render={
                  <Button
                    variant={view === id ? "secondary" : "ghost"}
                    size="sm"
                  />
                }
              >
                {label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {/* CSS controls visibility so desktop can expose every panel. Keeping
              panels mounted preserves selections when mobile tabs change. */}
          <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_.8fr] lg:grid-rows-[minmax(--spacing(90),max-content)_minmax(0,1fr)]">
            <Tabs.Panel
              value="leaderboard"
              keepMounted
              inert={false}
              hidden={false}
              className={cn(
                "min-h-0 lg:row-span-2 lg:block",
                view !== "leaderboard" && "hidden",
              )}
            >
              <LeaderboardCard
                profileCache={profileCache}
                active={selectedStandings?.leaderboard ?? []}
                season={selectedSeason}
                onSeasonChange={selectSeason}
                loading={!selectedStandings && !standingsError}
                error={historical ? standingsError : null}
                onRetry={() => setAttempt((value) => value + 1)}
                seasons={data.seasons}
                theme={season.theme}
                copied={copied === "leaderboard"}
                onCopy={() => {
                  if (selectedStandings)
                    void copy(
                      "leaderboard",
                      discordLeaderboard(selectedStandings),
                    );
                }}
              />
            </Tabs.Panel>
            <Tabs.Panel
              value="matchmaker"
              keepMounted
              inert={false}
              hidden={false}
              className={cn(
                "min-h-0 [&>div]:h-full lg:col-start-2 lg:row-start-1 lg:block",
                view !== "matchmaker" && "hidden",
              )}
            >
              <MatchmakerCard active={active} />
            </Tabs.Panel>
            <Tabs.Panel
              value="history"
              keepMounted
              inert={false}
              hidden={false}
              className={cn(
                "min-h-0 lg:col-start-2 lg:row-start-2 lg:block",
                view !== "history" && "hidden",
              )}
            >
              <HistoryCard
                key={data.season.id}
                season={data.season}
                seasons={data.seasons}
                initialPage={data.history}
                players={data.leaderboard}
                copied={copied === "history"}
                onCopy={(games, selectedSeason) =>
                  copy(
                    "history",
                    discordHistory({ games, season: selectedSeason }),
                  )
                }
              />
            </Tabs.Panel>
          </section>
        </Tabs.Root>
      </div>
    </main>
  );
};
