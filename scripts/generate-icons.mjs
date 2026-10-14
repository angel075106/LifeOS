/**
 * Rasterizes the LifeOS app icons from scripts/icons/*.svg.
 * Run after changing the artwork:  node scripts/generate-icons.mjs
 * The generated files are committed; this script is not part of the build.
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = (name) => readFileSync(path.join(root, "scripts", "icons", name));
mkdirSync(path.join(root, "public", "icons"), { recursive: true });

const outputs = [
  { svg: "icon.svg", size: 192, file: "public/icons/icon-192.png" },
  { svg: "icon.svg", size: 512, file: "public/icons/icon-512.png" },
  { svg: "icon-maskable.svg", size: 512, file: "public/icons/icon-maskable-512.png" },
  // iOS home screen icon: opaque, iOS applies its own rounded mask.
  { svg: "icon-maskable.svg", size: 180, file: "app/apple-icon.png" },
];

for (const { svg, size, file } of outputs) {
  await sharp(source(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(root, file));
  console.log(`wrote ${file} (${size}x${size})`);
}

// Browser tab icon (SVG scales crisply at every size).
copyFileSync(path.join(root, "scripts", "icons", "icon.svg"), path.join(root, "app", "icon.svg"));
console.log("wrote app/icon.svg");
