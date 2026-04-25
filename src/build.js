#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parse } from './parser.js';
import { texToHtml } from './tex-to-html.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// Prism requires CommonJS require() because its component loader uses it
const require = createRequire(import.meta.url);
const Prism = require('prismjs');
require('prismjs/components/prism-pascal.js');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a code string with Prism (Pascal), also converting @<Name@>
 * chunk references into §N links.
 */
function renderCode(raw, chunkDefs) {
  if (!raw || !raw.trim()) return '';

  // First, replace @<Name@> with placeholder tokens, then Prism-highlight,
  // then substitute the placeholders back as links.
  const refs = [];
  let processed = raw.replace(/@<([^@]*)@>/g, (_, name) => {
    const trimmed = name.trim();
    const defNums = chunkDefs.get(trimmed) || [];
    const target = defNums[0] ? `s${defNums[0]}` : null;
    const idx = refs.length;
    refs.push({ name: trimmed, target });
    return `\x00CHUNKREF${idx}\x00`;
  });

  // Strip other WEB control codes that don't translate to code
  processed = processed
    .replace(/@[@/|#+;!]/g, m => m === '@@' ? '@' : '')
    .replace(/@t[\s\S]*?@>/g, '')                  // @t... @> format control
    .replace(/@h/g, '')                            // @h (header)
    .replace(/@&/g, '')                            // @& (concatenate)
    .replace(/@\+/g, '')                           // @+ (indent)
    .replace(/@;/g, '')                            // @; (semicolon)
    .replace(/@[.:\^][^@]*@>/g, '')                // @. @: @^ index entries
    .replace(/@=[^@]*@>/g, m => m.slice(2, -2))    // @=verbatim@> → verbatim
    .replace(/@'[^']*'/g, m => m)                  // @'x' character literal
    .replace(/@"0-9a-fA-F]*/g, m => m);            // @"hex


  // Prism highlight
  let highlighted;
  try {
    highlighted = Prism.highlight(processed, Prism.languages.pascal, 'pascal');
  } catch {
    highlighted = escapeHtml(processed);
  }

  // Restore chunk refs
  highlighted = highlighted.replace(/\x00CHUNKREF(\d+)\x00/g, (_, i) => {
    const { name, target } = refs[Number(i)];
    if (target) {
      return `<a class="chunk-ref" href="#${target}">⟨${escapeHtml(name)}⟩</a>`;
    }
    return `<span class="chunk-ref unresolved">⟨${escapeHtml(name)}⟩</span>`;
  });

  return highlighted;
}

/**
 * Render a single section as an HTML string.
 */
function renderSection(sec, chunkDefs) {
  const { number, starred, partNumber, title, tex, defs, code, chunkName } = sec;

  const id = `s${number}`;
  const cls = starred ? 'section starred' : 'section';

  const numHtml = `<div class="section-num"><a href="#${id}">§${number}</a></div>`;

  let bodyHtml = '';

  if (starred && title) {
    const partLabel = partNumber != null
      ? `<span class="part-label">Part ${partNumber}</span>`
      : '';
    bodyHtml += `<div class="section-title">${partLabel}${escapeHtml(title)}.</div>\n`;
  }

  if (tex || (!starred && !defs.length && !code.trim())) {
    // Render prose. For unstarred sections we prefix a bold marker like the PDF.
    const proseHtml = texToHtml(tex);
    if (!starred) {
      // Insert bold "N." marker at the start of the first paragraph
      const withMarker = proseHtml.replace(
        /^<p>/,
        `<p><span class="section-marker">${number}.</span>`
      );
      bodyHtml += `<div class="tex-prose">${withMarker}</div>\n`;
    } else {
      bodyHtml += `<div class="tex-prose">${proseHtml}</div>\n`;
    }
  }

  if (defs.length) {
    bodyHtml += '<div class="defs">\n';
    for (const { kind, name, value } of defs) {
      const kindLabel = kind === 'd' ? 'define' : 'format';
      bodyHtml += `<div class="def-entry">` +
        `<span class="def-kind">${kindLabel}</span>` +
        `<span class="def-name">${escapeHtml(name)}</span>` +
        `<span class="def-sep">≡</span>` +
        `<span class="def-val">${escapeHtml(value.trim())}</span>` +
        `</div>\n`;
    }
    bodyHtml += '</div>\n';
  }

  if (code && code.trim()) {
    const codeHtml = renderCode(code, chunkDefs);
    let chunkLabelHtml = '';
    if (chunkName) {
      const defNums = chunkDefs.get(chunkName) || [];
      const moreLinks = defNums
        .filter(n => n !== number)
        .map(n => `<a href="#s${n}">§${n}</a>`)
        .join(', ');
      chunkLabelHtml = `<div class="chunk-label">` +
        `⟨${escapeHtml(chunkName)}⟩ ≡` +
        (moreLinks ? ` <span class="chunk-more">also: ${moreLinks}</span>` : '') +
        `</div>\n`;
    }
    bodyHtml += `<div class="code-block-wrap">\n${chunkLabelHtml}` +
      `<pre class="code-block language-pascal"><code>${codeHtml}</code></pre>\n</div>\n`;
  }

  return `<div class="${cls}" id="${id}">\n${numHtml}\n<div class="section-body">\n${bodyHtml}</div>\n</div>\n`;
}

/**
 * Build a TOC from starred sections.
 */
function buildToc(sections) {
  const items = sections
    .filter(s => s.starred)
    .map(s => {
      const label = s.title ? escapeHtml(s.title) : `Section ${s.number}`;
      const lead = s.partNumber != null
        ? `<span class="part-num">Part ${s.partNumber}</span>`
        : `<span class="sec-num">§${s.number}</span>`;
      return `<li><a href="#s${s.number}">${lead}<span class="toc-label">${label}</span></a></li>`;
    });
  return `<ul id="toc">\n${items.join('\n')}\n</ul>`;
}

async function buildFile(name) {
  const src = await readFile(join(ROOT, 'web-sources', name), 'utf8');
  console.log(`Parsing ${name}...`);
  const { sections, chunkDefs } = parse(src);
  console.log(`  ${sections.length} sections, ${chunkDefs.size} chunk definitions`);

  const css = await readFile(join(ROOT, 'viewer', 'style.css'), 'utf8');
  const js = await readFile(join(ROOT, 'viewer', 'viewer.js'), 'utf8');

  // KaTeX CSS from CDN (build-time rendering means no runtime JS needed)
  const katexCss = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">`;
  // Prism theme
  const prismCss = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">`;
  // Modern font (Inter)
  const fontCss = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">`;

  const docTitle = basename(name, '.web').toUpperCase();
  const tocHtml = buildToc(sections);

  console.log(`  Rendering sections...`);
  const sectionsHtml = sections.map(s => renderSection(s, chunkDefs)).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(docTitle)} — dekweb</title>
${katexCss}
${prismCss}
${fontCss}
<style>${css}</style>
</head>
<body>
<button id="toggle-sidebar" title="Toggle table of contents">✕</button>
<nav id="sidebar">
  <h2>Contents</h2>
  <div id="search-wrap">
    <input id="search" type="search" placeholder="Search sections…" autocomplete="off">
  </div>
  ${tocHtml}
</nav>
<main id="main">
  <header id="doc-header">
    <div class="doc-title">${escapeHtml(docTitle)}</div>
    <div class="doc-subtitle">Knuth's WEB &mdash; ${sections.length} sections</div>
  </header>
  ${sectionsHtml}
</main>
<script>${js}</script>
</body>
</html>`;

  await mkdir(join(ROOT, 'output'), { recursive: true });
  const outPath = join(ROOT, 'output', basename(name, '.web') + '.html');
  await writeFile(outPath, html, 'utf8');
  console.log(`  → ${outPath} (${(html.length / 1024).toFixed(0)}K)`);
}

// CLI: node src/build.js [tangle|weave|tex|all]
const arg = process.argv[2] || 'tangle';
const targets = arg === 'all'
  ? ['tangle.web', 'weave.web', 'tex.web']
  : [`${arg.replace(/\.web$/, '')}.web`];

for (const t of targets) {
  await buildFile(t);
}
