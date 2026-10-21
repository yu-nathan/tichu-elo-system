import assert from "node:assert/strict";
import { after, before, test } from "node:test";
const { chromium, expect } = await import(
  process.env.PLAYWRIGHT_TEST_MODULE ?? "playwright/test"
);
const baseURL = process.env.TICHU_TEST_URL ?? "http://127.0.0.1:8788";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname))
  throw new Error("Use a local production build.");
let browser;
before(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
after(async () => {
  await browser?.close();
});
const open = async (context) => {
  const session = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  context.after(() => session.close());
  const page = await session.newPage();
  await page.addInitScript(() => {
    window.__idle = null;
    window.requestIdleCallback = (callback) => {
      window.__idle = callback;
      return 1;
    };
    window.cancelIdleCallback = () => {
      window.__idle = null;
    };
  });
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(page.locator('[data-theme-ready="true"]')).toBeVisible();
  const trigger = page
    .getByRole("button", { name: /^View .+'s profile$/ })
    .first();
  return { page, requests, trigger };
};
const codeRequests = (requests) =>
  requests.filter((url) => /\/player-profile-[^/]+\.js/.test(url));
const dataRequests = (requests) =>
  requests.filter((url) => /\/api\/players\/\d+\/profile/.test(url));

test("mobile defers hidden panels and retains their state after switching tabs and resizing", async (context) => {
  const session = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  context.after(() => session.close());
  const page = await session.newPage();
  const requests = [];
  const errors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  const chunks = (name) =>
    requests.filter((url) => new RegExp(`/${name}-[^/]+\\.js`).test(url));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /^View .+'s profile$/ }).first(),
  ).toBeVisible();
  assert.equal(chunks("matchmaker-card").length, 0);
  assert.equal(chunks("history-card").length, 0);
  await page.getByRole("tab", { name: "Matchmaker", exact: true }).click();
  await page.getByRole("button", { name: "Randomize teams" }).click();
  await expect(page.getByText("Random matchup", { exact: true })).toBeVisible();
  assert.equal(chunks("matchmaker-card").length, 1);
  assert.equal(chunks("history-card").length, 0);
  await page.getByRole("tab", { name: "Recent games", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Recent games list" }),
  ).toBeVisible();
  assert.equal(chunks("history-card").length, 1);
  await page.getByRole("tab", { name: "Matchmaker", exact: true }).click();
  await expect(page.getByText("Random matchup", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole("region", { name: "Recent games list" }),
  ).toBeVisible();
  await expect(page.getByText("Random matchup", { exact: true })).toBeVisible();
  assert.equal(chunks("matchmaker-card").length, 1);
  assert.equal(chunks("history-card").length, 1);
  assert.deepEqual(errors, []);
});

test("resizing an untouched mobile dashboard loads both desktop panels", async (context) => {
  const session = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  context.after(() => session.close());
  const page = await session.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Leaderboard", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole("button", { name: "Randomize teams" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recent games list" }),
  ).toBeVisible();
});

test("a deferred panel download failure leaves the dashboard usable and recovers on reload", async (context) => {
  const session = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  context.after(() => session.close());
  const page = await session.newPage();
  await page.route(/\/history-card-[^/]+\.js/, (route) =>
    route.abort("failed"),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Recent games", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not load recent games",
  );
  await page.getByRole("tab", { name: "Leaderboard", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Leaderboard season", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Recent games", exact: true }).click();
  await page.unroute(/\/history-card-[^/]+\.js/);
  await page.getByRole("button", { name: "Reload page", exact: true }).click();
  await page.getByRole("tab", { name: "Recent games", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Recent games list" }),
  ).toBeVisible();
});

test("HTTP stream includes a public loading shell before resolved dashboard content", async () => {
  const response = await fetch(baseURL);
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let sawShellBeforeContent = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (
      html.includes('data-dashboard-shell="true"') &&
      !html.includes("Admin sign in")
    )
      sawShellBeforeContent = true;
  }
  assert.ok(
    sawShellBeforeContent,
    "loading shell must arrive in an earlier HTTP chunk",
  );
  assert.ok(
    html.indexOf('data-dashboard-shell="true"') < html.indexOf("Admin sign in"),
  );
  assert.ok(html.includes("Admin sign in"));
});

test("profile code waits for intent; hover reuses both code and statistics on open", async (context) => {
  const { page, requests, trigger } = await open(context);
  assert.equal(codeRequests(requests).length, 0);
  assert.equal(dataRequests(requests).length, 0);
  await trigger.hover();
  await expect.poll(() => codeRequests(requests).length).toBe(1);
  await expect.poll(() => dataRequests(requests).length).toBe(1);
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Loading profile…", { exact: true })).toHaveCount(
    0,
  );
  assert.equal(dataRequests(requests).length, 1);
  assert.equal(codeRequests(requests).length, 1);
});

