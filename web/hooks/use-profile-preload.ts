"use client";

import { useEffect } from "react";
import { preloadProfileContent } from "@/lib/profile-content-resource";

export const useProfilePreload = () => {
  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const preload = () => void preloadProfileContent().catch(() => {});
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(preload);
      } else {
        timer = setTimeout(preload, 1000);
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);
};
