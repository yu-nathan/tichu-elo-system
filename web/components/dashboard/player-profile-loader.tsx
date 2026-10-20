"use client";
import { useEffect, useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { fetchPlayerProfile } from "@/lib/api-client";
import type { SeasonalPlayerProfile } from "@/lib/player-profile";
import { seasonDateLabel, type Season } from "@/lib/seasons";
import { useSeasonRefresh } from "@/hooks/use-season-refresh";
import { SeasonSelect } from "@/components/season-select";
import { PlayerProfileContent } from "./player-profile";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const PlayerProfileLoader = ({
  playerId,
  name,
  initialSeason,
  seasons: initialSeasons,
}: {
  playerId: number;
  name: string;
  initialSeason: Season;
  seasons: Season[];
}) => {
  const [seasons, setSeasons] = useState(initialSeasons);
  const [tab, setTab] = useState(
    initialSeason.status === "completed" ? "historic" : "current",
  );
  const [historicId, setHistoricId] = useState<number | null>(
    initialSeason.status === "completed"
      ? initialSeason.id
      : (initialSeasons.find((season) => season.status === "completed")?.id ??
          null),
  );
  const [profile, setProfile] = useState<SeasonalPlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const completed = seasons.filter((season) => season.status === "completed");
  const selectedId =
    tab === "current" ? null : (historicId ?? completed[0]?.id ?? null);
  const noHistory = tab === "historic" && !completed.length;
  const current = seasons[0];
  useSeasonRefresh(current, () => setAttempt((value) => value + 1));
  useEffect(() => {
    const controller = new AbortController();
    setProfile(null);
    setError(null);
    // Even an empty Historic tab revalidates metadata when Season 1 ends.
    void fetchPlayerProfile(playerId, controller.signal, selectedId)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProfile(result);
        setSeasons(result.seasons);
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [playerId, selectedId, tab, attempt]);
  const body = error ? (
    <div className="space-y-3 py-4">
      <p role="alert">{error}</p>
      <Button onClick={() => setAttempt((value) => value + 1)}>
        Retry profile
      </Button>
    </div>
  ) : noHistory ? (
    <p className="py-6 text-sm text-muted-foreground">
      No completed seasons yet.
    </p>
  ) : !profile || (selectedId !== null && profile.season.id !== selectedId) ? (
    <div className="space-y-3 py-4">
      <output className="sr-only">Loading profile…</output>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  ) : (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-medium">
        {profile.season.label} ·{" "}
        {profile.season.status === "completed" ? "Final" : "Current"}
        {profile.rank === null ? " · Unranked" : ` · Rank #${profile.rank}`}
      </p>
      <p className="text-xs text-muted-foreground">
        {seasonDateLabel(profile.season)}
      </p>
      {profile.season.status === "completed" && !profile.player.gamesPlayed ? (
        <p className="py-4 text-sm text-muted-foreground">
          No participation in this season.
        </p>
      ) : (
        <PlayerProfileContent profile={profile} />
      )}
    </div>
  );
  return (
    <DialogContent className="max-w-5xl">
      <DialogTitle className="break-words pr-8 text-2xl font-semibold">
        {name}
      </DialogTitle>
      <DialogDescription className="sr-only">
        Season statistics and Elo history.
      </DialogDescription>
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          setProfile(null);
          setError(null);
          setTab(value);
        }}
      >
        <Tabs.List
          aria-label="Profile statistics"
          className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
        >
          <Tabs.Tab
            value="current"
            render={
              <Button
                size="sm"
                variant={tab === "current" ? "secondary" : "ghost"}
              />
            }
          >
            Current season
          </Tabs.Tab>
          <Tabs.Tab
            value="historic"
            render={
              <Button
                size="sm"
                variant={tab === "historic" ? "secondary" : "ghost"}
              />
            }
          >
            Historic
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="current">{tab === "current" && body}</Tabs.Panel>
        <Tabs.Panel value="historic">
          {completed.length > 0 && (
            <div className="mt-3">
              <SeasonSelect
                seasons={completed}
                value={selectedId}
                onChange={(id) => {
                  setProfile(null);
                  setHistoricId(id);
                }}
                label="Profile season"
              />
            </div>
          )}
          {tab === "historic" && body}
        </Tabs.Panel>
      </Tabs.Root>
    </DialogContent>
  );
};
