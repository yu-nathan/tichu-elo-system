"use client";
import { useEffect, useState } from "react";
import { fetchPlayerProfile } from "@/lib/api-client";
import type { PlayerProfile } from "@/lib/player-profile";
import { PlayerProfileContent } from "./player-profile";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const PlayerProfileLoader = ({
  playerId,
  name,
}: {
  playerId: number;
  name: string;
}) => {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetchPlayerProfile(playerId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setProfile(result);
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [playerId, attempt]);
  if (profile) return <PlayerProfileContent profile={profile} />;
  return (
    <DialogContent>
      <DialogTitle className="pr-8 text-2xl font-semibold">{name}</DialogTitle>
      <DialogDescription className="mt-2 text-sm text-muted-foreground">
        Lifetime player statistics and Elo history.
      </DialogDescription>
      {error ? (
        <div className="mt-4 space-y-3">
          <p role="alert">{error}</p>
          <Button
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Retry profile
          </Button>
        </div>
      ) : (
        <output className="mt-4 block text-sm text-muted-foreground">
          Loading profile…
        </output>
      )}
    </DialogContent>
  );
};
