"use client";

import { useEffect, useState } from "react";
import {
  ANIMATION_PREFERENCE_KEY,
  millisecondsUntilLocalMidnight,
  parseThemePreview,
  resolveSeasonalTheme,
  seasonalThemeForDate,
  THEME_PREFERENCE_KEY,
  type SeasonalTheme,
  type ThemePreference,
} from "@/lib/seasonal-theme";

const savePreference = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The hook's state remains usable when browser storage is unavailable.
  }
};

export const useSeasonalTheme = () => {
  const [automatic, setAutomatic] = useState<SeasonalTheme>("default");
  const [preference, setPreference] = useState<ThemePreference>("automatic");
  const [preview, setPreview] = useState<SeasonalTheme | null>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const theme = resolveSeasonalTheme(automatic, preference, preview);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setAutomatic(seasonalThemeForDate(now));
      setVisible(!document.hidden);
      timer = setTimeout(refresh, millisecondsUntilLocalMidnight(now) + 50);
    };
    const readPreview = () =>
      setPreview(
        parseThemePreview(new URL(location.href).searchParams.get("theme")),
      );
    const readPreferences = () => {
      try {
        setPreference(
          localStorage.getItem(THEME_PREFERENCE_KEY) === "default"
            ? "default"
            : "automatic",
        );
        setMotionEnabled(
          localStorage.getItem(ANIMATION_PREFERENCE_KEY) !== "paused",
        );
      } catch {
        // Keep the current in-memory preferences.
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === THEME_PREFERENCE_KEY ||
        event.key === ANIMATION_PREFERENCE_KEY
      )
        readPreferences();
    };
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const readMotion = () => setReducedMotion(media.matches);
    readPreferences();
    readPreview();
    readMotion();
    refresh();
    media.addEventListener("change", readMotion);
    window.addEventListener("storage", onStorage);
    window.addEventListener("popstate", readPreview);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", readMotion);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("popstate", readPreview);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-season");
    root.setAttribute("data-season", theme);
    return () => {
      if (previous === null) root.removeAttribute("data-season");
      else root.setAttribute("data-season", previous);
    };
  }, [theme]);

  const selectPreview = (next: SeasonalTheme | null) => {
    const url = new URL(location.href);
    if (next === null) url.searchParams.delete("theme");
    else url.searchParams.set("theme", next);
    window.history.replaceState(window.history.state, "", url);
    setPreview(next);
  };

  const selectPreference = (next: ThemePreference) => {
    selectPreview(null);
    setAutomatic(seasonalThemeForDate(new Date()));
    setPreference(next);
    savePreference(THEME_PREFERENCE_KEY, next);
  };

  const toggleMotion = () => {
    const next = !motionEnabled;
    setMotionEnabled(next);
    savePreference(ANIMATION_PREFERENCE_KEY, next ? "playing" : "paused");
  };

  return {
    theme,
    preference,
    preview,
    motionEnabled,
    reducedMotion,
    paused: !motionEnabled || reducedMotion || !visible,
    selectPreview,
    selectPreference,
    toggleMotion,
  };
};
