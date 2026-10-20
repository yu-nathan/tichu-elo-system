"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { PlayerProfileCache } from "@/lib/player-profile-cache";

export const usePlayerProfile = (
  cache: PlayerProfileCache,
  playerId: number,
  seasonId: number | null,
) => {
  const getSnapshot = () => cache.get(playerId, seasonId);
  const entry = useSyncExternalStore(cache.subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void cache.load(playerId, seasonId);
    // Requests belong to the cache and can finish while another tab is open.
  }, [cache, playerId, seasonId, entry.stale]);
  return {
    ...entry,
    retry: () => void cache.load(playerId, seasonId, true),
  };
};
