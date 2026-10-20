"use client";
import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import type { PlayerProfileCache } from "@/lib/player-profile-cache";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { seasonDateLabel, type Season } from "@/lib/seasons";
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
  cache,
  playerId,
  name,
  initialSeason,
  seasons: initialSeasons,
}: {
  cache: PlayerProfileCache;
  playerId: number;
  name: string;
  initialSeason: Season;
  seasons: Season[];
}) => {
  const [tab, setTab] = useState(
    initialSeason.status === "completed" ? "historic" : "current",
  );
  const [historicId, setHistoricId] = useState<number | null>(
    initialSeason.status === "completed"
      ? initialSeason.id
      : (initialSeasons.find((season) => season.status === "completed")?.id ??
          null),
  );
  const completed = initialSeasons.filter(
    (season) => season.status === "completed",
  );
  const selectedId =
    tab === "current" ? null : (historicId ?? completed[0]?.id ?? null);
  const noHistory = tab === "historic" && !completed.length;
  const { profile, error, retry } = usePlayerProfile(
    cache,
    playerId,
    selectedId,
  );
  const body = error ? (
    <div className="space-y-3 py-4">
      <p role="alert">{error}</p>
      <Button onClick={retry}>Retry profile</Button>
    </div>
  ) : noHistory ? (
    <p className="py-6 text-sm text-muted-foreground">
      No completed seasons yet.
    </p>
  ) : !profile || profile.season.id !== (selectedId ?? initialSeasons[0].id) ? (
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
      <Tabs.Root value={tab} onValueChange={setTab}>
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
                onChange={setHistoricId}
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
