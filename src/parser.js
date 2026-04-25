/**
 * WEB file parser.
 *
 * Produces an array of section objects:
 *   { number, starred, title, tex, defs, code, chunkName, refs }
 *
 * Also returns a cross-reference map:
 *   { chunkDefs: Map<name, number[]>, chunkRefs: Map<name, number[]> }
 */

/**
 * Scan forward past a @<...@> or @=...@> or @^...@> span.
 * Returns the index just after the closing @>.
 */
function scanToAtClose(src, start) {
  let i = start;
  while (i < src.length) {
    if (src[i] === '@' && src[i + 1] === '>') return i + 2;
    i++;
  }
  return i; // unterminated — return end of string
}

/**
 * Extract the text of a @<...@> span starting just after the '<'.
 */
function extractSpanText(src, start) {
  let i = start;
  while (i < src.length) {
    if (src[i] === '@' && src[i + 1] === '>') return src.slice(start, i);
    i++;
  }
  return src.slice(start);
}

/**
 * Collect all @<Name@> references from a block of code text.
 * Returns array of unique names.
 */
function collectRefs(code) {
  const refs = [];
  const seen = new Set();
  let i = 0;
  while (i < code.length) {
    if (code[i] === '@') {
      const c = code[i + 1];
      if (c === '<') {
        const name = extractSpanText(code, i + 2).trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          refs.push(name);
        }
        i = scanToAtClose(code, i + 2);
        continue;
      } else if (c === '=' || c === '^' || c === '.' || c === ':') {
        // skip these spans entirely
        i = scanToAtClose(code, i + 2);
        continue;
      }
    }
    i++;
  }
  return refs;
}

/**
 * Parse a single @d or @f definition block.
 * Returns { kind, name, value } or null if malformed.
 */
function parseDef(kind, text) {
  // @d name==value  or  @d name=value  or  @d name value
  // Conventional WEB uses == but many use =.
  let splitIdx = text.indexOf('==');
  let sepLen = 2;
  if (splitIdx === -1) {
    splitIdx = text.indexOf('=');
    sepLen = 1;
  }

  if (splitIdx !== -1) {
    return {
      kind,
      name: text.slice(0, splitIdx).trim(),
      value: text.slice(splitIdx + sepLen).trim()
    };
  }
  // Fallback: split at first space
  const firstSpace = text.trim().indexOf(' ');
  if (firstSpace !== -1) {
    return {
      kind,
      name: text.trim().slice(0, firstSpace),
      value: text.trim().slice(firstSpace + 1)
    };
  }
  return { kind, name: text.trim(), value: '' };
}

/**
 * Main parse function.
 * @param {string} src  Full text of a .web file
 * @returns {{ sections: Section[], chunkDefs: Map, chunkRefs: Map, indexMap: Map }}
 */
