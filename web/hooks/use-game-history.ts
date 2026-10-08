"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGamePage } from "@/lib/api-client";
import type { GamePage } from "@/lib/models";

export const useGameHistory = (initialPage: GamePage) => {
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const loadMore = useCallback(async () => {
    if (pending.current || !page.nextCursor) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchGamePage(page.nextCursor, controller.signal);
      if (controller.signal.aborted) return;
      if (next.nextCursor === page.nextCursor)
        throw new Error("Could not advance game history. Try again.");
      setPage((current) => {
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
            : "Could not load older games. Try again.",
        );
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [page.nextCursor]);

  useEffect(() => {
    if (
      loading ||
      error ||
      !page.nextCursor ||
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
  }, [error, loading, loadMore, page.nextCursor]);

  return {
    games: page.games,
    hasMore: page.nextCursor !== null,
    loading,
    error,
    loadMore,
    rootRef,
    sentinelRef,
  };
};
