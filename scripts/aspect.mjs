// Reads the true width/height of every image and video used by the page JSON
// files and writes its aspect ratio (width / height) into the JSON as "ar".
//
//   node scripts/aspect.mjs            update every page in src/data/pages
//   node scripts/aspect.mjs lysis-pipette   update just that page
//
// Images: read with image-size (EXIF rotation respected, like browsers do).
// Videos (.mp4/.mov): read from the track header. Its width x height is the
// size the browser shows (checked in Chrome against a clip with a 90° matrix:
// tkhd 1068x480, shown 1068x480), so the rotation matrix is not applied again. A "poster" image, if given, is also
// measured, but the video's own ratio wins.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { imageSize } from 'image-size';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const PAGES = join(ROOT, 'src/data/pages');
const PUBLIC = join(ROOT, 'public');

const round = (n) => Math.round(n * 1000) / 1000;

function imageRatio(file) {
  const d = imageSize(readFileSync(file));
  const swap = d.orientation >= 5 && d.orientation <= 8;
  return swap ? d.height / d.width : d.width / d.height;
}

// Walk MP4/MOV boxes to the first video 'tkhd' (non-zero width).
function videoRatio(file) {
  const buf = readFileSync(file);
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts']);
  let found = null;
  (function walk(start, end) {
    let p = start;
    while (p + 8 <= end && !found) {
      let size = buf.readUInt32BE(p);
      const type = buf.toString('latin1', p + 4, p + 8);
      let header = 8;
      if (size === 1) { size = Number(buf.readBigUInt64BE(p + 8)); header = 16; }
      else if (size === 0) size = end - p;
      if (size < header) break;
      if (containers.has(type)) walk(p + header, p + size);
      else if (type === 'tkhd') {
        const b = p + header;
        const v = buf[b];
        const m = b + 4 + (v === 1 ? 32 : 20) + 8 + 8;          // -> matrix
        const w = buf.readUInt32BE(m + 36) / 65536;
        const h = buf.readUInt32BE(m + 40) / 65536;
        if (w && h) found = w / h;
      }
      p += size;
    }
  })(0, buf.length);
  if (!found) throw new Error('no video track header');
  return found;
}

const missing = [];
function measure(node) {
  if (Array.isArray(node)) return node.forEach(measure);
  if (!node || typeof node !== 'object') return;
  const src = node.img ?? node.video ?? null;
  if (typeof src === 'string') {
    const file = join(PUBLIC, decodeURI(src));
    if (!existsSync(file)) missing.push(src);
    else node.ar = round(node.img ? imageRatio(file) : videoRatio(file));
  }
  Object.values(node).forEach(measure);
}

const only = process.argv[2];
for (const f of readdirSync(PAGES).filter((f) => f.endsWith('.json'))) {
  if (only && f !== `${only}.json`) continue;
  const path = join(PAGES, f);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  measure(data);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log('measured', f);
}
if (missing.length) {
  console.error('MISSING FILES:\n  ' + missing.join('\n  '));
  process.exitCode = 1;
}
