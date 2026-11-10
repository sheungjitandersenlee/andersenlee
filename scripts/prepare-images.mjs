// Makes the web copy of every image the pages use.
//
//   node scripts/prepare-images.mjs                 every page
//   node scripts/prepare-images.mjs lysis-pipette   just that page
//
// For each image entry: reads its "source" (the full-size original, see
// scripts/fetch-originals.mjs; falls back to "img"), and writes
// public/images/web/<name>.webp, which the page then shows as "img":
//   - resized so the long side is at most MAX_SIDE (sharp on 2x screens at
//     the largest size an image appears, without multi-MB downloads)
//   - white-background images (CAD renders, screenshots on white) get their
//     uneven white border trimmed and an even white margin added back,
//     MARGIN of the final image height on every side, so at the same row
//     height every white image gets the same visible margin.
//   - optional "crop": { "ar": 1, "focus": [x, y] } crops to that aspect ratio
//     around the subject (focus as fractions of width and height).
//     "pad": true instead pads a white-background image out to that aspect
//     ratio, so drawings and screenshots become that shape without losing
//     any of the picture.
// Originals are never changed. Run scripts/aspect.mjs afterwards.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const PAGES = join(ROOT, 'src/data/pages');
const PUBLIC = join(ROOT, 'public');
const OUT = join(PUBLIC, 'images/web');
const MAX_SIDE = 1800;
const QUALITY = 82;
const MARGIN = 0.06;           // white margin as a share of the final image height
const WHITE = 242;             // a channel at or above this counts as white
const EDGE_WHITE_SHARE = 0.97; // share of edge pixels that must be white
const WHITE_BG = { r: 255, g: 255, b: 255, alpha: 1 };
mkdirSync(OUT, { recursive: true });

async function hasWhiteEdge(input) {
  const { data, info } = await sharp(input).rotate().flatten({ background: WHITE_BG })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let white = 0, total = 0;
  const check = (x, y) => {
    const i = (y * w + x) * c;
    total++;
    if (data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE) white++;
  };
  for (let x = 0; x < w; x++) { check(x, 0); check(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { check(0, y); check(w - 1, y); }
  return white / total >= EDGE_WHITE_SHARE;
}

// "crop": { "ar": 1, "focus": [0.5, 0.47] } -> the largest region with that
// aspect ratio, centred on the focus point (fractions of width, height) and
// kept inside the image. Chosen by looking at each photo.
async function cropTo(input, { ar, focus = [0.5, 0.5] }) {
  const { width: W, height: H } = await sharp(input).metadata();
  const w = Math.round(Math.min(W, H * ar)), h = Math.round(Math.min(H, W / ar));
  const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(v)));
  const left = clamp(focus[0] * W - w / 2, W - w), top = clamp(focus[1] * H - h / 2, H - h);
  return sharp(input).extract({ left, top, width: w, height: h }).toBuffer();
}

async function makeWebCopy(src, dest, crop) {
  let input = await sharp(src).rotate().toBuffer();       // apply EXIF rotation
  if (crop && !crop.pad) input = await cropTo(input, crop);
  const white = await hasWhiteEdge(input);
  if (white) {
    const t = await sharp(input).flatten({ background: WHITE_BG })
      .trim({ background: '#ffffff', threshold: 255 - WHITE + 10 })
      .toBuffer({ resolveWithObject: true });
    const { width: tw, height: th } = t.info;
    let m = Math.round((MARGIN * th) / (1 - 2 * MARGIN));
    let ext = { top: m, bottom: m, left: m, right: m };
    if (crop?.pad) {
      // smallest box of the target shape that holds the picture plus margin
      const H = Math.max(th, tw / crop.ar) / (1 - 2 * MARGIN), W = H * crop.ar;
      const x = Math.round((W - tw) / 2), y = Math.round((H - th) / 2);
      ext = { top: y, bottom: y, left: x, right: x };
    }
    input = await sharp(t.data).extend({ ...ext, background: WHITE_BG }).toBuffer();
  }
  await sharp(input)
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(dest);
  return white;
}

const stats = { white: 0, other: 0, missing: [] };
async function visit(node) {
  if (Array.isArray(node)) { for (const n of node) await visit(n); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.img === 'string') {
    const source = node.source ?? node.img;
    const file = join(PUBLIC, decodeURI(source));
    if (!existsSync(file)) stats.missing.push(source);
    else if (/\.gif$/i.test(source)) {
      // animated GIFs are shown as they are (a web copy would keep one frame)
      node.source = source;
      node.img = source;
      stats.other++;
    } else {
      // cropped copies get their own name so the same photo can appear uncropped elsewhere
      const tag = node.crop ? `-${node.crop.pad ? 'pad' : 'crop'}${node.crop.ar}-${node.crop.focus?.join('-') ?? 'c'}` : '';
      const name = basename(decodeURI(source), extname(source)) + tag + '.webp';
      (await makeWebCopy(file, join(OUT, name), node.crop)) ? stats.white++ : stats.other++;
      node.source = source;
      node.img = `/images/web/${name}`;
    }
  }
  for (const [k, v] of Object.entries(node)) if (k !== 'source') await visit(v);
}

const only = process.argv[2];
for (const f of readdirSync(PAGES).filter((f) => f.endsWith('.json'))) {
  if (only && f !== `${only}.json`) continue;
  const path = join(PAGES, f);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  await visit(data);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
console.log(`web copies: ${stats.white} white-background (margins evened), ${stats.other} other`);
if (stats.missing.length) { console.error('MISSING SOURCE FILES:\n  ' + stats.missing.join('\n  ')); process.exitCode = 1; }
