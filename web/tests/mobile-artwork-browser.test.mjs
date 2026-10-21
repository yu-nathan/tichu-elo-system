import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import assets from "../lib/seasonal-assets.json" with { type: "json" };
import mobile from "../lib/seasonal-mobile-assets.json" with { type: "json" };
const { chromium, expect } = await import(
  process.env.PLAYWRIGHT_TEST_MODULE ?? "playwright/test"
);
const baseURL = process.env.TICHU_TEST_URL ?? "http://localhost:8788";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname))
  throw new Error("Local preview only");
let browser;
before(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
after(async () => {
  await browser?.close();
});
const open = async (context, width = 390) => {
  const session = await browser.newContext({
    baseURL,
    viewport: { width, height: 900 },
    deviceScaleFactor: 3,
    reducedMotion: "reduce",
  });
  context.after(() => session.close());
  const page = await session.newPage();
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("/seasonal/generated/"))
      requests.push(new URL(request.url()).pathname);
  });
  return { page, requests };
};
const expectReady = async (page) => {
  await expect(page.locator(".seasonal-art")).toHaveCount(4);
  await expect(page.locator('[data-art-ready="false"]')).toHaveCount(0);
};

test("high-density mobile previews download only the shared mobile artwork for every season", async (context) => {
  for (const name of Object.keys(assets).filter((name) =>
    name.endsWith("-atlas"),
  )) {
    const theme = name.replace(/-atlas$/, "");
    const { page, requests } = await open(context);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/?theme=${theme}`);
    await expectReady(page);
    assert.ok(requests.length >= 1);
    assert.ok(
      requests.every((url) => Object.values(mobile).includes(url)),
      `${theme}: no desktop download`,
    );
    assert.equal(
      requests.filter((url) => url === mobile[name]).length,
      1,
      `${theme}: one atlas request`,
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test("crossing the artwork breakpoint changes resolution without changing SVG crops", async (context) => {
  const { page, requests } = await open(context, 639);
  await page.goto("/?theme=halloween");
  await expectReady(page);
  const art = page.locator(".seasonal-heading-art svg");
  const crop = await art.getAttribute("viewBox");
  await expect(art.locator("image")).toHaveAttribute(
    "href",
    mobile["halloween-atlas"],
  );
  assert.equal(
    requests.filter((url) => url === assets["halloween-atlas"]).length,
    0,
  );
  await page.setViewportSize({ width: 640, height: 900 });
  await expect(art.locator("image")).toHaveAttribute(
    "href",
    assets["halloween-atlas"],
  );
  assert.equal(await art.getAttribute("viewBox"), crop);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(art.locator("image")).toHaveAttribute(
    "href",
    mobile["halloween-atlas"],
  );
  assert.equal(
    requests.filter((url) => url === mobile["halloween-atlas"]).length,
    1,
  );
  assert.equal(
    requests.filter((url) => url === assets["halloween-atlas"]).length,
    1,
  );
});

test("a failed mobile image stays hidden and the leaderboard remains usable", async (context) => {
  const { page } = await open(context);
  await page.route(`**${mobile["halloween-atlas"]}`, (route) =>
    route.abort("failed"),
  );
  await page.goto("/?theme=halloween");
  await expect(
    page.getByRole("button", { name: "Leaderboard season", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".seasonal-art")).toHaveCount(4);
  for (const art of await page.locator(".seasonal-art").all())
    await expect(art).toHaveCSS("opacity", "0");
  await page.unroute(`**${mobile["halloween-atlas"]}`);
  await page.reload();
  await expectReady(page);
});

test("a late desktop decode cannot replace the selected mobile artwork", async (context) => {
  const { page, requests } = await open(context, 1440);
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(`**${assets["halloween-atlas"]}`, async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/?theme=halloween", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => requests.includes(assets["halloween-atlas"]))
      .toBe(true);
    await page.setViewportSize({ width: 390, height: 900 });
    await expectReady(page);
    release();
    await page.waitForLoadState("networkidle");
    for (const image of await page.locator(".seasonal-art image").all())
      await expect(image).toHaveAttribute("href", mobile["halloween-atlas"]);
  } finally {
    release();
  }
});
