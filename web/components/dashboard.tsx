"use client";
import { useMemo } from "react";
import { LogIn, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeaderboardCard } from "@/components/dashboard/leaderboard-card";
import { MatchmakerCard } from "@/components/dashboard/matchmaker-card";
import { HistoryCard } from "@/components/dashboard/history-card";
import { useClipboard } from "@/hooks/use-clipboard";
import { discordHistory, discordLeaderboard } from "@/lib/discord";
import type { AppData } from "@/lib/models";

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
  const active = useMemo(
    () => data.leaderboard.filter((player) => !player.archivedAt),
    [data.leaderboard],
  );
  const { copied, error, copy } = useClipboard();
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
              <Button
                size="sm"
                nativeButton={false}
                render={<a href="/admin" />}
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
          </div>
        </header>

        {error ? (
          <p role="alert" className="mb-4 text-sm">
            {error}
          </p>
        ) : null}
        <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <LeaderboardCard
            active={active}
            copied={copied === "leaderboard"}
            onCopy={() => copy("leaderboard", discordLeaderboard(data))}
          />
          <div className="grid content-start gap-5">
            <MatchmakerCard active={active} />
            <HistoryCard
              games={data.games}
              copied={copied === "history"}
              onCopy={() => copy("history", discordHistory(data))}
            />
          </div>
        </section>
      </div>
    </main>
  );
};
