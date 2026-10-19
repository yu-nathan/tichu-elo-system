import {
  COLOR_BLIND_PREFERENCE_KEY,
  SEASONAL_THEMES,
  THEME_PREFERENCE_KEY,
  seasonalThemeForCalendar,
  thanksgivingDay,
} from "./seasonal-theme.ts";

// Keep this function self-contained: its compiled source runs inline in <head>,
// before the page or React bundles paint. Calendar logic is shared with the hook.
const applyInitialTheme = (
  resolveCalendar: typeof seasonalThemeForCalendar,
  resolveThanksgiving: typeof thanksgivingDay,
  config: {
    themeKey: string;
    colorBlindKey: string;
    themes: readonly string[];
  },
) => {
  let useDefault = false;
  let colorBlind = false;
  try {
    useDefault = localStorage.getItem(config.themeKey) === "default";
    colorBlind = localStorage.getItem(config.colorBlindKey) === "enabled";
  } catch {
    // Local-date automatic mode still works when storage is blocked.
  }
  const date = new Date();
  const preview = new URL(location.href).searchParams.get("theme");
  const theme =
    preview && config.themes.includes(preview)
      ? preview
      : useDefault
        ? "default"
        : resolveCalendar(
            date.getMonth(),
            date.getDate(),
            resolveThanksgiving(date.getFullYear()),
          );
  document.documentElement.setAttribute("data-season", theme);
  document.documentElement.setAttribute("data-colorblind", String(colorBlind));
};

export const themeBootstrapScript = `(${applyInitialTheme.toString()})(${seasonalThemeForCalendar.toString()},${thanksgivingDay.toString()},${JSON.stringify(
  {
    themeKey: THEME_PREFERENCE_KEY,
    colorBlindKey: COLOR_BLIND_PREFERENCE_KEY,
    themes: SEASONAL_THEMES,
  },
)});`;
