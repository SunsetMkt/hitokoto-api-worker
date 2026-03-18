#!/usr/bin/env node
/**
 * Downloads sentence data from the hitokoto-osc/sentences-bundle repository
 * and saves it to src/data/ for bundling into the Cloudflare Worker.
 * After downloading, packs all JSON files into msgpack binary format.
 */

import { createWriteStream, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');
const BASE_URL =
  'https://raw.githubusercontent.com/hitokoto-osc/sentences-bundle/master';

const FILES = [
  'categories.json',
  'version.json',
  'sentences/a.json',
  'sentences/b.json',
  'sentences/c.json',
  'sentences/d.json',
  'sentences/e.json',
  'sentences/f.json',
  'sentences/g.json',
  'sentences/h.json',
  'sentences/i.json',
  'sentences/j.json',
  'sentences/k.json',
  'sentences/l.json',
];

mkdirSync(join(DATA_DIR, 'sentences'), { recursive: true });

async function downloadFile(relativePath) {
  const url = `${BASE_URL}/${relativePath}`;
  const dest = join(DATA_DIR, relativePath);
  mkdirSync(dirname(dest), { recursive: true });

  console.log(`Downloading ${relativePath} ...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const fileStream = createWriteStream(dest);
  await pipeline(response.body, fileStream);
  console.log(`  -> saved to ${dest}`);
}

async function main() {
  console.log('Fetching sentences from hitokoto-osc/sentences-bundle...\n');
  for (const file of FILES) {
    await downloadFile(file);
  }
  console.log('\nDownload complete. Packing data...\n');

  // Dynamically import the pack script to avoid duplication
  const packScript = join(__dirname, 'pack-sentences.mjs');
  await import(packScript);

  console.log('\nDone!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
