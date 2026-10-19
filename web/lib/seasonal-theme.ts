export const SEASONAL_THEMES = [
  "default",
  "new-year",
  "valentines",
  "spring",
  "easter",
  "summer",
  "july-fourth",
  "halloween",
  "thanksgiving",
  "christmas",
] as const;

export type SeasonalTheme = (typeof SEASONAL_THEMES)[number];
export type ThemePreference = "automatic" | "default";

export const THEME_LABELS: Record<SeasonalTheme, string> = {
  default: "Original",
  "new-year": "New Year",
  valentines: "Valentine’s Day",
  spring: "Spring",
  easter: "Easter",
  summer: "Summer",
  "july-fourth": "July Fourth",
  halloween: "Halloween",
  thanksgiving: "Thanksgiving",
  christmas: "Christmas",
};

export const THEME_PREFERENCE_KEY = "tichu-elo:theme:v1";
export const ANIMATION_PREFERENCE_KEY = "tichu-elo:seasonal-motion:v1";
export const COLOR_BLIND_PREFERENCE_KEY = "tichu-elo:color-blind:v1";

export const parseThemePreview = (value: string | null): SeasonalTheme | null =>
  SEASONAL_THEMES.find((theme) => theme === value) ?? null;

export const thanksgivingDay = (year: number): number => {
  const firstWeekday = new Date(year, 10, 1).getDay();
  return 1 + ((4 - firstWeekday + 7) % 7) + 21;
};

// Pure calendar resolver is also embedded in the pre-paint browser bootstrap.
export const seasonalThemeForCalendar = (
  month: number,
  day: number,
  thanksgiving: number,
): SeasonalTheme => {
  if (month === 0) return "new-year";
  if (month === 1) return "valentines";
  if (month === 2 || month === 4) return "spring";
  if (month === 3) return "easter";
  if (month === 5 || month === 7) return "summer";
  if (month === 6) return "july-fourth";
  if (month === 9) return "halloween";
  if (month === 10) return day <= thanksgiving ? "thanksgiving" : "christmas";
  return month === 11 ? "christmas" : "default";
};

// Intentionally use local calendar fields: the visitor's date owns the season.
export const seasonalThemeForDate = (date: Date): SeasonalTheme =>
  seasonalThemeForCalendar(
    date.getMonth(),
    date.getDate(),
    thanksgivingDay(date.getFullYear()),
  );

export const millisecondsUntilLocalMidnight = (date: Date): number => {
  const midnight = new Date(date);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - date.getTime();
};

export const resolveSeasonalTheme = (
  automatic: SeasonalTheme,
  preference: ThemePreference,
  preview: SeasonalTheme | null,
): SeasonalTheme =>
  preview ?? (preference === "default" ? "default" : automatic);
