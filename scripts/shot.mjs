// Full-page screenshots of every project and experience page.
//
//   node scripts/shot.mjs                  all pages
//   node scripts/shot.mjs lysis-pipette    just these slugs
//
// Starts `astro dev`, opens each page at 1440px and 390px wide, waits for
// every image and video to load, and saves screenshots/<slug>-<width>.png.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const OUT = join(ROOT, 'screenshots');
const PORT = 4399;
let BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [1440, 390];

const slugs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(join(ROOT, 'src/data/pages'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));

mkdirSync(join(OUT, 'slices'), { recursive: true });

const server = spawn(`npx astro dev --host 127.0.0.1 --port ${PORT}`, {
  cwd: ROOT,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stop = () => {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  else server.kill();
};

// Astro allows one dev server per project. If one is already running
// (e.g. your own `npm run dev`), reuse it instead of starting another.
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    const running = serverLog.match(/already running[\s\S]*?URL:\s+(\S+)/);
    if (running) {
      BASE = running[1].replace(/\/$/, '').replace('localhost', '127.0.0.1');
      console.log('reusing running dev server at', BASE);
    }
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    if (running) {
      BASE = running[1].replace(/\/$/, '');     // maybe it only listens on ::1
      if ((await fetch(BASE).catch(() => null))?.ok) return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('dev server did not start:\n' + serverLog);
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const slug of slugs) {
      for (const old of readdirSync(join(OUT, 'slices')).filter((f) => f.startsWith(`${slug}-${width}-`)))
        rmSync(join(OUT, 'slices', old));
      const res = await page.goto(`${BASE}/${slug}/`, { waitUntil: 'load' });
      if (!res || !res.ok()) { console.error(`FAIL ${slug} (${res?.status()})`); continue; }
      // Load lazy images and video frames so the full-page shot is complete.
      await page.evaluate(async () => {
        document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
        await Promise.all([
          ...[...document.images].map((i) =>
            i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })),
          ...[...document.querySelectorAll('video')].map((v) =>
            v.readyState >= 2 ? null : new Promise((r) => {
              v.onloadeddata = v.onerror = r; v.load(); setTimeout(r, 8000);
            })),
        ]);
        await document.fonts.ready;
        // Off-screen async-decoded images can be skipped by full-page capture.
        await Promise.all([...document.images].map((i) => {
          i.decoding = 'sync';
          return i.decode().catch(() => {});
        }));
        document.querySelector('astro-dev-toolbar')?.remove();
      });
      await page.waitForTimeout(200);

      // Layout checks: stretched media, unequal heights within a row,
      // unequal widths of rows stacked in the same section.
      const problems = await page.evaluate(() => {
        const out = [];
        const name = (el) => (el.currentSrc || el.src || '').split('/').pop().slice(0, 40);
        // (boxed items use object-fit: contain, which can't stretch, so skip them)
        document.querySelectorAll('.media:not(.media--contain) img, .media:not(.media--contain) video').forEach((el) => {
          const nw = el.naturalWidth || el.videoWidth, nh = el.naturalHeight || el.videoHeight;
          const r = el.getBoundingClientRect();
          if (!nw || !nh) return out.push(`not loaded: ${name(el)}`);
          const diff = Math.abs(nw / nh - r.width / r.height) / (nw / nh);
          if (diff > 0.01) out.push(`stretched ${(diff * 100).toFixed(1)}%: ${name(el)} file ${(nw / nh).toFixed(3)} shown ${(r.width / r.height).toFixed(3)}`);
        });
        if (innerWidth > 767) {
          document.querySelectorAll('.project__row').forEach((row) => {
            const hs = [...row.children].map((c) => c.getBoundingClientRect().height);
            if (Math.max(...hs) - Math.min(...hs) > 1) out.push(`row heights differ: ${hs.map(Math.round).join(', ')}`);
          });
          document.querySelectorAll('.project__rows').forEach((rows) => {
            // rows of all-same-shape images keep their own widths on purpose (Project.astro)
            if (!rows.style.getPropertyValue('--rows-w')) return;
            const ws = [...rows.children].map((c) => c.getBoundingClientRect().width);
            if (ws.length > 1 && Math.max(...ws) - Math.min(...ws) > 1) out.push(`stacked row widths differ: ${ws.map(Math.round).join(', ')}`);
          });
        }
        return out;
      });
      problems.forEach((p) => console.log(`  [${slug} ${width}] ${p}`));
      const file = join(OUT, `${slug}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log('saved', file);

      // Also save readable slices (full pages get shrunk too much to judge
      // gaps) into screenshots/slices/<slug>-<width>-<n>.png.
      const sliceH = width > 600 ? 1100 : 1600;
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      mkdirSync(join(OUT, 'slices'), { recursive: true });
      for (let y = 0, n = 1; y < total; y += sliceH, n++) {
        await page.screenshot({
          path: join(OUT, 'slices', `${slug}-${width}-${n}.png`),
          fullPage: true,
          clip: { x: 0, y, width, height: Math.min(sliceH, total - y) },
        });
      }
    }
    await page.close();
  }
  await browser.close();
} finally {
  stop();
}
