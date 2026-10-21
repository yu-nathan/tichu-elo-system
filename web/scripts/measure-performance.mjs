const { chromium } = await import(
  process.env.PLAYWRIGHT_TEST_MODULE ?? "playwright/test"
);
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
const [url, output] = process.argv.slice(2);
if (!url || !output)
  throw new Error("Usage: npm run measure:performance -- <URL> <output.json>");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
try {
  for (const mobile of [false, true]) {
    for (let run = 1; run <= 5; run++) {
      const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
        isMobile: mobile,
        deviceScaleFactor: mobile ? 2 : 1,
        timezoneId: "America/Los_Angeles",
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
      if (mobile) {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 150,
          downloadThroughput: 200000,
          uploadThroughput: 93750,
        });
      }
      await page.addInitScript(() => {
        window.__metrics = { lcp: 0, cls: 0 };
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__metrics.lcp = e.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries())
            if (!e.hadRecentInput) window.__metrics.cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      for (const cache of ["fresh", "repeat"]) {
        const response = await page.goto(url, {
          waitUntil: "load",
          timeout: 90000,
        });
        await page.waitForTimeout(3000);
        await page.waitForLoadState("networkidle", { timeout: 60000 });
        const data = await page.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const resources = performance.getEntriesByType("resource");
          return {
            ...window.__metrics,
            ttfb: nav.responseStart,
            fcp:
              performance.getEntriesByName("first-contentful-paint")[0]
                ?.startTime ?? null,
            bytes:
              nav.transferSize +
              resources.reduce((n, r) => n + r.transferSize, 0),
            jsBytes: resources
              .filter((r) => r.name.includes(".js"))
              .reduce((n, r) => n + r.transferSize, 0),
            resources: resources.map((r) => ({
              name: new URL(r.name).pathname,
              start: r.startTime,
              bytes: r.transferSize,
            })),
            load: nav.loadEventEnd,
          };
        });
        const after = Object.fromEntries(
          (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
            m.name,
            m.value,
          ]),
        );
        await mkdir(dirname(output), { recursive: true });
        const row = {
          device: mobile ? "mobile" : "desktop",
          run,
          cache,
          status: response.status(),
          ...data,
          scriptMs: after.ScriptDuration * 1000,
        };
        rows.push(row);
        console.log(JSON.stringify({ ...row, resources: undefined }));
      }
      await context.close();
    }
  }
} finally {
  await writeFile(output, JSON.stringify({ url, rows }, null, 2));
  await browser.close();
}
