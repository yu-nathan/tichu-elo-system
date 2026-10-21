import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const originals = new URL("../assets/seasonal-originals/", import.meta.url);
const output = new URL("../public/seasonal/generated/", import.meta.url);
await mkdir(output, { recursive: true });
const manifest = {};
const mobileManifest = {};
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
  // Mobile headings are 128 CSS px. Atlas cells at 768px retain enough detail
  // for ~3x displays while SVG coordinates continue to use the original grid.
  const mobileWidth = name.endsWith("-atlas")
    ? 768
    : name === "halloween-spider"
      ? 160
      : 512;
  const mobile = await sharp(original)
    .resize({ width: mobileWidth, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 100, effort: 6 })
    .toBuffer();
  const mobileHash = createHash("sha256")
    .update(mobile)
    .digest("hex")
    .slice(0, 12);
  const mobileFilename = `${name}-mobile.${mobileHash}.webp`;
  await writeFile(new URL(mobileFilename, output), mobile);
  mobileManifest[name] = `/seasonal/generated/${mobileFilename}`;
  console.log(
    `${name}: ${original.length} → ${encoded.length} desktop / ${mobile.length} mobile bytes`,
  );
}
await writeFile(
  new URL("../lib/seasonal-assets.json", import.meta.url),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  new URL("../lib/seasonal-mobile-assets.json", import.meta.url),
  JSON.stringify(mobileManifest, null, 2) + "\n",
);
