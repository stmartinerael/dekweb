#!/usr/bin/env node
import { writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

const SOURCES = [
  {
    name: 'tangle.web',
    url: 'https://tug.ctan.org/systems/knuth/dist/web/tangle.web',
  },
  {
    name: 'weave.web',
    url: 'https://tug.ctan.org/systems/knuth/dist/web/weave.web',
  },
  {
    name: 'tex.web',
    url: 'https://tug.ctan.org/systems/knuth/dist/tex/tex.web',
  },
  {
    name: 'webmac.tex',
    url: 'https://mirror.ctan.org/systems/knuth/dist/lib/webmac.tex',
  },
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

for (const { name, url } of SOURCES) {
  const dest = join(ROOT, 'web-sources', name);
  if (await exists(dest)) {
    console.log(`${name}: already present, skipping`);
    continue;
  }
  process.stdout.write(`${name}: fetching...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  await writeFile(dest, text, 'utf8');
  console.log(` ${(text.length / 1024).toFixed(0)}K written`);
}
