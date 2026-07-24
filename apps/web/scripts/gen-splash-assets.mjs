/**
 * Generates the Rise PWA icons and iOS launch images from the chevron mark, so the
 * install icon and the native launch screen match the in-app splash (Design System/
 * Splash - Rise). Pure vector shapes only — no web fonts — so the raster is crisp and
 * reproducible on any machine.
 *
 *   node apps/web/scripts/gen-splash-assets.mjs
 *
 * Outputs to apps/web/public/icons (icons) and apps/web/public/splash (iOS launch images).
 * Commit the PNGs; re-run this if the mark ever changes.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const sharp = require(join(repoRoot, "node_modules/sharp"));

const ICONS = join(repoRoot, "apps/web/public/icons");
const SPLASH = join(repoRoot, "apps/web/public/splash");
mkdirSync(ICONS, { recursive: true });
mkdirSync(SPLASH, { recursive: true });

const GRAD = `
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff9a4d"/>
    <stop offset="0.52" stop-color="#f26a1b"/>
    <stop offset="1" stop-color="#e0540e"/>
  </linearGradient>`;

/** The double chevron, drawn into a `box`-sized square centred at (cx, cy). */
function chevron(cx, cy, box, faint = 0.4) {
  const s = box / 100; // art authored in a 100×100 viewBox
  const x = cx - box / 2;
  const y = cy - box / 2;
  const w = Math.max(6, 15 * s); // stroke width scales with the mark
  const P = (pts) => pts.map(([px, py]) => `${x + px * s},${y + py * s}`).join(" ");
  return `
    <polyline points="${P([[22, 52], [50, 26], [78, 52]])}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="${P([[22, 74], [50, 48], [78, 74]])}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${faint}"/>`;
}

/** App icon: rounded-square orange gradient with the white chevron. radius=0 = full bleed. */
function iconSvg(size, { radius, chevronFrac }) {
  const r = radius == null ? size * 0.22 : radius;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>${GRAD}</defs>
    <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
    ${chevron(size / 2, size / 2, size * chevronFrac)}
  </svg>`;
}

/** iOS launch image: the mobile splash lockup — glow, frosted logo box + chevron — full-bleed. */
function splashSvg(w, h) {
  const cx = w / 2;
  const cy = h * 0.44; // logo sits a little above centre, as in the mobile mockup
  const box = Math.round(Math.min(w, h) * 0.34); // frosted square
  const boxR = Math.round(box * 0.26);
  const glow = Math.min(w * 1.2, 560 * (w / 390));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      ${GRAD}
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.4"/>
        <stop offset="0.68" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <circle cx="${cx}" cy="${h * 0.32}" r="${glow / 2}" fill="url(#glow)"/>
    <rect x="${cx - box / 2}" y="${cy - box / 2}" width="${box}" height="${box}" rx="${boxR}" ry="${boxR}"
          fill="#ffffff" fill-opacity="0.16" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>
    ${chevron(cx, cy, box * 0.56)}
    <rect x="${cx - 75}" y="${h - 120}" width="150" height="4" rx="2" fill="#ffffff" fill-opacity="0.28"/>
    <rect x="${cx - 75}" y="${h - 120}" width="67" height="4" rx="2" fill="#ffffff"/>
  </svg>`;
}

const png = (svg, out) => sharp(Buffer.from(svg)).png().toFile(out);

// ---- icons ------------------------------------------------------------------
const iconJobs = [
  ["icon-192.png", iconSvg(192, { radius: 42, chevronFrac: 0.5 })],
  ["icon-512.png", iconSvg(512, { radius: 112, chevronFrac: 0.5 })],
  // Maskable: full-bleed square, chevron inside the ~80% safe zone.
  ["icon-maskable-512.png", iconSvg(512, { radius: 0, chevronFrac: 0.42 })],
  // Full-bleed opaque square — iOS applies its own squircle mask; transparent corners
  // would otherwise composite over black on the home screen.
  ["apple-touch-icon.png", iconSvg(180, { radius: 0, chevronFrac: 0.52 })],
];

// ---- iOS launch images (portrait device pixels for current iPhones) ---------
const splashSizes = [
  [750, 1334], [828, 1792], [1125, 2436], [1170, 2532],
  [1179, 2556], [1284, 2778], [1290, 2796],
];

const run = async () => {
  for (const [name, svg] of iconJobs) {
    await png(svg, join(ICONS, name));
    console.log("  icon   ", name);
  }
  for (const [w, h] of splashSizes) {
    const name = `apple-splash-${w}-${h}.png`;
    await png(splashSvg(w, h), join(SPLASH, name));
    console.log("  splash ", name);
  }
  console.log(`\nGenerated ${iconJobs.length} icons and ${splashSizes.length} launch images.`);
};

run().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