test("keyboard focus prefetches only the focused player; idle loads code without data", async (context) => {
  const { page, requests, trigger } = await open(context);
  await page.evaluate(() =>
    window.__idle?.({ didTimeout: false, timeRemaining: () => 50 }),
  );
  await expect.poll(() => codeRequests(requests).length).toBe(1);
  assert.equal(dataRequests(requests).length, 0);
  await trigger.focus();
  await expect.poll(() => dataRequests(requests).length).toBe(1);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Loading profile…", { exact: true })).toHaveCount(
    0,
  );
  assert.equal(dataRequests(requests).length, 1);
});

test("failed speculative data retries on open and a direct click shows a stable skeleton", async (context) => {
  const { page, requests, trigger } = await open(context);
  let attempts = 0;
  await page.route("**/api/players/*/profile", async (route) => {
    if (++attempts === 1)
      await route.fulfill({
        status: 503,
        json: { error: "Temporary failure" },
      });
    else {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    }
  });
  await trigger.hover();
  await expect.poll(() => attempts).toBe(1);
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole("alert").count(), 0);
  await trigger.dispatchEvent("click");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Loading profile…", { exact: true })).toHaveCount(
    1,
  );
  const before = await page.getByRole("dialog").boundingBox();
  await expect(page.getByText("Loading profile…", { exact: true })).toHaveCount(
    0,
  );
  const after = await page.getByRole("dialog").boundingBox();
  assert.equal(after.height, before.height);
  assert.equal(after.width, before.width);
  assert.equal(dataRequests(requests).length, 2);
});

test("a fresh direct click starts code and data; refresh invalidates prefetched data", async (context) => {
  const { page, requests, trigger } = await open(context);
  await trigger.dispatchEvent("click");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Loading profile…", { exact: true })).toHaveCount(
    0,
  );
  assert.equal(dataRequests(requests).length, 1);
  assert.equal(codeRequests(requests).length, 1);
  await page.keyboard.press("Escape");
  const refresh = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/dashboard",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refresh;
  await trigger.hover();
  await expect.poll(() => dataRequests(requests).length).toBe(2);
});

test("dashboard HTTP responses remain uncacheable and expose aggregate timings only", async (context) => {
  const { page } = await open(context);
  const response = await page.request.get("/api/dashboard");
  assert.equal(response.headers()["cache-control"], "no-store");
  assert.match(response.headers()["server-timing"], /cache_read;dur=/);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), [
    "history",
    "leaderboard",
    "season",
    "seasons",
  ]);
  assert.ok(!JSON.stringify(body).includes("userEmail"));
});

test("a failed speculative module download retries when the profile opens", async (context) => {
  const { page, trigger } = await open(context);
  let attempts = 0;
  await page.route(/\/player-profile-[^/]+\.js/, async (route) => {
    if (++attempts === 1) await route.abort("failed");
    else await route.continue();
  });
  await trigger.hover();
  await expect.poll(() => attempts).toBe(1);
  await page.waitForTimeout(150);
  await trigger.dispatchEvent("click");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Loading profile…", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "Retry profile" })).toHaveCount(
    0,
  );
  assert.ok(attempts >= 2);
});

test("shared dashboard snapshots do not reuse personalized homepage controls", async (context) => {
  const anonymous = await browser.newContext({ baseURL });
  const owner = await browser.newContext({
    baseURL,
    extraHTTPHeaders: {
      "oai-authenticated-user-id": "local-cache-check",
      "oai-authenticated-user-email": "nyu1997@gmail.com",
    },
  });
  context.after(() => anonymous.close());
  context.after(() => owner.close());
  const publicPage = await anonymous.newPage(),
    ownerPage = await owner.newPage();
  await ownerPage.goto("/");
  await expect(
    ownerPage.getByRole("button", { name: "Manage", exact: true }),
  ).toBeVisible();
  await publicPage.goto("/");
  await expect(
    publicPage.getByRole("button", { name: "Admin sign in", exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("button", { name: "Manage", exact: true }),
  ).toHaveCount(0);
  assert.deepEqual(
    await (await ownerPage.request.get("/api/dashboard")).json(),
    await (await publicPage.request.get("/api/dashboard")).json(),
  );
});
