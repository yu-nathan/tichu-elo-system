import assert from "node:assert/strict";
import { after, before, test } from "node:test";
const { chromium, expect } = await import(
  process.env.PLAYWRIGHT_TEST_MODULE ?? "playwright/test"
);
const baseURL = process.env.TICHU_TEST_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname))
  throw new Error("Local preview only");
let browser;
before(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
after(async () => {
  await browser?.close();
});
const open = async (context, width = 1280) => {
  const session = await browser.newContext({
    baseURL,
    viewport: { width, height: 900 },
    timezoneId: "Asia/Tokyo",
  });
  context.after(() => session.close());
  const page = await session.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { page, errors };
};
const select = async (page, label, name) => {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
};

test("profiles expose Current season and Historic, with accessible empty states at both sizes", async (context) => {
  for (const width of [390, 1280]) {
    const { page, errors } = await open(context, width);
    const profileRequests = [];
    page.on("request", (request) => {
      if (/\/api\/players\/\d+\/profile/.test(request.url()))
        profileRequests.push(request.url());
    });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Leaderboard season", exact: true }),
    ).toBeVisible();
    const trigger = page
      .getByRole("button", { name: /View .+ profile/ })
      .filter({ visible: true })
      .first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/Season 1 · Current/)).toBeVisible();
    await dialog.getByRole("tab", { name: "Historic", exact: true }).click();
    await expect(dialog.getByText("No completed seasons yet.")).toBeVisible();
    await dialog
      .getByRole("tab", { name: "Current season", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Win rate", exact: true }),
    ).toBeVisible();
    assert.ok(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    // Switching players remounts the loader; returning must still use the cache.
    await page
      .getByRole("button", { name: /View .+ profile/ })
      .filter({ visible: true })
      .nth(1)
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "Win rate", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await trigger.click();
    await expect(dialog.getByText("Loading profile…")).toHaveCount(0);
    await expect(
      dialog.getByRole("heading", { name: "Win rate", exact: true }),
    ).toBeVisible();
    assert.equal(profileRequests.length, 2);
    await page.keyboard.press("Escape");
    const selector = page.getByRole("button", {
      name: "Leaderboard season",
      exact: true,
    });
    const leaderboard = page.getByRole("region", {
      name: "Leaderboard players",
    });
    const before = await leaderboard.boundingBox();
    const triggerBefore = await selector.boundingBox();
    await selector.click();
    await expect(
      page.getByRole("menuitemradio", { name: "Season 1 · Current season" }),
    ).toBeVisible();
    assert.deepEqual(await leaderboard.boundingBox(), before);
    assert.deepEqual(await selector.boundingBox(), triggerBefore);
    await page.keyboard.press("Escape");
    await expect(selector).toBeFocused();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/tichu-seasons-${width}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
  }
});

