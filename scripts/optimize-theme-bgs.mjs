// Optimize room theme background art for the V3 image-based room (BAGIAN 2).
// Converts Desain_ref/bg/bg_{tema}_{siang,malam}.png -> public/themes/{tema}-{siang,malam}.webp
// Run with: node scripts/optimize-theme-bgs.mjs
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(root, "Desain_ref", "bg");
const outDir = path.join(root, "public", "themes");

const THEMES = ["roket", "minecraft", "tayo"];
const TIMES = ["siang", "malam"];
const MAX_WIDTH = 1600;

async function main() {
  await mkdir(outDir, { recursive: true });

  for (const theme of THEMES) {
    for (const time of TIMES) {
      const source = path.join(sourceDir, `bg_${theme}_${time}.png`);
      const out = path.join(outDir, `${theme}-${time}.webp`);
      await sharp(source)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(out);
      console.log(`-> ${path.relative(root, out)}`);
    }
  }

  console.log("Theme backgrounds optimized.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
