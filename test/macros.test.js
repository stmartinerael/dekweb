import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

async function getMacros() {
  const content = await readFile(join(ROOT, 'web-sources', 'webmac.tex'), 'utf8');
  const macros = new Set();
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/\\(?:def|let|chardef|newbox|newcount|newdimen|newif|outer\\def)\\([a-zA-Z]+|[^a-zA-Z])/);
    if (match) {
      let name = match[1];
      if (line.includes('\\newif\\if')) {
        const ifMatch = line.match(/\\newif\\if([a-zA-Z]+)/);
        if (ifMatch) name = 'if' + ifMatch[1];
      }
      macros.add(name);
    }
  }
  return Array.from(macros);
}

async function getRules() {
  const content = await readFile(join(ROOT, 'src', 'tex-to-html.js'), 'utf8');
  return content;
}

test('all webmac.tex macros should have a rendering rule in tex-to-html.js', async () => {
  const macros = await getMacros();
  const rules = await getRules();
  
  // Macros that are handled by the parser or are purely internal layout for TeX/Weave
  const ignored = new Set([
    'bak', 'bakk', 'botofcontents', 'con', 'contentsfile', 'contentspagenumber',
    'fin', 'fullpageheight', 'ifon', 'ifpagesaved', 'iftitle', 'ind', 'inx',
    'lapstar', 'lbox', 'lheader', 'lr', 'magnify', 'mainfont', 'normaloutput',
    'nullsec', 'onmaybe', 'page', 'pageheight', 'pageshift', 'pagewidth',
    'readcontents', 'rhead', 'rheader', 'sbox', 'setpage', 'startsection',
    'takeone', 'taketwo', 'title', 'ttentry', 'sbox', 'lbox', 'rhead',
    'M', 'MN', 'N', 'X', 'Z', // Handled by parser/structural
    '1', '2', '3', '4', '5', '6', '7', // Indentation/breaks in Pascal code (Weave output)
    'defin', 'D', 'F', // Used to start definitions, handled by parser
    '[', // Part number, handled by parser
    '*', // Used as \*, usually just literal *
    '~', // Usually ignored or handled as non-breaking space
    '!', // @! force index marker
    'yskip', // handled
    'note', 'topsecno', 'topofcontents', 'ch', // structural/meta
    ':', // index entry marker
    'J', // \J = .@& join op in TANGLE, usually not in prose
    'P', 'Q', // mode switches in Weave, not needed in HTML
    'E', // exponent in math, usually handled by KaTeX natively or ignored
    'C', // Pascal comment, handled by PrismJS
    'ET', 'ETs', // cross-ref conjunctions
    'B', 'T', // begin/end controlled comments (@{ @}), handled
  ]);

  const missing = [];

  for (const m of macros) {
    if (ignored.has(m)) continue;
    
    // Check if macro name appears in a regex or KaTeX macro definition
    let found = false;
    
    // Escape special characters for regex
    const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Search patterns for tex-to-html.js:
    const searchPatterns = [
      new RegExp(`"${escaped}"\\s*:`),             // KaTeX macro key: "\\." : ...
      new RegExp(`'${escaped}'\\s*:`),             // map key: 'BS': ...
      new RegExp(`\\\\\\\\${escaped}`),           // \\m in JS string (regex): /\\m/
      new RegExp(`\\\\${escaped}`),               // \m in JS string
      // Also check if m is inside a group like \\(sc|mc) or \\([%#_$])
      new RegExp(`\\\\\\\\\\([^)]*${escaped}[^)]*\\)`), // \\(m|n)
      new RegExp(`\\\\\\\\\\[[^\]]*${escaped}[^\]]*\\]`), // \\[%#m]
    ];

    if (searchPatterns.some(p => p.test(rules))) {
      found = true;
    }

    if (!found) {
      missing.push(m);
    }
  }

  if (missing.length > 0) {
    console.log('Missing macros from webmac.tex:', missing);
  }
  
  assert.equal(missing.length, 0, `Missing rendering rules for: ${missing.join(', ')}`);
});
