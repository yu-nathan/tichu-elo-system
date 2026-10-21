import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const originals = new URL("../assets/seasonal-originals/", import.meta.url);
const output = new URL("../public/seasonal/generated/", import.meta.url);
await mkdir(output, { recursive: true });
const manifest = {};
for (const file of (await readdir(originals))
  .filter((name) => name.endsWith(".png"))
  .sort()) {
  const original = await readFile(new URL(file, originals));
  const encoded = await sharp(original)
    .webp({ quality: 85, alphaQuality: 100, effort: 6 })
    .toBuffer();
  const name = file.replace(/\.png$/, "");
  const hash = createHash("sha256").update(encoded).digest("hex").slice(0, 12);
  const filename = `${name}.${hash}.webp`;
  await writeFile(new URL(filename, output), encoded);
  manifest[name] = `/seasonal/generated/${filename}`;
  console.log(
    `${name}: ${original.length} → ${encoded.length} bytes (${(100 * (1 - encoded.length / original.length)).toFixed(1)}% smaller)`,
  );
}
await writeFile(
  new URL("../lib/seasonal-assets.json", import.meta.url),
  JSON.stringify(manifest, null, 2) + "\n",
);
