#!/usr/bin/env node
/**
 * Packs sentence JSON data into msgpack binary format (.pack files)
 * to reduce the bundled Cloudflare Worker size.
 *
 * Run after fetching sentences:
 *   npm run pack-sentences
 */

import { pack } from 'msgpackr';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');

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

function packFile(relativePath) {
  const srcPath = join(DATA_DIR, relativePath);
  const destPath = srcPath.replace(/\.json$/, '.pack');

  const data = JSON.parse(readFileSync(srcPath, 'utf8'));
  const packed = pack(data);
  writeFileSync(destPath, packed);

  const srcSize = readFileSync(srcPath).length;
  const ratio = ((1 - packed.length / srcSize) * 100).toFixed(1);
  console.log(
    `  ${relativePath} -> ${relativePath.replace('.json', '.pack')}` +
      ` (${srcSize} -> ${packed.length} bytes, -${ratio}%)`,
  );
}

console.log('Packing sentences data with msgpackr...\n');
for (const file of FILES) {
  packFile(file);
}
console.log('\nDone!');
