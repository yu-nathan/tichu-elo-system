import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";

const { chromium, expect } = await import(
  process.env.PLAYWRIGHT_TEST_MODULE ?? "playwright/test"
);
const baseURL = process.env.TICHU_TEST_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname))
  throw new Error("Browser tests must target a local development server.");
let browser;
before(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
after(async () => {
  await browser?.close();
});

const openSession = async (context, options = {}) => {
  const session = await browser.newContext({
    baseURL,
    timezoneId: "America/Los_Angeles",
    reducedMotion: "no-preference",
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
  await page.clock.setFixedTime(new Date("2026-10-19T19:00:00Z"));
  return { page, errors };
};

const expectTheme = async (page, theme, hydrated = true) => {
  if (hydrated)
    await expect(page.locator(".seasonal-site")).toHaveAttribute(
      "data-theme-ready",
      "true",
    );
  await expect(page.locator("html")).toHaveAttribute("data-season", theme);
};

test("mobile selects its palette before app scripts load and preserves it through hydration", async (context) => {
  for (const scenario of [
    { theme: "halloween" },
    { preference: "default", theme: "default" },
    {
      preference: "default",
      preview: "christmas",
      theme: "christmas",
      colorBlind: true,
    },
    { preview: "invalid", blockedStorage: true, theme: "halloween" },
    { date: "2026-11-26T20:00:00Z", theme: "thanksgiving" },
    { date: "2026-11-27T20:00:00Z", theme: "christmas" },
    { date: "2027-01-01T20:00:00Z", theme: "default" },
    { date: "2026-10-01T01:00:00Z", theme: "default" },
  ]) {
    const { page, errors } = await openSession(context, {
      viewport: { width: 390, height: 844 },
    });
    if (scenario.date) await page.clock.setFixedTime(new Date(scenario.date));
    await page.addInitScript((scenario) => {
      if (scenario.preference)
        localStorage.setItem("tichu-elo:theme:v1", scenario.preference);
      if (scenario.colorBlind)
        localStorage.setItem("tichu-elo:color-blind:v1", "enabled");
      if (scenario.blockedStorage)
        Object.defineProperty(window, "localStorage", {
          get: () => {
            throw new Error("Storage unavailable");
          },
        });
    }, scenario);
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") await pending;
      await route.continue();
    });
    await page.goto(scenario.preview ? `/?theme=${scenario.preview}` : "/", {
      waitUntil: "commit",
    });
    try {
      // Only the parser-blocking inline head script can have run here.
      await expectTheme(page, scenario.theme, false);
      await expect(page.locator(".seasonal-site")).toHaveAttribute(
        "data-theme-ready",
        "false",
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-colorblind",
        String(Boolean(scenario.colorBlind)),
      );
      await expect(page.getByText("Tichu Elo", { exact: true })).toBeVisible();
      await page.evaluate(() => {
        window.observedSeasons = [];
        new MutationObserver(() => {
          window.observedSeasons.push(document.documentElement.dataset.season);
        }).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-season"],
        });
      });
    } finally {
      release();
    }
    await page.waitForLoadState("load");
    await expectTheme(page, scenario.theme);
    // A functioning toggle confirms hydration has completed.
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await page
      .getByRole("menuitemcheckbox", { name: "Color-blind mode", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-colorblind",
      String(!scenario.colorBlind),
    );
    assert.ok(
      (await page.evaluate(() => window.observedSeasons)).every(
        (theme) => theme === scenario.theme,
      ),
    );
    assert.deepEqual(errors, []);
  }
});

