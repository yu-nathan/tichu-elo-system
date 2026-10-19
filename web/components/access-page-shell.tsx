"use client";

import type { ReactNode } from "react";
import { ThemeControls } from "@/components/dashboard/theme-controls";
import { useSiteTheme } from "@/components/seasonal-theme-provider";

export const AccessPageShell = ({ children }: { children: ReactNode }) => {
  const season = useSiteTheme();
  return (
    <main className="flex min-h-dvh flex-col gap-4 px-4 py-4">
      <div className="ml-auto flex items-center gap-2">
        <ThemeControls season={season} />
      </div>
      <div className="grid flex-1 place-items-center">{children}</div>
    </main>
  );
};
