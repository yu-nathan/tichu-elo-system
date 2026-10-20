import { fetchPlayerProfile } from "./api-client.ts";
import type { SeasonalPlayerProfile } from "./player-profile.ts";

type Entry = {
  profile: SeasonalPlayerProfile | null;
  error: string | null;
  stale: boolean;
};

const empty: Entry = { profile: null, error: null, stale: true };

// Each dashboard owns its cache; nothing is shared between server requests.
export const createPlayerProfileCache = (fetchProfile = fetchPlayerProfile) => {
  const entries = new Map<string, Entry>();
  const requests = new Map<string, AbortController>();
  const listeners = new Set<() => void>();
  const keyFor = (playerId: number, seasonId: number | null) =>
    `${playerId}:${seasonId ?? "current"}`;
  const notify = () => listeners.forEach((listener) => listener());

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: (playerId: number, seasonId: number | null) =>
      entries.get(keyFor(playerId, seasonId)) ?? empty,
    load: async (playerId: number, seasonId: number | null, retry = false) => {
      const key = keyFor(playerId, seasonId);
      const entry = entries.get(key) ?? empty;
      if (requests.has(key) || (!entry.stale && !retry)) return;
      const controller = new AbortController();
      requests.set(key, controller);
      entries.set(key, { ...entry, error: null, stale: false });
      notify();
      try {
        const profile = await fetchProfile(
          playerId,
          controller.signal,
          seasonId,
        );
        if (requests.get(key) !== controller) return;
        entries.set(key, { profile, error: null, stale: false });
      } catch (error) {
        if (requests.get(key) !== controller) return;
        entries.set(key, {
          ...entry,
          stale: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not load profile. Try again.",
        });
      } finally {
        if (requests.get(key) === controller) {
          requests.delete(key);
          notify();
        }
      }
    },
    invalidate: () => {
      requests.forEach((controller) => controller.abort());
      requests.clear();
      entries.forEach((entry, key) => {
        entries.set(key, { ...entry, error: null, stale: true });
      });
      notify();
    },
  };
};

export type PlayerProfileCache = ReturnType<typeof createPlayerProfileCache>;
