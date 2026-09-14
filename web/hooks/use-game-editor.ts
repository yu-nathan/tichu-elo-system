"use client";
import { useEffect, useState } from "react";
import { useGameDraft } from "@/hooks/use-game-draft";
import { gameToDraft, newGameDraft, type GameDraft } from "@/lib/game-draft";
import { toLocalDateTime } from "@/lib/date-time";
import type { Game, Player } from "@/lib/models";

export const useGameEditor = (players: Player[]) => {
  const activeIds = players
    .filter((player) => !player.archivedAt)
    .map((player) => player.id);
  const [emptyDraft, setEmptyDraft] = useState(() => ({
    ...newGameDraft(activeIds),
    playedAt: "",
  }));
  const [savedDraft, updateDraft] = useGameDraft();
  const [draftStorageFailed, setDraftStorageFailed] = useState(false);

  useEffect(() => {
    if (savedDraft) return;
    setEmptyDraft((current) => ({
      ...current,
      playedAt: toLocalDateTime(new Date().toISOString()),
    }));
  }, [savedDraft]);

  const setDraft = (next: GameDraft) => {
    setDraftStorageFailed(!updateDraft(next));
  };
  const resetDraft = () => {
    setEmptyDraft(newGameDraft(activeIds));
    setDraftStorageFailed(!updateDraft(null));
  };
  const editGame = (game: Game) => {
    setDraft(gameToDraft(game));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return {
    draft: savedDraft ?? emptyDraft,
    draftStorageFailed,
    setDraft,
    resetDraft,
    editGame,
  };
};
