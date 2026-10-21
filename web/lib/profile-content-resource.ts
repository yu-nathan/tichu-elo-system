import type { ComponentType } from "react";
import type { PlayerProfile } from "./player-profile";

type ProfileContent = ComponentType<{ profile: PlayerProfile }>;
let loaded: ProfileContent | undefined;
let pending: Promise<ProfileContent> | undefined;
let retryUrl: URL | undefined;
let retryAttempt = 0;

const findProfileChunk = () => {
  if (typeof document === "undefined") return undefined;
  // Vite's preload links provide the actual emitted chunk URL. Only accept
  // this site's profile chunk, never an arbitrary URL from an error message.
  for (const link of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="modulepreload"]',
  )) {
    const url = new URL(link.href);
    if (
      url.origin === location.origin &&
      /^\/_next\/static\/chunks\/player-profile-[\w-]+\.js$/.test(url.pathname)
    )
      return url;
  }
  return undefined;
};

const importProfile = (): Promise<
  typeof import("../components/dashboard/player-profile")
> => {
  if (!retryUrl) return import("../components/dashboard/player-profile");
  // A rejected module URL remains failed in Chrome's module map. A new query
  // retries that same immutable chunk without reloading the dashboard.
  retryUrl.searchParams.set("profile-retry", String(++retryAttempt));
  return import(/* @vite-ignore */ retryUrl.href);
};

// Every hover, idle preload, and dialog shares the same import. A failed
// speculative import can be attempted again when the visitor opens a profile.
export const preloadProfileContent = (): Promise<ProfileContent> => {
  pending ??= importProfile()
    .then(({ PlayerProfileContent }) => {
      loaded = PlayerProfileContent;
      return PlayerProfileContent;
    })
    .catch((error: unknown) => {
      pending = undefined;
      retryUrl ??= findProfileChunk();
      throw error;
    });
  return pending;
};

export const getProfileContent = () => loaded;
