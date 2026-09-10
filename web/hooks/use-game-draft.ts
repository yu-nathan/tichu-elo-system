"use client";

import { useSyncExternalStore } from "react";
import {
  clearGameDraft,
  readGameDraft,
  saveGameDraft,
  type GameDraft,
} from "@/lib/game-draft";

let currentDraft: GameDraft | null = null;
let initialized = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => {
  if (!initialized) {
    currentDraft = readGameDraft();
    initialized = true;
  }
  return currentDraft;
};

const getServerSnapshot = () => null;

const updateDraft = (draft: GameDraft | null) => {
  const saved = draft ? saveGameDraft(draft) : clearGameDraft();
  currentDraft = draft;
  initialized = true;
  listeners.forEach((listener) => listener());
  return saved;
};

export const useGameDraft = () => {
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [draft, updateDraft] as const;
};
