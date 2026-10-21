import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import assets from "../lib/seasonal-assets.json" with { type: "json" };
import mobileAssets from "../lib/seasonal-mobile-assets.json" with { type: "json" };

test("seasonal WebP assets are smaller, content addressed, and preserve atlas dimensions and transparency", async () => {
  for (const [name, url] of Object.entries(assets)) {
    const original = await readFile(
      new URL(`../assets/seasonal-originals/${name}.png`, import.meta.url),
    );
    const encoded = await readFile(new URL(`../public${url}`, import.meta.url));
    assert.ok(encoded.length < original.length, `${name} must be smaller`);
    const hash = createHash("sha256")
      .update(encoded)
      .digest("hex")
      .slice(0, 12);
    assert.ok(url.endsWith(`.${hash}.webp`));
    const before = await sharp(original).metadata(),
      after = await sharp(encoded).metadata();
    assert.equal(after.width, before.width);
    assert.equal(after.height, before.height);
    assert.equal(after.format, "webp");
    assert.equal(after.hasAlpha, true);
    const alphaBefore = await sharp(original)
      .extractChannel("alpha")
      .raw()
      .toBuffer();
    const alphaAfter = await sharp(encoded)
      .extractChannel("alpha")
      .raw()
      .toBuffer();
    assert.ok(alphaBefore.equals(alphaAfter), `${name} transparency changed`);
  }
});

test("mobile WebP variants preserve aspect ratio and resampled transparency at a smaller size", async () => {
  assert.deepEqual(Object.keys(mobileAssets), Object.keys(assets));
  for (const [name, url] of Object.entries(mobileAssets)) {
    const original = await readFile(
      new URL(`../assets/seasonal-originals/${name}.png`, import.meta.url),
    );
    const desktop = await readFile(
      new URL(`../public${assets[name]}`, import.meta.url),
    );
    const mobile = await readFile(new URL(`../public${url}`, import.meta.url));
    const hash = createHash("sha256").update(mobile).digest("hex").slice(0, 12);
    assert.ok(url.endsWith(`.${hash}.webp`));
    assert.ok(
      mobile.length < desktop.length * 0.6,
      `${name}: meaningful download reduction`,
    );
    const before = await sharp(original).metadata(),
      after = await sharp(mobile).metadata();
    assert.equal(
      after.width,
      name.endsWith("-atlas") ? 768 : name === "halloween-spider" ? 160 : 512,
    );
    assert.equal(after.width / after.height, before.width / before.height);
    assert.equal(after.format, "webp");
    assert.equal(after.hasAlpha, true);
    const expectedAlpha = await sharp(original)
      .resize({ width: after.width })
      .extractChannel("alpha")
      .raw()
      .toBuffer();
    const actualAlpha = await sharp(mobile)
      .extractChannel("alpha")
      .raw()
      .toBuffer();
    assert.ok(
      expectedAlpha.equals(actualAlpha),
      `${name}: alpha changed after encoding`,
    );
  }
});
