// Generate PWA / favicon icons from Desain_ref/logo.png (Decision #4: PWA manifest + icons).
// Run with: node scripts/generate-pwa-icons.mjs
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "Desain_ref", "logo.png");
const iconsDir = path.join(root, "public", "icons");
const BG = "#E8F4FD"; // --background (Sky Adventure)

async function main() {
  await mkdir(iconsDir, { recursive: true });

  // Standard "any" purpose icons — transparent background, full bleed.
  for (const size of [192, 512]) {
    await sharp(source)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
  }

  // Maskable icons — logo scaled to ~80% on solid background so Android's
  // adaptive-icon safe zone never clips the badge.
  for (const size of [192, 512]) {
    const inner = Math.round(size * 0.8);
    const logo = await sharp(source).resize(inner, inner).toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: BG },
    })
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toFile(path.join(iconsDir, `icon-maskable-${size}.png`));
  }

  // Next.js App Router auto favicon (src/app/icon.png).
  await sharp(source)
    .resize(192, 192)
    .png()
    .toFile(path.join(root, "src", "app", "icon.png"));

  // Apple touch icon — flattened (no alpha) per Apple guidance.
  await sharp(source)
    .resize(180, 180)
    .flatten({ background: BG })
    .png()
    .toFile(path.join(root, "src", "app", "apple-icon.png"));

  console.log("PWA icons generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
