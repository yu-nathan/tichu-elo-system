import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import {
  millisecondsUntilLocalMidnight,
  parseThemePreview,
  resolveSeasonalTheme,
  seasonalThemeForDate,
  thanksgivingDay,
} from "../lib/seasonal-theme.ts";

test("seasonal boundaries follow the local calendar every year", () => {
  for (let year = 2025; year <= 2040; year += 1) {
    const thanksgiving = thanksgivingDay(year);
    assert.equal(new Date(year, 10, thanksgiving).getDay(), 4);
    assert.ok(thanksgiving >= 22 && thanksgiving <= 28);
    const cases = [
      [new Date(year, 8, 30, 23, 59, 59), "default"],
      [new Date(year, 9, 1), "halloween"],
      [new Date(year, 9, 31, 23, 59, 59), "halloween"],
      [new Date(year, 10, 1), "thanksgiving"],
      [new Date(year, 10, thanksgiving, 23, 59, 59), "thanksgiving"],
      [new Date(year, 10, thanksgiving + 1), "christmas"],
      [new Date(year, 11, 1), "christmas"],
      [new Date(year, 11, 31, 23, 59, 59), "christmas"],
      [new Date(year + 1, 0, 1), "default"],
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
  assert.equal(parseThemePreview("thanksgiving"), "thanksgiving");
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
  assert.equal(
    evaluate("America/Los_Angeles", "2026-03-08T08:00:00Z")[1],
    23 * 60 * 60 * 1000,
  );
  assert.equal(
    evaluate("America/Los_Angeles", "2026-11-01T07:00:00Z")[1],
    25 * 60 * 60 * 1000,
  );
});
