import assert from "node:assert/strict";
import { after, before, test } from "node:test";

// Optional browser suite: use an installed Playwright or the Codex runtime copy.
const { chromium, expect } = await import(
  process.env.PLAYWRIGHT_TEST_MODULE ?? "playwright/test"
);
const baseURL = process.env.TICHU_TEST_URL ?? "http://localhost:3000";
const url = new URL(baseURL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw new Error("Browser tests must target a local development server.");
let browser;
before(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
after(async () => {
  await browser?.close();
});

const openPage = async (context, path, options = {}) => {
  const session = await browser.newContext({
    baseURL,
    timezoneId: "America/Los_Angeles",
    ...options,
  });
  context.after(() => session.close());
  const page = await session.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("Failed to load resource")
    )
      errors.push(message.text());
  });
  await page.goto(path);
  if (path === "/admin")
    await expect(page.getByLabel("Played at")).not.toHaveValue("");
  else await expect(page.locator("time").first()).not.toBeEmpty();
  return { page, errors };
};

const selectDashboardTab = async (page, name) => {
  const tab = page.getByRole("tab", { name, exact: true });
  if (await tab.isVisible()) await tab.click();
};

const selectMatchmakingPlayers = async (page, count = 4) => {
  await selectDashboardTab(page, "Matchmaker");
  await page.getByRole("button", { name: /0 of \d+ players/ }).click();
  const choices = page.getByRole("menuitemcheckbox");
  for (let index = 0; index < count; index += 1) {
    await choices.nth(index).click();
  }
  await page.keyboard.press("Escape");
};

test("saved games clear drafts even when refresh fails; edits stay locked until recovery", async (context) => {
  const { page, errors } = await openPage(context, "/admin");
  const data = await (await page.request.get("/api/state")).json();
  let release;
  let writes = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/games", async (route) => {
    writes += 1;
    await pending;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/state", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.getByLabel("Team A score").fill("1000");
  await page.getByLabel("Team B score").fill("-100");
  await page.getByRole("button", { name: "Add game", exact: true }).click();
  await expect(page.getByLabel("Team A score")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Edit game", exact: true }).first(),
  ).toBeDisabled();
  release();
  await expect(page.getByText(/Your change was saved/)).toBeVisible();
  assert.equal(writes, 1);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("tichu-elo:game-draft:v1")),
    null,
  );
  await expect(page.getByLabel("Team A score")).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "Add game", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/api/state");
  await page.route("**/api/state", (route) => route.fulfill({ json: data }));
  await page.getByRole("button", { name: "Refresh data" }).click();
  await expect(
    page.getByRole("button", { name: "Add game", exact: true }),
  ).toBeEnabled();
  assert.deepEqual(errors, []);
});

test("drafts survive reload and rejected saves; deleting the edited game clears its draft", async (context) => {
  const { page, errors } = await openPage(context, "/admin");
  await page
    .getByRole("button", { name: "Edit game", exact: true })
    .first()
    .click();
  await page.getByLabel("Team A score").fill("");
  await page.getByLabel("Record Tichu calls for this game").check();
  await page.getByLabel("Grand Tichu called", { exact: true }).first().fill("");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Team A score")).toHaveValue("");
  await expect(
    page.getByLabel("Grand Tichu called", { exact: true }).first(),
  ).toHaveValue("");
  await page.getByLabel("Team A score").fill("1000");
  await page
    .getByLabel("Grand Tichu called", { exact: true })
    .first()
    .fill("0");
  await page.route("**/api/games/*", (route) =>
    route.fulfill({ status: 400, json: { error: "Invalid game fixture" } }),
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid game fixture");
  await expect(page.getByLabel("Team A score")).toHaveValue("1000");
  await page.unroute("**/api/games/*");
  await page.route("**/api/games/*", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete game", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Add game", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("tichu-elo:game-draft:v1")),
    null,
  );
  assert.deepEqual(errors, []);
});