export function parse(src) {
  const sections = [];
  const chunkDefs = new Map(); // chunkName -> [sectionNumber, ...]
  const chunkRefs = new Map(); // chunkName -> [sectionNumber, ...]
  const indexMap = new Map();  // identifier -> sectionNumbers[]

  function addIndex(id, num) {
    if (!indexMap.has(id)) indexMap.set(id, []);
    const nums = indexMap.get(id);
    if (!nums.includes(num)) nums.push(num);
  }

  // --- Tokenise into raw section blobs ---
  // ... (rest of tokenisation logic is unchanged)
  // A section starts with:
  //   @ <space>   (unnamed)
  //   @\n         (unnamed)
  //   @*          (starred)
  //   @**         (double-starred, treat same as single)
  //
  // The preamble (before the first section) is discarded (TeX macros only).

  const sectionBlobs = []; // { starred, raw }

  let i = 0;
  let inSection = false;
  let blobStart = 0;
  let blobStarred = false;

  while (i < src.length) {
    if (src[i] !== '@') { i++; continue; }

    const c = src[i + 1];

    // Skip control codes that don't start sections
    if (c === '<' || c === '=' || c === '^' || c === '.' || c === ':') {
      i = scanToAtClose(src, i + 2);
      continue;
    }

    // Section delimiters
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') {
      // unnamed section
      if (inSection) {
        sectionBlobs.push({ starred: blobStarred, raw: src.slice(blobStart, i) });
      }
      inSection = true;
      blobStarred = false;
      blobStart = i + 2; // skip "@ "
      i += 2;
      continue;
    }

    if (c === '*') {
      // starred section (possibly @**)
      if (inSection) {
        sectionBlobs.push({ starred: blobStarred, raw: src.slice(blobStart, i) });
      }
      inSection = true;
      blobStarred = true;
      // skip optional second *
      let skip = 2;
      if (src[i + 2] === '*') skip = 3;
      blobStart = i + skip;
      i += skip;
      continue;
    }

    // @@ or other two-char sequences — not a section delimiter
    i += 2;
  }

  // Last section
  if (inSection) {
    sectionBlobs.push({ starred: blobStarred, raw: src.slice(blobStart) });
  }

  // --- Parse each blob into a section struct ---
  for (let idx = 0; idx < sectionBlobs.length; idx++) {
    const num = idx + 1;
    const { starred, raw } = sectionBlobs[idx];

    let title = '';
    let partNumber = null;
    let body = raw;

    if (starred) {
      // Knuth's WEB convention: starred titles often start with \[N]
      // marking the major part number (Part 1, Part 2, etc).
      // Parse and extract this prefix before scanning for the title-end period.
      const partMatch = body.match(/^\s*\\\[(\d+)\]\s*/);
      if (partMatch) {
        partNumber = Number(partMatch[1]);
        body = body.slice(partMatch[0].length);
      }

      // Title is text up to the first sentence-ending period.
      // A period is sentence-ending when the preceding word has ≥ 2 characters
      // (to skip single-letter abbreviations like D. or E.).
      let ti = 0;
      while (ti < body.length) {
        if (body[ti] === '@' && (body[ti + 1] === '<' || body[ti + 1] === '=')) {
          ti = scanToAtClose(body, ti + 2);
          continue;
        }
        if (body[ti] === '.') {
          // Look back: count consecutive word characters before this period
          let back = ti - 1;
          let wordLen = 0;
          while (back >= 0 && /\w/.test(body[back])) { wordLen++; back--; }
          if (wordLen >= 2) {
            title = body.slice(0, ti).trim();
            body = body.slice(ti + 1);
            break;
          }
        }
        ti++;
      }
      if (!title) {
        title = body.trim();
        body = '';
      }
    }

    // Split body into: TeX part | defs | code
    // Strategy: scan for @d, @f, @p, @<Name@>= which start non-TeX content.
    // Everything before the first of these is the TeX part.

    let texEnd = body.length;
    let j = 0;
    let codeStartChar = null; // '@d', '@f', '@p', or '@<'

    while (j < body.length) {
      if (body[j] !== '@') { j++; continue; }
      const ch = body[j + 1];

      if (ch === '<') {
        // Check if this is a @<Name@>= definition
        const nameEnd = scanToAtClose(body, j + 2);
        if (body[nameEnd] === '=') {
          texEnd = j;
          codeStartChar = 'chunk';
          break;
        }
        // It's a reference inside TeX prose — keep scanning
        j = nameEnd;
        continue;
      }

      if (ch === '=' || ch === '^' || ch === '.' || ch === ':') {
        j = scanToAtClose(body, j + 2);
        continue;
      }

      if (ch === 'd' || ch === 'f') {
        texEnd = j;
        codeStartChar = ch;
        break;
      }

      if (ch === 'p') {
        texEnd = j;
        codeStartChar = 'p';
        break;
      }

      j += 2;
    }

    const tex = body.slice(0, texEnd).trim();
    const rest = body.slice(texEnd);

    // Parse defs and code out of `rest`
    const defs = [];
    let code = '';
    let chunkName = null;

    if (codeStartChar === 'p') {
      // @p starts Pascal code
      const atpIdx = rest.indexOf('@p');
      code = rest.slice(atpIdx + 2);
    } else if (codeStartChar === 'chunk') {
      // @<Name@>= defines a chunk
      const ltIdx = rest.indexOf('@<');
      const gtEnd = scanToAtClose(rest, ltIdx + 2);
      chunkName = rest.slice(ltIdx + 2, gtEnd - 2).trim(); // strip @>
      // after @> there should be = or ==
      let afterGt = gtEnd;
      if (rest[afterGt] === '=') afterGt++;
      if (rest[afterGt] === '=') afterGt++;
      code = rest.slice(afterGt);
    } else if (codeStartChar === 'd' || codeStartChar === 'f') {
      // May have multiple @d / @f, possibly followed by @p or @<chunk@>=
      let k = 0;
      while (k < rest.length) {
        if (rest[k] !== '@') { k++; continue; }
        const ch2 = rest[k + 1];
        if (ch2 === 'd' || ch2 === 'f') {
          const kind = ch2;
          k += 2;
          // Value runs to next @d, @f, @p, @<chunk@>=, or end
          let vEnd = k;
          while (vEnd < rest.length) {
            if (rest[vEnd] !== '@') { vEnd++; continue; }
            const ch3 = rest[vEnd + 1];
            if (ch3 === 'd' || ch3 === 'f' || ch3 === 'p') { break; }
            if (ch3 === '<') {
              const ne = scanToAtClose(rest, vEnd + 2);
              if (rest[ne] === '=') { vEnd = vEnd; break; } // chunk def
              vEnd = ne;
              continue;
            }
            if (ch3 === '=' || ch3 === '^' || ch3 === '.' || ch3 === ':') {
              vEnd = scanToAtClose(rest, vEnd + 2);
              continue;
            }
            vEnd += 2;
          }
          defs.push(parseDef(kind, rest.slice(k, vEnd)));
          k = vEnd;
          continue;
        }
        if (ch2 === 'p') {
          code = rest.slice(k + 2);
          break;
        }
        if (ch2 === '<') {
          const ne = scanToAtClose(rest, k + 2);
          if (rest[ne] === '=') {
            chunkName = rest.slice(k + 2, ne - 2).trim();
            let afterGt2 = ne;
            if (rest[afterGt2] === '=') afterGt2++;
            if (rest[afterGt2] === '=') afterGt2++;
            code = rest.slice(afterGt2);
            break;
          }
          k = ne;
          continue;
        }
        if (ch2 === '=' || ch2 === '^' || ch2 === '.' || ch2 === ':') {
          k = scanToAtClose(rest, k + 2);
          continue;
        }
        k += 2;
      }
    }

    // Collect chunk refs from code
    const refs = collectRefs(code);

    // --- Collect index entries ---

    // 1. Manual index entries (@^, @., @:) from both TeX and code
    const collectManual = (text) => {
      const re = /@([\^.:])([^@]+)@>/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const kind = m[1];
        const val = m[2].trim();
        // For simplicity, we just index the raw text. 
        // weave handles @. differently (typewriter), but here we consolidated them.
        addIndex(val, num);
      }
    };
    collectManual(tex);
    collectManual(code);
    for (const d of defs) collectManual(d.value);

    // 2. Pascal identifiers from code
    const collectIdentifiers = (text) => {
      // Basic Pascal identifier regex
      const re = /\b[a-zA-Z][a-zA-Z0-9_]*\b/g;
      const keywords = new Set([
        'and', 'array', 'begin', 'case', 'const', 'div', 'do', 'downto', 'else', 'end',
        'file', 'for', 'function', 'goto', 'if', 'in', 'label', 'mod', 'nil', 'not',
        'of', 'or', 'packed', 'procedure', 'program', 'record', 'repeat', 'set',
        'then', 'to', 'type', 'until', 'var', 'while', 'with'
      ]);
      let m;
      while ((m = re.exec(text)) !== null) {
        const id = m[0].toLowerCase();
        if (!keywords.has(id) && id.length > 2) {
          addIndex(m[0], num); // Use original casing for display? No, weave often case-folds.
          // Knuth's Pascal is mostly case-insensitive.
        }
      }
    };
    collectIdentifiers(code);

    // 3. Macro names from @d
    for (const d of defs) {
      if (d.kind === 'd') addIndex(d.name, num);
    }

    // 4. Chunk names
    if (chunkName) addIndex(chunkName, num);


    // Update cross-reference maps
    if (chunkName) {
      if (!chunkDefs.has(chunkName)) chunkDefs.set(chunkName, []);
      chunkDefs.get(chunkName).push(num);
    }
    for (const ref of refs) {
      if (!chunkRefs.has(ref)) chunkRefs.set(ref, []);
      chunkRefs.get(ref).push(num);
    }

    // Strip WEB index control codes from prose — they're invisible markup
    // for the index, not body content. Patterns:
    //   @^...@>     roman index entry
    //   @.text@>    typewriter index entry
    //   @:sort}{e@> user-defined index sort key
    //   @!          force-index marker (when adjacent to @^/@:/@./@<)
    const cleanTex = tex
      .replace(/@\^[^@]*@>/g, '')
      .replace(/@\.[^@]*@>/g, '')
      .replace(/@:[^@]*@>/g, '')
      .replace(/@!(?=\s*@[\^.:])/g, '')
      .replace(/@!(?=\s*@<)/g, '')
      // \(...) and \9... are sort keys: definitions discard their args
      .replace(/\\\([^)]*\)/g, '')
      .replace(/\\9\S*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    sections.push({ number: num, starred, partNumber, title, tex: cleanTex, defs, code, chunkName, refs });
  }

  return { sections, chunkDefs, chunkRefs, indexMap };
}
