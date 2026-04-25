#!/usr/bin/env node
import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const OUT_DIR = join(ROOT, 'output');

const app = express();
const PORT = process.env.PORT || 7776;

if (!existsSync(OUT_DIR)) {
  console.error(`Error: Output directory not found at ${OUT_DIR}`);
  console.error('Please run "npm run build" first.');
  process.exit(1);
}

// Serve the generated HTML files
app.use(express.static(OUT_DIR));

// Simple index listing if no index.html exists
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>dekweb Viewer</title>
      <style>
        body { font-family: sans-serif; padding: 2rem; line-height: 1.6; }
        h1 { border-bottom: 1px solid #ccc; }
        ul { list-style: none; padding: 0; }
        li { margin-bottom: 0.5rem; }
        a { text-decoration: none; color: #007bff; font-weight: bold; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>dekweb Viewer</h1>
      <p>Select a WEB program to view:</p>
      <ul>
        <li><a href="/tangle.html">Tangle</a></li>
        <li><a href="/weave.html">Weave</a></li>
        <li><a href="/tex.html">TeX</a></li>
      </ul>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`dekweb server running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
