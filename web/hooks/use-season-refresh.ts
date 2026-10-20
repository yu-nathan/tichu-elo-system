"use client";
import { useEffect, useRef } from "react";
import type { Season } from "@/lib/seasons";

// Revalidate on return as well as at midnight: suspended tabs may miss timers.
export const useSeasonRefresh = (season: Season, refresh: () => void) => {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const remaining = Date.parse(season.endsAt) - Date.now();
      timer = setTimeout(
        () => {
          if (Date.now() >= Date.parse(season.endsAt)) latest.current();
          schedule();
        },
        remaining > 0 ? Math.min(remaining + 50, 86_400_000) : 60_000,
      );
    };
    const onReturn = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    if (Date.now() >= Date.parse(season.endsAt)) latest.current();
    schedule();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [season.endsAt]);
};