test("mobile appearance menu keeps Manage separate and supports every theme control", async (context) => {
  for (const width of [320, 390]) {
    const { page, errors } = await openSession(context, {
      viewport: { width, height: 844 },
    });
    const appearance = page.getByRole("button", {
      name: "Appearance",
      exact: true,
    });
    const openMenu = async () => {
      if ((await appearance.getAttribute("aria-expanded")) !== "true")
        await appearance.click();
      await expect(page.getByRole("menu")).toBeVisible();
    };
    const closeMenu = async () => {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
    };
    const choose = async (name, role = "menuitem") => {
      await openMenu();
      await page.getByRole(role, { name, exact: true }).click();
      await closeMenu();
    };
    for (const path of ["/", "/admin"]) {
      await page.goto(path);
      await expectTheme(page, "halloween");
      const navigation = page.getByRole("button", {
        name: path === "/" ? "Manage" : "Leaderboard",
        exact: true,
      });
      await expect(navigation).toBeVisible();
      await expect(appearance).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Color-blind mode", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Use default theme", exact: true }),
      ).toHaveCount(0);
      const navBox = await navigation.boundingBox();
      const menuBox = await appearance.boundingBox();
      assert.ok(
        navBox.x + navBox.width <= menuBox.x,
        "Manage stays separate from Appearance",
      );
      await openMenu();
      const popup = await page.getByRole("menu").boundingBox();
      assert.ok(popup.x >= 0 && popup.x + popup.width <= width);
      for (const item of await page.getByRole("menuitem").all()) {
        await expect(item).toHaveCSS("min-height", "44px");
      }
      await closeMenu();
      await expect(appearance).toBeFocused();
      await choose("Color-blind mode", "menuitemcheckbox");
      await expect(page.locator("html")).toHaveAttribute(
        "data-colorblind",
        "true",
      );
      await page.reload();
      await expectTheme(page, "halloween");
      await openMenu();
      await expect(
        page.getByRole("menuitemcheckbox", { name: "Color-blind mode" }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("menu")).toHaveCSS("--primary", "#9bd9ff");
      await choose("Color-blind mode", "menuitemcheckbox");
      await choose("Pause seasonal animations");
      await expect(page.locator(".seasonal-scene")).toHaveAttribute(
        "data-paused",
        "true",
      );
      await choose("Play seasonal animations");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openMenu();
      await expect(
        page.getByRole("menuitem", {
          name: "Animations off: reduced motion enabled",
        }),
      ).toHaveAttribute("aria-disabled", "true");
      await closeMenu();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      if (path === "/admin") await page.getByLabel("Team A score").fill("750");
      await choose("Use default theme");
      await expectTheme(page, "default");
      if (path === "/admin")
        await expect(page.getByLabel("Team A score")).toHaveValue("750");
      await page.reload();
      await expectTheme(page, "default");
      for (const [theme, label] of [
        ["halloween", "Halloween"],
        ["thanksgiving", "Thanksgiving"],
        ["christmas", "Christmas"],
        ["default", "Original"],
      ]) {
        await choose(label);
        await expectTheme(page, theme);
        assert.equal(
          await page.evaluate(() => localStorage.getItem("tichu-elo:theme:v1")),
          "default",
        );
      }
      await choose("Return to automatic");
      await expectTheme(page, "halloween");
      await choose("Use default theme");
      await choose("Use seasonal theme");
      await expectTheme(page, "halloween");
      if (process.env.TICHU_PREVIEW_DIR && path === "/" && width === 390) {
        await mkdir(process.env.TICHU_PREVIEW_DIR, { recursive: true });
        await page.screenshot({
          path: join(
            process.env.TICHU_PREVIEW_DIR,
            "mobile-compact-header.png",
          ),
        });
        await openMenu();
        await page.screenshot({
          path: join(
            process.env.TICHU_PREVIEW_DIR,
            "mobile-appearance-menu.png",
          ),
        });
        await closeMenu();
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    assert.deepEqual(errors, []);
  }
});

test("artwork stays transparent until decoded and reveals without shifting the header", async (context) => {
  const { page, errors } = await openSession(context);
  await page.addInitScript(() => {
    const NativeImage = window.Image;
    const pending = new Promise((resolve) => {
      window.releaseArtDecode = resolve;
    });
    window.Image = class extends NativeImage {
      decode = async () => {
        await super.decode();
        await pending;
      };
    };
  });
  for (const theme of ["halloween", "thanksgiving", "christmas"]) {
    for (const cached of [false, true]) {
      if (cached) await page.reload();
      else await page.goto(`/?theme=${theme}`);
      await expectTheme(page, theme);
      const art = page.locator(".seasonal-art");
      await expect(art).toHaveCount(4);
      for (const item of await art.all()) {
        await expect(item).toHaveAttribute("data-art-ready", "false");
        await expect(item).toHaveCSS("opacity", "0");
      }
      const header = page.locator('[data-slot="card-header"]').first();
      const before = await header.boundingBox();
      await page.evaluate(() => window.releaseArtDecode());
      for (const item of await art.all()) {
        await expect(item).toHaveAttribute("data-art-ready", "true");
        await expect(item).toHaveCSS("opacity", "1");
      }
      assert.deepEqual(await header.boundingBox(), before);
      await page
        .getByRole("button", { name: "Color-blind mode", exact: true })
        .click();
      await expect(art.first()).toHaveCSS("opacity", "1");
    }
  }
  assert.deepEqual(errors, []);
});

