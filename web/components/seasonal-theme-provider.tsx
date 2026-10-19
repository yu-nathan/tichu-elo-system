"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SeasonalDecorations } from "@/components/dashboard/seasonal-decorations";
import { useSeasonalTheme } from "@/hooks/use-seasonal-theme";

const SeasonalThemeContext = createContext<ReturnType<
  typeof useSeasonalTheme
> | null>(null);

export const useSiteTheme = () => {
  const theme = useContext(SeasonalThemeContext);
  if (!theme)
    throw new Error("Seasonal theme controls require the site provider.");
  return theme;
};

export const SeasonalThemeProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const season = useSeasonalTheme();
  const pathname = usePathname();
  return (
    <SeasonalThemeContext.Provider value={season}>
      <div
        className="seasonal-site relative isolate min-h-dvh bg-background text-foreground"
        data-seasonal-paused={season.paused}
      >
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <SeasonalDecorations
            theme={season.theme}
            paused={season.paused}
            showIntro={pathname !== "/"}
          />
        </div>
        <div className="relative z-10">{children}</div>
      </div>
    </SeasonalThemeContext.Provider>
  );
};