test("clipboard failures are recoverable and a newer copy keeps its full feedback interval", async (context) => {
  const { page, errors } = await openPage(context, "/");
  await page.clock.install();
  await page.evaluate(() => {
    window.failClipboard = true;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value) => {
          if (window.failClipboard) throw new Error("denied");
          window.copiedText = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy for Discord" }).first().click();
  await expect(page.getByRole("alert")).toHaveText(/Could not copy/);
  await page.evaluate(() => {
    window.failClipboard = false;
  });
  await page.getByRole("button", { name: "Copy for Discord" }).first().click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(1000);
  await page.getByRole("button", { name: "Copy for Discord" }).click();
  await page.clock.fastForward(650);
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  assert.match(await page.evaluate(() => window.copiedText), /Last 10 Games/);
  await page.clock.fastForward(1000);
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toHaveCount(0);
  assert.deepEqual(errors, []);
});

test("dashboard and admin render at mobile and desktop widths without hydration errors", async (context) => {
  for (const width of [390, 1280]) {
    for (const path of ["/", "/admin"]) {
      const { page, errors } = await openPage(context, path, {
        viewport: { width, height: 900 },
      });
      if (path === "/") {
        await selectMatchmakingPlayers(page);
        await page.getByRole("button", { name: "Randomize teams" }).click();
        await expect(
          page.getByRole("button", { name: "Find fair teams" }),
        ).toBeEnabled();
        await page.getByRole("button", { name: "Find fair teams" }).click();
        await expect(
          page.getByRole("button", { name: "Find fair teams" }),
        ).toBeDisabled();
      }
      assert.ok(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= window.innerWidth &&
            document.documentElement.scrollHeight <= window.innerHeight,
        ),
      );
      assert.deepEqual(errors, []);
    }
  }
});

test("matchmaking starts empty, activates with four players, and clears random teams on selection changes", async (context) => {
  const { page, errors } = await openPage(context, "/");
  const randomize = page.getByRole("button", { name: "Randomize teams" });
  const fair = page.getByRole("button", { name: "Find fair teams" });
  await expect(page.getByText("Choose at least 4 players")).toBeVisible();
  await expect(randomize).toBeDisabled();
  await expect(fair).toBeDisabled();
  await page.getByRole("button", { name: /0 of \d+ players/ }).click();
  const choices = page.getByRole("menuitemcheckbox");
  const names = [];
  for (let index = 0; index < (await choices.count()); index += 1) {
    await expect(choices.nth(index)).toHaveAttribute("aria-checked", "false");
  }
  for (let index = 0; index < 3; index += 1) {
    names.push((await choices.nth(index).innerText()).split("\n")[0]);
    await choices.nth(index).click();
  }
  await page.keyboard.press("Escape");
  await expect(randomize).toBeDisabled();
  await page.getByRole("button", { name: /3 of \d+ players/ }).click();
  names.push((await choices.nth(3).innerText()).split("\n")[0]);
  await choices.nth(3).click();
  await page.keyboard.press("Escape");
  await expect(randomize).toBeEnabled();
  await expect(fair).toBeDisabled();
  await randomize.click();
  await expect(fair).toBeEnabled();
  const teamCards = page.getByText(/^Team (one|two)$/).locator("..");
  const teamText = (await teamCards.allTextContents()).join(" ");
  for (const name of names) assert.ok(teamText.includes(name));
  await page
    .getByRole("button", { name: /4 of \d+ players|All players/ })
    .click();
  await choices.first().click();
  await page.keyboard.press("Escape");
  await expect(randomize).toBeDisabled();
  await expect(fair).toBeDisabled();
  await expect(page.getByText("Team one", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /0 of \d+ players/ }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
});

test("player profiles show accurate stats, restore focus, and preserve the matchmaking pool", async (context) => {
  for (const width of [390, 1280]) {
    const { page, errors } = await openPage(context, "/", {
      viewport: { width, height: 900 },
      hasTouch: width === 390,
    });
    const data = await (await page.request.get("/api/state")).json();
    await selectMatchmakingPlayers(page);
    const poolText = await page
      .getByRole("button", { name: /4 of \d+ players|All players/ })
      .innerText();
    await selectDashboardTab(page, "Leaderboard");
    const triggers = page.getByRole("button", { name: /^View .+'s profile$/ });
    for (const index of [0, 1, 3]) {
      const player = data.leaderboard.filter(({ archivedAt }) => !archivedAt)[
        index
      ];
      const trigger = triggers.nth(index);
      if (index === 0) {
        await trigger.focus();
        await page.keyboard.press("Enter");
      } else {
        await trigger.click();
      }
      const dialog = page.getByRole("dialog", {
        name: player.name,
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(`${player.rating.toFixed(1)} Elo`, { exact: true }),
      ).toBeVisible();
      const games = data.games.filter((game) =>
        [
          game.teamAPlayer1Id,
          game.teamAPlayer2Id,
          game.teamBPlayer1Id,
          game.teamBPlayer2Id,
        ].includes(player.id),
      );
      const wins = games.filter((game) =>
        [game.teamAPlayer1Id, game.teamAPlayer2Id].includes(player.id)
          ? game.scoreA > game.scoreB
          : game.scoreB > game.scoreA,
      ).length;
      const winCard = dialog
        .getByRole("heading", { name: "Win rate", exact: true })
        .locator("..");
      await expect(winCard).toContainText(
        games.length ? `${((wins / games.length) * 100).toFixed(1)}%` : "N/A",
      );
      await expect(winCard).toContainText(
        `${wins} wins · ${games.length - wins} losses`,
      );
      for (const title of [
        "Tichu success",
        "Grand Tichu success",
        "Best friend",
        "Carrying me",
        "Dragging me down",
        "I'm his bitch",
        "Nemesis",
        "Curbstomped",
      ]) {
        await expect(
          dialog.getByRole("heading", { name: title, exact: true }),
        ).toHaveCount(1);
      }
      for (const [title, outcome] of [
        ["Carrying me", "won"],
        ["Dragging me down", "lost"],
      ]) {
        const card = dialog
          .getByRole("heading", { name: title, exact: true })
          .locator("..");
        await expect(card).toContainText(
          outcome === "won"
            ? "Win rate weighted by games played"
            : "Loss rate weighted by games played",
        );
        for (const partner of await card.getByRole("listitem").all()) {
          await expect(partner.locator("p")).toHaveText(
            new RegExp(`^\\d+\\.\\d% · \\d+/\\d+ games ${outcome}$`),
          );
          const ratioText = await partner.locator("p").innerText();
          assert.ok(Number(ratioText.match(/\/(\d+)/)[1]) >= 3);
        }
        if (games.length < 3) {
          await expect(card.getByRole("listitem")).toHaveCount(0);
          await expect(card).toContainText(
            "Play at least 3 games with a partner",
          );
        }
      }
      const tichuCard = dialog
        .getByRole("heading", { name: "I'm his bitch", exact: true })
        .locator("..");
      const partnerCalls = new Map();
      for (const game of games) {
        const teamA = [game.teamAPlayer1Id, game.teamAPlayer2Id];
        const team = teamA.includes(player.id)
          ? teamA
          : [game.teamBPlayer1Id, game.teamBPlayer2Id];
        const id = team.find((id) => id !== player.id);
        const calls = game.callStats?.find(({ playerId }) => playerId === id);
        const total = partnerCalls.get(id) ?? {
          attempts: 0,
          successes: 0,
          games: 0,
        };
        total.games += 1;
        total.attempts += calls?.tichus ?? 0;
        total.successes += calls?.successfulTichus ?? 0;
        partnerCalls.set(id, total);
      }
      const eligible = [...partnerCalls].filter(
        ([, calls]) =>
          calls.games >= 3 && calls.attempts > 0 && calls.successes > 0,
      );
      const score = ({ successes, attempts, games }) => {
        const rate = successes / attempts;
        const z = 1.96;
        return (
          (rate +
            z ** 2 / (2 * games) -
            z *
              Math.sqrt(
                (rate * (1 - rate)) / games + z ** 2 / (4 * games ** 2),
              )) /
          (1 + z ** 2 / games)
        );
      };
      const bestScore = Math.max(...eligible.map(([, calls]) => score(calls)));
      const leaders = eligible.filter(
        ([, calls]) => score(calls) === bestScore,
      );
      await expect(tichuCard.getByRole("listitem")).toHaveCount(leaders.length);
      for (const [id, calls] of leaders) {
        const partner = data.leaderboard.find((partner) => partner.id === id);
        await expect(tichuCard).toContainText(partner.name);
        await expect(tichuCard).toContainText(
          `${((calls.successes / calls.attempts) * 100).toFixed(1)}% · ${calls.successes}/${calls.attempts} successful calls`,
        );
      }
      if (!leaders.length)
        await expect(tichuCard).toContainText(
          [...partnerCalls.values()].some(({ games }) => games >= 3)
            ? "No successful partner Tichu calls recorded with eligible partners"
            : "Play at least 3 games with a partner",
        );
      const opponents = new Map();
      for (const game of games) {
        const onA = [game.teamAPlayer1Id, game.teamAPlayer2Id].includes(
          player.id,
        );
        const won = onA ? game.scoreA > game.scoreB : game.scoreB > game.scoreA;
        for (const id of onA
          ? [game.teamBPlayer1Id, game.teamBPlayer2Id]
          : [game.teamAPlayer1Id, game.teamAPlayer2Id]) {
          const record = opponents.get(id) ?? { games: 0, wins: 0, losses: 0 };
          record.games += 1;
          record[won ? "wins" : "losses"] += 1;
          opponents.set(id, record);
        }
      }
      for (const [title, field] of [
        ["Nemesis", "losses"],
        ["Curbstomped", "wins"],
      ]) {
        const card = dialog
          .getByRole("heading", { name: title, exact: true })
          .locator("..");
        const eligible = [...opponents].filter(
          ([, record]) => record.games >= 3 && record[field] > 0,
        );
        const opponentScore = (record) =>
          score({
            successes: record[field],
            attempts: record.games,
            games: record.games,
          });
        const best = Math.max(
          ...eligible.map(([, record]) => opponentScore(record)),
        );
        const leaders = eligible.filter(
          ([, record]) => opponentScore(record) === best,
        );
        await expect(card.getByRole("listitem")).toHaveCount(leaders.length);
        for (const [id, record] of leaders) {
          await expect(card).toContainText(
            data.leaderboard.find((person) => person.id === id).name,
          );
          await expect(card).toContainText(
            `${((record[field] / record.games) * 100).toFixed(1)}% · ${record[field]}/${record.games} games ${field === "wins" ? "won" : "lost"}`,
          );
        }
        if (!leaders.length)
          await expect(card).toContainText(
            [...opponents.values()].some(({ games }) => games >= 3)
              ? `No ${field} against eligible opponents yet`
              : "Play at least 3 games against an opponent",
          );
      }
      const help = dialog.getByRole("button", {
        name: "How profile highlights are ranked",
      });
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      if (width === 390) await help.tap();
      else await help.hover();
      await expect(page.getByRole("tooltip")).toContainText(
        "Rankings balance success rates with games played",
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await help.blur();
      await help.focus();
      await expect(page.getByRole("tooltip")).toHaveAttribute("data-open", "");
      await expect(help).toHaveAttribute("aria-describedby", /.+/);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expect(dialog).toHaveAttribute("data-open", "");
      assert.equal(
        await dialog.evaluate(
          (element) => getComputedStyle(element).scrollbarWidth,
        ),
        "none",
      );
      assert.ok(
        await dialog.evaluate(
          (element) =>
            element.getBoundingClientRect().height <=
            window.innerHeight * 0.9 + 1,
        ),
      );
      if (games.length) {
        const chart = dialog.getByRole("application");
        await chart.scrollIntoViewIfNeeded();
        await chart.focus();
        await page.keyboard.press("ArrowRight");
        await expect(dialog.locator(".recharts-tooltip-wrapper")).toBeVisible();
        if (width === 390) {
          const lastPoint = dialog.locator(".recharts-line-dot").last();
          await lastPoint.scrollIntoViewIfNeeded();
          const point = await lastPoint.boundingBox();
          assert.ok(point);
          // The active-point marker may cover the underlying dot after keyboard
          // navigation. Tap its screen position as a real touch user would.
          await page.touchscreen.tap(
            point.x + point.width / 2,
            point.y + point.height / 2,
          );
          await expect(
            dialog.locator(".recharts-tooltip-wrapper"),
          ).toContainText(`Elo ${player.rating.toFixed(1)}`);
        }
      }
      const close = dialog.getByRole("button", { name: "Close profile" });
      await close.focus();
      await page.keyboard.press("Shift+Tab");
      await expect
        .poll(
          () =>
            dialog.evaluate((element) =>
              element.contains(document.activeElement),
            ),
          { message: "Focus must remain trapped in the dialog" },
        )
        .toBe(true);
      assert.ok(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      if (index === 0) await page.keyboard.press("Escape");
      else await close.click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await selectDashboardTab(page, "Matchmaker");
      await expect(
        page.getByRole("button", { name: /4 of \d+ players|All players/ }),
      ).toHaveText(poolText);
      await selectDashboardTab(page, "Leaderboard");
    }
    assert.deepEqual(errors, []);
  }
});

test("dashboard stays in the viewport with mobile tabs and independently scrolling cards", async (context) => {
  for (const viewport of [
    { width: 390, height: 600 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ]) {
    const { page, errors } = await openPage(context, "/", { viewport });
    const isMobile = viewport.width < 1024;
    const tabs = page.getByRole("tablist", { name: "Dashboard views" });
    if (isMobile) {
      await expect(tabs).toBeVisible();
      await expect(
        page.getByRole("tab", { name: "Leaderboard", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        page.getByRole("region", { name: "Recent games list" }),
      ).toBeHidden();
      await page.getByRole("tab", { name: "Leaderboard", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("tab", { name: "Matchmaker", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
    } else await expect(tabs).toBeHidden();
    await selectMatchmakingPlayers(page);
    await page.getByRole("button", { name: "Randomize teams" }).click();
    await selectDashboardTab(page, "Recent games");
    const history = page.getByRole("region", { name: "Recent games list" });
    await history.getByRole("button", { name: /Show all/ }).click();
    await expect(
      history.getByRole("button", { name: "Show last 3" }),
    ).toBeVisible();
    await history.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("End");
    await expect
      .poll(() => history.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    await selectDashboardTab(page, "Leaderboard");
    const leaderboard = page.getByRole("region", {
      name: "Leaderboard players",
    });
    await leaderboard
      .getByRole("button", { name: /^View .+'s profile$/ })
      .last()
      .scrollIntoViewIfNeeded();
    await selectDashboardTab(page, "Matchmaker");
    await expect(
      page.getByRole("button", { name: /4 of \d+ players|All players/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Find fair teams" }),
    ).toBeEnabled();
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth &&
          scrollY === 0,
      ),
    );
    if (isMobile) {
      await page.setViewportSize({ width: 1280, height: 720 });
      for (const name of [
        "Leaderboard players",
        "Matchmaking controls",
        "Recent games list",
      ])
        await expect(page.getByRole("region", { name })).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      );
      await page.setViewportSize(viewport);
      await expect(
        page.getByRole("tab", { name: "Matchmaker", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
    }
    assert.deepEqual(errors, []);
  }
});