test("late or failed artwork never flashes into a different theme", async (context) => {
  const { page, errors } = await openSession(context, {
    reducedMotion: "reduce",
  });
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/seasonal/christmas-atlas.png", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/?theme=christmas", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('.seasonal-art[data-art-ready="false"]'),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Use default theme", exact: true })
    .click();
  release();
  await expectTheme(page, "default");
  await expect(page.locator(".seasonal-art")).toHaveCount(0);
  await page.goto("/?theme=christmas");
  await expect(
    page.locator('.seasonal-art[data-art-ready="true"]'),
  ).toHaveCount(4);
  await expect(page.locator(".seasonal-art").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.route("**/seasonal/thanksgiving*.png", (route) => route.abort());
  await page.goto("/?theme=thanksgiving");
  await expectTheme(page, "thanksgiving");
  await expect(
    page.locator('.seasonal-art[data-art-ready="false"]'),
  ).toHaveCount(4);
  await expect(
    page.getByRole("region", { name: "Leaderboard players" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use default theme", exact: true })
    .click();
  await expectTheme(page, "default");
  assert.deepEqual(errors, []);
});

test("color-blind mode persists across themes and pages without changing theme preferences", async (context) => {
  for (const viewport of [{ width: 1440, height: 1000 }]) {
    const { page, errors } = await openSession(context, { viewport });
    await page.goto("/?theme=christmas");
    await expectTheme(page, "christmas");
    const toggle = page.getByRole("button", {
      name: "Color-blind mode",
      exact: true,
    });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    for (const theme of ["halloween", "thanksgiving", "christmas", "default"]) {
      await page.goto(`/?theme=${theme}`);
      await expectTheme(page, theme);
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveCSS("--primary", "#9bd9ff");
      assert.equal(
        await page.evaluate(() => localStorage.getItem("tichu-elo:theme:v1")),
        null,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page
        .getByRole("button", { name: "Preview themes", exact: true })
        .click();
      await expect(page.getByRole("menu")).toHaveCSS("--primary", "#9bd9ff");
      await page.keyboard.press("Escape");
    }
    await page.goto("/admin?theme=christmas");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(page.locator("html")).toHaveCSS("--primary", "#c52c49");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("tichu-elo:color-blind:v1"),
      ),
      "disabled",
    );
    await page.evaluate(() => {
      localStorage.setItem("tichu-elo:color-blind:v1", "enabled");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "tichu-elo:color-blind:v1",
          newValue: "enabled",
        }),
      );
    });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    assert.deepEqual(errors, []);
  }
});

