// Replaces Elementor thumbnails with the original uploads.
//
//   node scripts/fetch-originals.mjs                 every page
//   node scripts/fetch-originals.mjs lysis-pipette   just that page
//
// Most images were first downloaded from wp-content/uploads/elementor/thumbs/.
// Elementor makes those at a fixed custom width AND height, squashing the
// photo to fit, so many are stretched. This script looks each one up in the
// old site's public media listing (wp-json/wp/v2/media), downloads the
// original upload into public/images/full/ and records it as "source".
// Files already in public/images are never changed. Safe to re-run.
// Afterwards run scripts/prepare-images.mjs and scripts/aspect.mjs.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const PAGES = join(ROOT, 'src/data/pages');
const FULL = join(ROOT, 'public/images/full');
const API = 'https://www.andersenlee.ca/wp-json/wp/v2/media';
const HEADERS = { 'User-Agent': 'andersenlee-site migration script' };
mkdirSync(FULL, { recursive: true });

// "IMG_1053-1-scaled-rfvp4puo2jxztfrvmvhuce2mhk6zqcfzssrr9rvah8.png" -> "IMG_1053-1-scaled"
// "IMG_0761-768x1024.jpg" (WordPress resized copy)                   -> "IMG_0761"
const stem = (name) =>
  basename(name, extname(name)).replace(/-[a-z0-9]{30,}$/, '').replace(/-\d+x\d+$/, '');

// Every original upload on the old site, by file stem.
const originals = new Map();
for (let page = 1; ; page++) {
  const res = await fetch(`${API}?per_page=100&page=${page}&_fields=source_url`, { headers: HEADERS });
  if (!res.ok) break;                       // past the last page
  const batch = await res.json();
  if (!batch.length) break;
  for (const m of batch) originals.set(stem(decodeURI(m.source_url)), m.source_url);
}
console.log(`old site lists ${originals.size} original uploads`);

const report = { replaced: 0, already: 0, notFound: [] };
async function visit(node) {
  if (Array.isArray(node)) { for (const n of node) await visit(n); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.img === 'string') {
    const current = node.source ?? node.img;
    const s = stem(decodeURI(current));
    const url = originals.get(s) ?? originals.get(`${s}-scaled`);   // WP stores big uploads as -scaled
    if (!url) {
      if (!current.startsWith('/images/full/')) report.notFound.push(basename(current));
    } else {
      const name = basename(decodeURI(url));
      const dest = join(FULL, name);
      if (!existsSync(dest)) {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) { report.notFound.push(`${name} (HTTP ${res.status})`); return; }
        writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
        report.replaced++;
      } else report.already++;
      node.source = `/images/full/${name}`;
      if (!node.img.startsWith('/images/web/')) node.img = node.source;
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
console.log(`downloaded ${report.replaced}, already had ${report.already}`);
if (report.notFound.length) console.log('no original found (kept as is):\n  ' + report.notFound.join('\n  '));
