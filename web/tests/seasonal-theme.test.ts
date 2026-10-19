import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import {
  millisecondsUntilLocalMidnight,
  parseThemePreview,
  resolveSeasonalTheme,
  seasonalThemeForDate,
  thanksgivingDay,
  SEASONAL_THEMES,
} from "../lib/seasonal-theme.ts";

test("seasonal boundaries follow the local calendar every year", () => {
  for (let year = 2025; year <= 2040; year += 1) {
    const thanksgiving = thanksgivingDay(year);
    assert.equal(new Date(year, 10, thanksgiving).getDay(), 4);
    assert.ok(thanksgiving >= 22 && thanksgiving <= 28);
    const cases = [
      [new Date(year, 0, 1), "new-year"],
      [new Date(year, 0, 31, 23, 59, 59), "new-year"],
      [new Date(year, 1, 1), "valentines"],
      [new Date(year, 2, 0, 23, 59, 59), "valentines"],
      [new Date(year, 2, 1), "spring"],
      [new Date(year, 2, 31, 23, 59, 59), "spring"],
      [new Date(year, 3, 1), "easter"],
      [new Date(year, 3, 30, 23, 59, 59), "easter"],
      [new Date(year, 4, 1), "spring"],
      [new Date(year, 4, 31, 23, 59, 59), "spring"],
      [new Date(year, 5, 1), "summer"],
      [new Date(year, 5, 30, 23, 59, 59), "summer"],
      [new Date(year, 6, 1), "july-fourth"],
      [new Date(year, 6, 31, 23, 59, 59), "july-fourth"],
      [new Date(year, 7, 1), "summer"],
      [new Date(year, 7, 31, 23, 59, 59), "summer"],
      [new Date(year, 8, 1), "default"],
      [new Date(year, 8, 30, 23, 59, 59), "default"],
      [new Date(year, 9, 1), "halloween"],
      [new Date(year, 9, 31, 23, 59, 59), "halloween"],
      [new Date(year, 10, 1), "thanksgiving"],
      [new Date(year, 10, thanksgiving, 23, 59, 59), "thanksgiving"],
      [new Date(year, 10, thanksgiving + 1), "christmas"],
      [new Date(year, 11, 1), "christmas"],
      [new Date(year, 11, 31, 23, 59, 59), "christmas"],
      [new Date(year + 1, 0, 1), "new-year"],
    ] as const;
    for (const [date, expected] of cases)
      assert.equal(seasonalThemeForDate(date), expected, date.toString());
  }
  assert.equal(thanksgivingDay(2026), 26);
  assert.equal(thanksgivingDay(2029), 22);
  assert.equal(thanksgivingDay(2030), 28);
});

test("previews override preferences without changing automatic selection", () => {
  assert.equal(
    resolveSeasonalTheme("halloween", "default", "christmas"),
    "christmas",
  );
  assert.equal(
    resolveSeasonalTheme("halloween", "automatic", "default"),
    "default",
  );
  assert.equal(resolveSeasonalTheme("halloween", "default", null), "default");
  assert.equal(
    resolveSeasonalTheme("halloween", "automatic", null),
    "halloween",
  );
  for (const value of [null, "", "winter", "Halloween", "__proto__"])
    assert.equal(parseThemePreview(value), null);
  for (const theme of SEASONAL_THEMES) {
    assert.equal(parseThemePreview(theme), theme);
    assert.equal(resolveSeasonalTheme("halloween", "default", theme), theme);
  }
});

test("midnight refresh uses the next local calendar day", () => {
  assert.equal(
    millisecondsUntilLocalMidnight(new Date(2026, 9, 31, 23, 59, 59, 500)),
    500,
  );
  assert.equal(
    millisecondsUntilLocalMidnight(new Date(2026, 11, 31, 23, 59, 0)),
    60_000,
  );
});

test("one instant produces different visitor-local themes, including DST-aware timers", () => {
  const moduleURL = new URL("../lib/seasonal-theme.ts", import.meta.url).href;
  const evaluate = (timezone: string, instant: string) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "--input-type=module",
          "-e",
          `import {seasonalThemeForDate, millisecondsUntilLocalMidnight} from ${JSON.stringify(moduleURL)}; const date = new Date(${JSON.stringify(instant)}); console.log(JSON.stringify([seasonalThemeForDate(date), millisecondsUntilLocalMidnight(date)]));`,
        ],
        { env: { ...process.env, TZ: timezone }, encoding: "utf8" },
      ),
    );
  assert.equal(
    evaluate("America/Los_Angeles", "2026-11-27T04:00:00Z")[0],
    "thanksgiving",
  );
  assert.equal(evaluate("Asia/Tokyo", "2026-11-27T04:00:00Z")[0], "christmas");
  for (const [instant, west, east] of [
    ["2027-01-01T04:00:00Z", "christmas", "new-year"],
    ["2027-02-01T04:00:00Z", "new-year", "valentines"],
    ["2028-03-01T04:00:00Z", "valentines", "spring"],
    ["2027-04-01T04:00:00Z", "spring", "easter"],
    ["2027-05-01T04:00:00Z", "easter", "spring"],
    ["2027-06-01T04:00:00Z", "spring", "summer"],
    ["2027-07-01T04:00:00Z", "summer", "july-fourth"],
    ["2027-08-01T04:00:00Z", "july-fourth", "summer"],
    ["2027-09-01T04:00:00Z", "summer", "default"],
  ]) {
    assert.equal(evaluate("America/Los_Angeles", instant)[0], west);
    assert.equal(evaluate("Asia/Tokyo", instant)[0], east);
  }
  assert.equal(
    evaluate("America/Los_Angeles", "2026-03-08T08:00:00Z")[1],
    23 * 60 * 60 * 1000,
  );
  assert.equal(
    evaluate("America/Los_Angeles", "2026-11-01T07:00:00Z")[1],
    25 * 60 * 60 * 1000,
  );
});