test("owner previews every theme from either header without changing preferences", async (context) => {
  for (const viewport of [{ width: 1440, height: 1000 }]) {
    const { page, errors } = await openSession(context, { viewport });
    await page.goto("/");
    await expectTheme(page, "halloween");
    await page
      .getByRole("button", { name: "Use default theme", exact: true })
      .click();
    for (const path of ["/", "/admin"]) {
      await page.goto(path);
      await expect(
        page.getByRole("button", { name: "Use seasonal theme", exact: true }),
      ).toBeVisible();
      for (const [theme, label] of [
        ["halloween", "Halloween"],
        ["thanksgiving", "Thanksgiving"],
        ["christmas", "Christmas"],
        ["default", "Original"],
      ]) {
        await page
          .getByRole("button", { name: "Preview themes", exact: true })
          .click();
        await page.getByRole("menuitem", { name: label, exact: true }).click();
        await expectTheme(page, theme);
        assert.equal(new URL(page.url()).searchParams.get("theme"), theme);
        assert.equal(
          await page.evaluate(() => localStorage.getItem("tichu-elo:theme:v1")),
          "default",
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        if (theme !== "default") {
          await expect(page.locator(".seasonal-art")).toHaveCount(4);
          if (path === "/")
            await expect(
              page.locator('[data-slot="card-header"] .seasonal-art'),
            ).toHaveCount(1);
          else {
            const surface = await page
              .locator('[data-slot="card"]')
              .first()
              .evaluate((el) => getComputedStyle(el).backgroundColor);
            assert.match(surface, /(?:0\.8|80%)/);
          }
        }
      }
    }
    await page
      .getByRole("button", { name: "Preview themes", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Return to automatic", exact: true })
      .click();
    await expectTheme(page, "halloween");
    assert.equal(new URL(page.url()).searchParams.has("theme"), false);
    assert.deepEqual(errors, []);
  }
});

test("signed-out visitors do not see the owner preview button", async (context) => {
  const { page } = await openSession(context, {
    extraHTTPHeaders: {
      authorization: "Bearer local-unauthenticated-preview-check",
    },
  });
  for (const path of ["/", "/admin"]) {
    await page.goto(path);
    await expectTheme(page, "halloween");
    await expect(
      page.getByRole("button", { name: "Preview themes", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Use default theme", exact: true }),
    ).toBeVisible();
  }
});

test("all seasonal previews preserve mobile and desktop dashboard interactions", async (context) => {
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    for (const theme of ["halloween", "thanksgiving", "christmas"]) {
      const { page, errors } = await openSession(context, { viewport });
      await page.goto(`/?theme=${theme}`);
      await expectTheme(page, theme);
      const illustrations = await page
        .locator(".seasonal-art")
        .evaluateAll((elements) =>
          elements.map((element) => {
            return `${element.querySelector("image").getAttribute("href")}|${element.dataset.artVariant}`;
          }),
        );
      assert.equal(
        new Set(illustrations).size,
        illustrations.length,
        "Each holiday illustration appears only once on the page",
      );
      await expect(page.locator(".seasonal-scene .seasonal-art")).toHaveCount(
        3,
      );
      const artworkMotion = await page
        .locator(".seasonal-art")
        .evaluateAll((elements) =>
          elements.map((element) => getComputedStyle(element).animationName),
        );
      assert.ok(artworkMotion.every((name) => name !== "none"));
      await expect(
        page.getByText("Leaderboard", { exact: true }).last(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: device === "mobile" ? "Appearance" : "Use default theme",
          exact: true,
        }),
      ).toBeVisible();
      assert.equal(
        await page
          .locator(".seasonal-scene")
          .evaluate((el) => getComputedStyle(el).pointerEvents),
        "none",
      );
      assert.equal(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight &&
            scrollY === 0,
        ),
        true,
      );
      const players = page.getByRole("region", { name: "Leaderboard players" });
      await players.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      assert.equal(
        await players.evaluate((el) => getComputedStyle(el).overflowY),
        "auto",
      );
      await players.evaluate((el) => {
        el.scrollTop = 0;
      });
      const trigger = page
        .getByRole("button", { name: /^View .+'s profile$/ })
        .filter({ visible: true })
        .first();
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Close profile" }),
      ).toBeVisible();
      const palette = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue(
          "--primary",
        ),
      );
      assert.equal(
        await dialog.evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--primary"),
        ),
        palette,
      );
      await dialog.getByRole("button", { name: "Close profile" }).click();
      await expect(trigger).toBeFocused();
      if (device === "mobile")
        await page
          .getByRole("tab", { name: "Matchmaker", exact: true })
          .click();
      await page
        .getByRole("button", { name: "All active players (default)" })
        .click();
      await expect(
        page.getByRole("menuitem", { name: "Include all players" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.locator('[data-slot="dropdown-menu-content"]'),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Randomize teams" }).click();
      await expect(
        page.getByText("Random matchup", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Find fair teams" }).click();
      if (device === "mobile")
        await page
          .getByRole("tab", { name: "Recent games", exact: true })
          .click();
      await expect(
        page.getByRole("region", { name: "Recent games list" }),
      ).toBeVisible();
      if (device === "mobile")
        await page
          .getByRole("tab", { name: "Leaderboard", exact: true })
          .click();
      const assetResponse = await page.request.get(
        `/seasonal/${theme}-atlas.png`,
      );
      assert.equal(assetResponse.status(), 200);
      assert.match(assetResponse.headers()["content-type"], /image\/png/);
      await page.evaluate(async (name) => {
        const art = new Image();
        art.src = `/seasonal/${name}-atlas.png`;
        await art.decode();
      }, theme);
      if (process.env.TICHU_PREVIEW_DIR) {
        await mkdir(process.env.TICHU_PREVIEW_DIR, { recursive: true });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => document.activeElement?.blur());
        await page.screenshot({
          path: join(process.env.TICHU_PREVIEW_DIR, `${theme}-${device}.png`),
        });
      }
      assert.deepEqual(errors, []);
    }
  }
});

test("default preference persists and previews remain temporary until explicitly chosen", async (context) => {
  const { page, errors } = await openSession(context);
  await page.goto("/");
  await expectTheme(page, "halloween");
  await page
    .getByRole("button", { name: "Use default theme", exact: true })
    .click();
  await expectTheme(page, "default");
  await expect(page.locator(".seasonal-scene")).toHaveCount(0);
  await page.reload();
  await expectTheme(page, "default");
  await page.goto("/?theme=christmas");
  await expectTheme(page, "christmas");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("tichu-elo:theme:v1")),
    "default",
  );
  await page
    .getByRole("button", { name: "Preview themes", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Thanksgiving", exact: true })
    .click();
  await expectTheme(page, "thanksgiving");
  await page
    .getByRole("button", { name: "Use default theme", exact: true })
    .click();
  assert.equal(new URL(page.url()).searchParams.has("theme"), false);
  await expectTheme(page, "default");
  await page
    .getByRole("button", { name: "Use seasonal theme", exact: true })
    .click();
  await expectTheme(page, "halloween");
  await page.reload();
  await expectTheme(page, "halloween");
  await page.goto("/?theme=default");
  await expectTheme(page, "default");
  await page
    .getByRole("button", { name: "Preview themes", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Return to automatic" }).click();
  await expectTheme(page, "halloween");
  await page.goto("/?theme=unknown");
  await expectTheme(page, "halloween");
  await expect(page.getByLabel("Theme preview", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Manage" }).click();
  await expectTheme(page, "halloween");
  await expect(page.locator(".seasonal-scene")).toHaveCount(1);
  assert.deepEqual(errors, []);
});

test("site-wide themes share controls, previews, and preferences with the admin console", async (context) => {
  for (const viewport of [{ width: 1440, height: 1000 }]) {
    const { page, errors } = await openSession(context, { viewport });
    for (const theme of ["halloween", "thanksgiving", "christmas"]) {
      await page.goto(`/?theme=${theme}`);
      await expect(
        page.getByRole("button", { name: "Manage", exact: true }),
      ).toHaveAttribute("href", `/admin?theme=${theme}`);
      await page.getByRole("button", { name: "Manage", exact: true }).click();
      await expectTheme(page, theme);
      await expect(
        page.getByRole("heading", { name: "Admin console" }),
      ).toBeVisible();
      assert.equal(new URL(page.url()).searchParams.get("theme"), theme);
      await expect(page.locator(".seasonal-scene")).toHaveCount(1);
      await expect(page.locator(".seasonal-scene .seasonal-art")).toHaveCount(
        4,
      );
      await expect(
        page.getByRole("button", { name: "Use default theme", exact: true }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
        true,
      );
      if (process.env.TICHU_PREVIEW_DIR) {
        await page.evaluate(async (name) => {
          const art = new Image();
          art.src = `/seasonal/${name}-atlas.png`;
          await art.decode();
        }, theme);
        await page.screenshot({
          path: join(
            process.env.TICHU_PREVIEW_DIR,
            `${theme}-admin-${viewport.width < 640 ? "mobile" : "desktop"}.png`,
          ),
        });
      }
      await page
        .getByRole("button", { name: "Leaderboard", exact: true })
        .click();
      await expectTheme(page, theme);
      assert.equal(new URL(page.url()).searchParams.get("theme"), theme);
    }
    await page.goto("/admin");
    await expectTheme(page, "halloween");
    await page.getByLabel("Team A score").fill("750");
    await page
      .getByRole("button", { name: "Use default theme", exact: true })
      .click();
    await expectTheme(page, "default");
    await expect(page.getByLabel("Team A score")).toHaveValue("750");
    await page
      .getByRole("button", { name: "Leaderboard", exact: true })
      .click();
    await expectTheme(page, "default");
    await page
      .getByRole("button", { name: "Use seasonal theme", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Pause seasonal animations" })
      .click();
    await page.getByRole("button", { name: "Manage", exact: true }).click();
    await expectTheme(page, "halloween");
    await expect(
      page.getByRole("button", { name: "Play seasonal animations" }),
    ).toBeVisible();
    assert.deepEqual(errors, []);
  }
});

test("animation preferences persist and reduced motion overrides playback", async (context) => {
  const { page, errors } = await openSession(context);
  await page.goto("/?theme=christmas");
  await expectTheme(page, "christmas");
  await page.getByRole("button", { name: "Pause seasonal animations" }).click();
  await expect(page.locator(".seasonal-scene")).toHaveAttribute(
    "data-paused",
    "true",
  );
  assert.ok(
    await page
      .locator(".seasonal-art")
      .evaluateAll((elements) =>
        elements.every(
          (element) =>
            getComputedStyle(element).animationPlayState === "paused",
        ),
      ),
  );
  assert.equal(
    await page
      .locator(".seasonal-particle")
      .first()
      .evaluate((el) => getComputedStyle(el).animationPlayState),
    "paused",
  );
  assert.equal(
    await page
      .locator(".seasonal-art")
      .first()
      .evaluate((el) => getComputedStyle(el).animationPlayState),
    "paused",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Play seasonal animations" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play seasonal animations" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", {
      name: "Animations off: reduced motion enabled",
    }),
  ).toBeDisabled();
  assert.ok(
    await page
      .locator(".seasonal-art")
      .evaluateAll((elements) =>
        elements.every(
          (element) => getComputedStyle(element).animationName === "none",
        ),
      ),
  );
  assert.equal(
    await page
      .locator(".seasonal-particle")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.equal(
    await page
      .locator(".seasonal-art")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".seasonal-scene")).toHaveAttribute(
    "data-paused",
    "false",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".seasonal-scene")).toHaveAttribute(
    "data-paused",
    "true",
  );
  assert.deepEqual(errors, []);
});

test("unavailable storage leaves theme, color-blind, and animation controls usable", async (context) => {
  const { page, errors } = await openSession(context);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto("/");
  await expectTheme(page, "halloween");
  await page
    .getByRole("button", { name: "Use default theme", exact: true })
    .click();
  await expectTheme(page, "default");
  await page
    .getByRole("button", { name: "Use seasonal theme", exact: true })
    .click();
  await expectTheme(page, "halloween");
  await page.getByRole("button", { name: "Pause seasonal animations" }).click();
  await expect(page.locator(".seasonal-scene")).toHaveAttribute(
    "data-paused",
    "true",
  );
  const colorBlind = page.getByRole("button", {
    name: "Color-blind mode",
    exact: true,
  });
  await colorBlind.click();
  await expect(colorBlind).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveCSS("--primary", "#9bd9ff");
  await colorBlind.click();
  await expect(colorBlind).toHaveAttribute("aria-pressed", "false");
  assert.deepEqual(errors, []);
});

test("the same instant follows each visitor's timezone", async (context) => {
  for (const [timezoneId, expected] of [
    ["America/Los_Angeles", "thanksgiving"],
    ["Asia/Tokyo", "christmas"],
  ]) {
    const { page, errors } = await openSession(context, { timezoneId });
    await page.clock.setFixedTime(new Date("2026-11-27T04:00:00Z"));
    await page.goto("/");
    await expectTheme(page, expected);
    assert.deepEqual(errors, []);
  }
});

test("open dashboards update at local midnight and when focus returns", async (context) => {
  const { page, errors } = await openSession(context);
  const justBeforeMidnight = new Date("2026-11-27T07:59:59.900Z");
  await page.clock.install({ time: justBeforeMidnight });
  await page.clock.pauseAt(justBeforeMidnight);
  await page.goto("/");
  await expectTheme(page, "thanksgiving");
  await page.clock.runFor(200);
  await expectTheme(page, "christmas");
  await page.clock.setSystemTime(new Date("2027-01-01T08:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expectTheme(page, "default");
  assert.deepEqual(errors, []);
});
