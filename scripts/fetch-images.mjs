// Downloads every image and video the site uses from the current WordPress site
// into public/images/. Run once with:  npm run fetch-images
// Safe to re-run: files that already exist are skipped.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'scripts/image-manifest.json'), 'utf8'));

let done = 0, skipped = 0;
const failed = [];

async function get({ url, file }) {
  const dest = path.join(root, 'public', file);
  try {
    await fs.access(dest);
    skipped++;
    return;
  } catch {}
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    done++;
    process.stdout.write(`\r${done + skipped}/${manifest.length}`);
  } catch (e) {
    failed.push(`${url} (${e.message})`);
  }
}

const queue = [...manifest];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) await get(queue.shift());
  })
);

console.log(`\nDownloaded ${done}, already had ${skipped}, failed ${failed.length}`);
if (failed.length) {
  console.log(failed.join('\n'));
  process.exitCode = 1;
}
