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
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      assert.deepEqual(errors, []);
    }
  }
});
