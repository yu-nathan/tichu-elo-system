"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGamePage } from "@/lib/api-client";
import type { GamePage } from "@/lib/models";

export const useGameHistory = (
  initialPage: GamePage,
  initialSeasonId: number,
) => {
  const [page, setPage] = useState<GamePage | null>(initialPage);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(initialSeasonId);
  const selectedSeason = useRef<number | null>(initialSeasonId);
  const selectedPlayer = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const loadPage = useCallback(
    async (cursor: string | null, id: number | null, season: number | null) => {
      if (
        pending.current ||
        selectedPlayer.current !== id ||
        selectedSeason.current !== season
      )
        return;
      const controller = new AbortController();
      pending.current = controller;
      setLoading(true);
      setError(null);
      try {
        const next = await fetchGamePage(cursor, controller.signal, id, season);
        if (controller.signal.aborted) return;
        if (cursor && next.nextCursor === cursor)
          throw new Error("Could not advance game history. Try again.");
        setPage((current) => {
          if (!cursor || !current) return next;
          const existing = new Set(current.games.map(({ id }) => id));
          return {
            games: [
              ...current.games,
              ...next.games.filter(({ id }) => !existing.has(id)),
            ],
            nextCursor: next.nextCursor,
          };
        });
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load games. Try again.",
          );
      } finally {
        if (pending.current === controller) pending.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [],
  );

  const selectFilters = (id: number | null, season: number | null) => {
    if (selectedPlayer.current === id && selectedSeason.current === season)
      return;
    pending.current?.abort();
    pending.current = null;
    selectedPlayer.current = id;
    selectedSeason.current = season;
    setPlayerId(id);
    setSeasonId(season);
    setError(null);
    setLoading(false);
    if (rootRef.current) rootRef.current.scrollTop = 0;
    const useInitial = id === null && season === initialSeasonId;
    setPage(useInitial ? initialPage : null);
    if (!useInitial) void loadPage(null, id, season);
  };

  // A server refresh invalidates cached pages, including when a historical
  // correction arrived while the tab was in the background.
  useEffect(() => {
    pending.current?.abort();
    pending.current = null;
    setLoading(false);
    setError(null);
    if (
      selectedPlayer.current === null &&
      selectedSeason.current === initialSeasonId
    )
      setPage(initialPage);
    else {
      setPage(null);
      void loadPage(null, selectedPlayer.current, selectedSeason.current);
    }
  }, [initialPage, initialSeasonId, loadPage]);

  const loadMore = useCallback(async () => {
    if (page && !page.nextCursor) return;
    await loadPage(page?.nextCursor ?? null, playerId, seasonId);
  }, [loadPage, page, playerId, seasonId]);

  useEffect(() => {
    if (
      loading ||
      error ||
      !page?.nextCursor ||
      !rootRef.current ||
      !sentinelRef.current
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { root: rootRef.current, rootMargin: "0px 0px 160px 0px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [error, loading, loadMore, page?.nextCursor]);

  return {
    games: page?.games ?? [],
    hasMore: page?.nextCursor != null,
    playerId,
    selectPlayer: (id: number | null) => selectFilters(id, seasonId),
    seasonId,
    selectSeason: (id: number | null) => selectFilters(playerId, id),
    loading,
    error,
    loadMore,
    rootRef,
    sentinelRef,
  };
};