test("an open dashboard resets at midnight and historic profiles retain their own season", async (context) => {
  const { page, errors } = await open(context);
  const existing = await (await page.request.get("/api/dashboard")).json();
  const player = existing.leaderboard.find(({ archivedAt }) => !archivedAt);
  const pastProfile = await (
    await page.request.get(`/api/players/${player.id}/profile`)
  ).json();
  const past = { ...existing.season, status: "completed" };
  const current = {
    id: 2,
    label: "Season 2",
    startsAt: "2027-01-01T08:00:00.000Z",
    endsAt: "2027-07-01T07:00:00.000Z",
    timezone: "America/Los_Angeles",
    status: "current",
  };
  const seasons = [current, past];
  const profileRequests = [];
  const resetPlayers = existing.leaderboard.map((p) => ({
    ...p,
    rating: 1000,
    gamesPlayed: 0,
    tichus: 0,
    successfulTichus: 0,
    grandTichus: 0,
    successfulGrandTichus: 0,
  }));
  const reset = {
    season: current,
    seasons,
    leaderboard: resetPlayers,
    history: { games: [], nextCursor: null },
  };
  await page.clock.install({ time: new Date("2027-01-01T07:59:58.000Z") });
  await page.clock.pauseAt(new Date("2027-01-01T07:59:58.000Z"));
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({ json: reset }),
  );
  await page.route("**/api/players/*/profile*", (route) => {
    profileRequests.push(route.request().url());
    const historical =
      new URL(route.request().url()).searchParams.get("seasonId") === "1";
    return route.fulfill({
      json: historical
        ? { ...pastProfile, season: past, seasons }
        : {
            ...pastProfile,
            season: current,
            seasons,
            player: resetPlayers.find(({ id }) => id === player.id),
            wins: 0,
            losses: 0,
            history: [pastProfile.history[0]],
            bestFriends: [],
            carryingMe: [],
            draggingMeDown: [],
            imHisBitch: [],
            nemesis: [],
            curbstomped: [],
            hasEligiblePartners: false,
            hasEligibleOpponents: false,
          },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Leaderboard season", exact: true }),
  ).toHaveText("Season 1 · Current season");
  await page.clock.runFor(2200);
  await expect(
    page.getByRole("button", { name: "Leaderboard season", exact: true }),
  ).toHaveText("Season 2 · Current season");
  await expect(
    page.getByText("No games played yet", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `View ${player.name}'s profile` })
    .filter({ visible: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("1000.0 Elo", { exact: true })).toBeVisible();
  await dialog.getByRole("tab", { name: "Historic", exact: true }).click();
  await expect(dialog.getByText(/Season 1 · Final/)).toBeVisible();
  await expect(
    dialog.getByText(`${pastProfile.player.rating.toFixed(1)} Elo`, {
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("tab", { name: "Current season", exact: true })
    .click();
  await expect(dialog.getByText("1000.0 Elo", { exact: true })).toBeVisible();
  await dialog.getByRole("tab", { name: "Historic", exact: true }).click();
  await expect(dialog.getByText("Loading profile…")).toHaveCount(0);
  await expect(dialog.getByText(/Season 1 · Final/)).toBeVisible();
  assert.equal(profileRequests.length, 2);
  assert.deepEqual(errors, []);
});

test("historical rankings open matching profiles, retry failures, and combine history filters", async (context) => {
  const { page, errors } = await open(context);
  const data = await (await page.request.get("/api/seasons/1")).json();
  const past = { ...data.season, status: "completed" };
  const current = {
    ...past,
    id: 2,
    label: "Season 2",
    startsAt: past.endsAt,
    endsAt: "2027-07-01T07:00:00.000Z",
    status: "current",
  };
  const seasons = [current, past];
  let fail = true;
  await page.route("**/api/seasons/1", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { error: "Unavailable" } }
        : { json: { ...data, season: past, seasons } },
    ),
  );
  const dashboard = await (await page.request.get("/api/dashboard")).json();
  const currentPlayers = dashboard.leaderboard.map((player) => ({
    ...player,
    rating: 1000,
    gamesPlayed: 0,
  }));
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      json: {
        ...dashboard,
        season: current,
        seasons,
        leaderboard: currentPlayers,
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Leaderboard season", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Leaderboard season" }),
  ).toHaveText("Season 2 · Current season");
  await select(page, "Leaderboard season", "Season 1");
  await expect(
    page.getByRole("button", { name: "Retry season" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry season" }).click();
  await expect(
    page.getByText("Final standings · All participants", { exact: true }),
  ).toBeVisible();
  const person = data.leaderboard[0];
  const profile = await (
    await page.request.get(`/api/players/${person.id}/profile`)
  ).json();
  await page.route("**/api/players/*/profile*", (route) =>
    route.fulfill({ json: { ...profile, season: past, seasons } }),
  );
  await page
    .getByRole("button", { name: `View ${person.name}'s profile` })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Historic", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("dialog").getByText(/Season 1 · Final/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await select(page, "Leaderboard season", "Season 2 · Current season");
  await expect(
    page
      .getByRole("region", { name: "Leaderboard players" })
      .getByText("1000.0")
      .first(),
  ).toBeVisible();
  // A slow historical response must not replace the current season after switching back.
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/seasons/1", async (route) => {
    await pending;
    await route
      .fulfill({ json: { ...data, season: past, seasons } })
      .catch(() => {});
  });
  const requested = page.waitForRequest("**/api/seasons/1");
  requested.catch(() => {});
  await select(page, "Leaderboard season", "Season 1");
  await requested;
  await expect(
    page.getByText("Loading season…", { exact: true }),
  ).toBeVisible();
  await select(page, "Leaderboard season", "Season 2 · Current season");
  release();
  await expect(
    page
      .getByRole("region", { name: "Leaderboard players" })
      .getByText("1000.0")
      .first(),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Leaderboard season", exact: true }),
  ).toBeVisible();
  const requests = [];
  await page.route("**/api/games*", (route) => {
    requests.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: { games: [], nextCursor: null } });
  });
  await select(page, "Filter game history by season", "All seasons");
  await page
    .getByRole("combobox", { name: "Filter game history by player" })
    .fill(person.name);
  await page.getByRole("option", { name: person.name, exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.get("playerId"))
    .toBe(String(person.id));
  assert.equal(requests.at(-1).get("seasonId"), null);
  await select(
    page,
    "Filter game history by season",
    "Season 1 · Current season",
  );
  await expect.poll(() => requests.at(-1)?.get("seasonId")).toBe("1");
  assert.equal(requests.at(-1).get("playerId"), String(person.id));
  assert.deepEqual(errors, []);
});

test("old season links redirect to the leaderboard and unavailable seasons are rejected", async (context) => {
  const { page, errors } = await open(context);
  await page.goto("/seasons?seasonId=1");
  await expect(page).toHaveURL(`${baseURL}/?seasonId=1`);
  await expect(
    page.getByRole("button", { name: "Leaderboard season" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Seasons", exact: true }),
  ).toHaveCount(0);
  for (const id of ["0", "01", "invalid", "9999"]) {
    await page.goto(`/?seasonId=${id}`);
    await expect(
      page.getByRole("heading", { name: "Season unavailable" }),
    ).toBeVisible();
  }
  assert.deepEqual(errors, []);
});

test("owner season cadence previews dates, preserves failed selections and refreshes after saving at both sizes", async (context) => {
  for (const width of [390, 1280]) {
    const { page, errors } = await open(context, width);
    const initial = await (await page.request.get("/api/state")).json();
    let settings = initial.seasonSettings;
    let fail = true;
    const saves = [];
    await page.route("**/api/seasons/settings", (route) => {
      saves.push(route.request().postDataJSON());
      if (fail)
        return route.fulfill({
          status: 503,
          json: { error: "Could not save season cadence." },
        });
      settings = { ...saves.at(-1), revision: settings.revision + 1 };
      return route.fulfill({ json: { ok: true } });
    });
    await page.route("**/api/state", (route) =>
      route.fulfill({
        json: {
          ...initial,
          seasonSettings: settings,
          season:
            settings.cadenceMonths === 1
              ? {
                  ...initial.season,
                  id: 4,
                  label: "Season 4",
                  startsAt: "2026-10-01T07:00:00.000Z",
                  endsAt: "2026-11-01T07:00:00.000Z",
                }
              : initial.season,
        },
      }),
    );
    await page.goto("/admin");
    await expect(page.getByLabel("Played at")).not.toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Season cadence", exact: true }),
    ).toHaveText("Every 6 months");
    await expect(
      page.getByRole("button", { name: "Save and recalculate" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Refresh settings" }),
    ).toHaveCount(0);
    await select(page, "Season cadence", "Monthly");
    await expect(page.getByText(/After saving: Season/)).toBeVisible();
    await page.getByRole("button", { name: "Save and recalculate" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Could not save season cadence.",
    );
    await expect(
      page.getByRole("button", { name: "Season cadence", exact: true }),
    ).toHaveText("Monthly");
    await expect(
      page.getByRole("button", { name: "Refresh settings" }),
    ).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Save and recalculate" }).click();
    await expect(
      page.getByText(
        "Season cadence saved. Stats and standings now use the new schedule.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Current schedule: Season 4")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save and recalculate" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Refresh settings" }),
    ).toHaveCount(0);
    assert.deepEqual(saves, [
      { cadenceMonths: 1, revision: initial.seasonSettings.revision },
      { cadenceMonths: 1, revision: initial.seasonSettings.revision },
    ]);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
  }
});
