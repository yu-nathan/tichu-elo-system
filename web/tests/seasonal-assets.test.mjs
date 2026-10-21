import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import assets from "../lib/seasonal-assets.json" with { type: "json" };

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
