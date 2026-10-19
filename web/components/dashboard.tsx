"use client";
import { useMemo, useState } from "react";
import { LogIn, Settings, Sparkles } from "lucide-react";
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
import type { DashboardData } from "@/lib/models";

type Props = {
  data: DashboardData;
  userEmail: string | null;
  isAdmin: boolean;
  canPreviewThemes: boolean;
  signInHref: string;
  signOutHref: string;
};

export const Dashboard = ({
  data,
  userEmail,
  isAdmin,
  canPreviewThemes,
  signInHref,
  signOutHref,
}: Props) => {
  const season = useSiteTheme();
  const [view, setView] = useState("leaderboard");
  const active = useMemo(
    () => data.leaderboard.filter((player) => !player.archivedAt),
    [data.leaderboard],
  );
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
          <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_.8fr] lg:grid-rows-[min(50dvh,--spacing(90))_minmax(0,1fr)]">
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
                active={active}
                theme={season.theme}
                copied={copied === "leaderboard"}
                onCopy={() => copy("leaderboard", discordLeaderboard(data))}
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
                initialPage={data.history}
                copied={copied === "history"}
                onCopy={() =>
                  copy("history", discordHistory({ games: data.history.games }))
                }
              />
            </Tabs.Panel>
          </section>
        </Tabs.Root>
      </div>
    </main>
  );
};
