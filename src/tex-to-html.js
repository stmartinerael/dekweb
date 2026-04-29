import katex from 'katex';

/**
 * Convert WEB's TeX prose text to HTML.
 * Handles the subset of TeX macros Knuth uses in his .web files.
 * Anything unrecognised is left wrapped in <span class="tex-unknown">.
 */

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function unescapeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const OP_MAP = {
  '<>': '≠',
  '<=': '≤',
  '>=': '≥',
  ':=': '←',
};

function replaceOperators(s) {
  return s.replace(/(?:&lt;&gt;|&lt;=|&gt;=|:=|<>|<=|>=)/g, (match) => {
    // Handle both escaped and unescaped versions
    const unescaped = unescapeHtml(match);
    return OP_MAP[unescaped] || match;
  });
}

/**
 * Render a math string with KaTeX, returning HTML.
 * Falls back to the raw source in a <code> if KaTeX throws.
 */
function renderMath(math, display, placeholders) {
  // Resolve any placeholders that might have been captured in the math string.
  // We extract the content from HTML tags and map our custom symbols back to TeX commands.
  const resolvedMath = math.replace(/\x07P(\d+)\x07/g, (_, i) => {
    const p = placeholders[Number(i)];
    
    // Typewriter/Code (using [\s\S] to handle newlines)
    const mCode = p.match(/<code>([\s\S]*?)<\/code>/);
    if (mCode) {
      const code = unescapeHtml(mCode[1])
        .replace(/≠/g, '\\ne ')
        .replace(/≤/g, '\\le ')
        .replace(/≥/g, '\\ge ')
        .replace(/←/g, '\\gets ')
        .replace(/([&%#_$])/g, '\\$1');
      return `\\texttt{${code}} `;
    }

    // Italics/Identifiers
    const mEm = p.match(/<em>([\s\S]*?)<\/em>/);
    if (mEm) {
      const it = unescapeHtml(mEm[1])
        .replace(/≠/g, '\\ne ')
        .replace(/≤/g, '\\le ')
        .replace(/≥/g, '\\ge ')
        .replace(/←/g, '\\gets ');
      return `\\textit{${it}} `;
    }

    // Bold/Reserved
    const mStrong = p.match(/<strong>([\s\S]*?)<\/strong>/);
    if (mStrong) {
      const bf = unescapeHtml(mStrong[1])
        .replace(/≠/g, '\\ne ')
        .replace(/≤/g, '\\le ')
        .replace(/≥/g, '\\ge ')
        .replace(/←/g, '\\gets ');
      return `\\textbf{${bf}} `;
    }

    return p;
  });

  try {
    return katex.renderToString(resolvedMath, {
      displayMode: display,
      throwOnError: true,
      macros: {
        "\\.": "\\texttt{#1}",
        "\\&": "\\textbf{#1}",
        "\\|": "\\textit{#1}",
        "\\\\": "\\textit{#1}",
        "\\PB": "\\text{#1}",
        "\\sq": "\\square",
        "\\hang": "",
        "\\noindent": "",
        "\\section": "\\text{\\color{#cc0000}\\textsection}",
        "\\glob": "\\text{\\color{#cc0000}glob}",
        "\\gglob": "\\text{\\color{#cc0000}glob}",
        "\\dots": "\\ldots",
        "\\to": "\\mathrel{.\\,.}",
        "\\RA": "\\rightarrow",
        "\\dleft": "\\langle",
        "\\dright": "\\rangle",
        "\\G": "\\ge",
        "\\I": "\\ne",
        "\\K": "\\gets",
        "\\L": "\\le",
        "\\R": "\\lnot",
        "\\S": "\\equiv",
        "\\V": "\\lor",
        "\\W": "\\land",
        "\\H": "\\texttt{#1}",
        "\\O": "\\text{'#1}",
        "\\J": "\\texttt{@\\&}",
        "\\pb": "\\texttt{|\\ldots|}",
        "\\v": "|",
        "\\AM": "\\&",
        "\\LB": "\\{",
        "\\RB": "\\}",
        "\\UL": "\\_",
        "\\cr": "\\\\",
        "\\null": "\\hbox{}",
        "\\empty": "",
      }
    });
  } catch (err) {
    console.warn(`KaTeX error: ${err.message} in math: ${resolvedMath}`);
    const cls = display ? 'math-fallback display' : 'math-fallback';
    // When falling back, we want to show the TeX source. 
    // We should unescape entities that were resolved from placeholders
    // to avoid double-escaping when we call escapeHtml here.
    return `<code class="${cls}">${escapeHtml(unescapeHtml(resolvedMath))}</code>`;
  }
}

/**
 * Main converter. Takes raw TeX prose (from parser.js section.tex) and
 * returns an HTML string.
 */
export function texToHtml(tex, options = {}) {
  if (!tex) return '';

  const isInline = options.inline === true;

  let s = tex;
  const placeholders = [];
  function pushPlaceholder(html) {
    const id = `\x07P${placeholders.length}\x07`;
    placeholders.push(html);
    return id;
  }

  // --- WEB control codes that appear in prose ---
  s = s.replace(/@!/g, '');
  s = s.replace(/@@/g, '@');

  // --- |...| Pascal code snippets in prose ---
  s = s.replace(/\|([^|]+)\|/g, (_, code) => {
    const escaped = escapeHtml(code);
    const withOps = replaceOperators(escaped);
    return pushPlaceholder(`<code>${withOps}</code>`);
  });

  // --- WEB font commands ---
  // Handle \. specifically because of internal redefinitions
  const handleTypewriter = (content) => {
    // Inside typewriter, some macros are redefined to be literal characters
    const map = {
      '\\': '\\',
      'BS': '\\',
      "'": "'",
      'RQ': "'",
      '`': '`',
      'LQ': '`',
      '{': '{',
      'LB': '{',
      '}': '}',
      'RB': '}',
      '~': '~',
      'TL': '~',
      ' ': ' ',
      'SP': ' ',
      '_': '_',
      'UL': '_',
      '&': '&',
      'AM': '&',
      'AT': '@',
      'v': '|',
    };
    // Handle @@ -> @ specifically inside \.
    let res = content.replace(/@@/g, '@');
    res = res.replace(/\\([a-zA-Z]+|[^a-zA-Z])/g, (match, p1) => {
      return map[p1] !== undefined ? map[p1] : match;
    });
    const escaped = escapeHtml(res);
    const withOps = replaceOperators(escaped);
    return pushPlaceholder(`<code>${withOps}</code>`);
  };

  s = s.replace(/\\\.{((?:\\.|[^{}])*)}/g, (_, t) => handleTypewriter(t));
  s = s.replace(/\\\.([a-zA-Z0-9_])/g, (_, c) => handleTypewriter(c));

  // --- Common font switches: \it{...}, {\it ...}, etc. ---
  const fontSpecs = [
    { tag: 'em', macros: ['it'] },
    { tag: 'em', cls: 'slanted', macros: ['sl', 'slanted'] },
    { tag: 'strong', macros: ['bf', 'bold'] },
    { tag: 'code', macros: ['tt', 'typewriter'] },
    { tag: 'span', cls: 'smallcaps', macros: ['sc', 'mc'] },
  ];

  for (const spec of fontSpecs) {
    const tag = spec.tag;
    const open = spec.cls ? `<${tag} class="${spec.cls}">` : `<${tag}>`;
    const close = `</${tag}>`;
    for (const m of spec.macros) {
      // \macro{...}
      s = s.replace(new RegExp(`\\\\${m}{((?:\\\\.|[^{}])*)}`, 'g'), (_, t) => pushPlaceholder(`${open}${escapeHtml(t.trim())}${close}`));
      // {\macro ...}
      s = s.replace(new RegExp(`{\\\\\\s*${m}\\s+((?:\\\\.|[^{}])*)}`, 'g'), (_, t) => pushPlaceholder(`${open}${escapeHtml(t.trim())}${close}`));
    }
  }

  // Handle \sc ... \mc or \sc ... \rm (basic best effort)
  s = s.replace(/\\sc\b(.*?)\\(?:mc|rm)\b/g, (_, t) => pushPlaceholder(`<span class="smallcaps">${escapeHtml(t.trim())}</span>`));
  s = s.replace(/\\sc\b(.*)$/g, (_, t) => pushPlaceholder(`<span class="smallcaps">${escapeHtml(t.trim())}</span>`));

  s = s.replace(/\\&{([^}]*)}/g, (_, t) => pushPlaceholder(`<strong>${escapeHtml(t)}</strong>`));
  s = s.replace(/\\&([a-zA-Z])/g, (_, c) => pushPlaceholder(`<strong>${escapeHtml(c)}</strong>`));

  // \\ and \| identifiers (italics)
  s = s.replace(/\\\\{([^}]*)}/g, (_, t) => pushPlaceholder(`<em>${escapeHtml(t)}</em>`));
  s = s.replace(/\\\|{([^}]*)}/g, (_, t) => pushPlaceholder(`<em>${escapeHtml(t)}</em>`));
  s = s.replace(/\\\|([a-zA-Z])/g, (_, c) => pushPlaceholder(`<em>${escapeHtml(c)}</em>`));

  s = s.replace(/\\={([^}]*)}/g, (_, t) => pushPlaceholder(`<span class="verbatim-box"><code>${escapeHtml(t)}</code></span>`));

  // --- Math: $$...$$ display, $...$ inline ---
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => pushPlaceholder(renderMath(m, true, placeholders)));
  s = s.replace(/\$((?:[^$\\]|\\.)+?)\$/g, (_, m) => pushPlaceholder(renderMath(m, false, placeholders)));

  // --- Escaped TeX characters ---
  s = s.replace(/\\{/g, '\x01').replace(/\\}/g, '\x02');
  s = s.replace(/\\([%#_$])/g, (_, c) => `<code>${c}</code>`);

  // --- Quotes ---
  s = s.replace(/``/g, '&ldquo;').replace(/''/g, '&rdquo;');
  s = s.replace(/`([^']*)'/g, '&lsquo;$1&rsquo;');

  // --- Dashes ---
  s = s.replace(/---/g, '&mdash;');
  s = s.replace(/--/g, '&ndash;');

  // --- WEB-specific TeX macros ---
  s = s.replace(/@<([^@>]*)@?>/g, (_, t) => `&lang;<em>${escapeHtml(t)}</em>&rang;`);
  s = s.replace(/\\\^(?!\{)/g, '^');
  s = s.replace(/\\\^\{([^}]*)\}/g, (_, t) => `<sup>${escapeHtml(t)}</sup>`);
  s = s.replace(/_\{([^}]*)\}/g, (_, t) => `<sub>${escapeHtml(t)}</sub>`);
  s = s.replace(/\\<([^>]*)>/g, (_, t) => `&lang;<em>${escapeHtml(t)}</em>&rang;`);

  // TeX-family compound logos
  s = s.replace(/\\TeXbook(?!\w)/g, '<span class="tex-logo">T<sub>e</sub>X</span>book');
  s = s.replace(/\\TeX82(?!\w)/g, '<span class="tex-logo">T<sub>e</sub>X</span>82');
  s = s.replace(/\\TeX(?!\w)/g, '<span class="tex-logo">T<sub>e</sub>X</span>');
  s = s.replace(/\\MF(?!\w)/g, '<span class="tex-logo">METAFONT</span>');
  s = s.replace(/\\WEB(?!\w)/g, '<span class="tex-logo">WEB</span>');
  s = s.replace(/\\PASCAL(?!\w)/g, '<span class="smallcaps">Pascal</span>');
  s = s.replace(/\\pct!/g, '%');
  s = s.replace(/\\ph(?!\w)/g, 'Pascal-H');

  // Common WEB/TeX macros in prose
  s = s.replace(/\\dots(?!\w)/g, '&hellip;');
  s = s.replace(/\\ldots(?!\w)/g, '&hellip;');
  s = s.replace(/\\pb(?!\w)/g, '<code>|&hellip;|</code>');
  s = s.replace(/\\v(?!\w)/g, '<code>|</code>');
  s = s.replace(/\\AM(?!\w)/g, '&amp;');
  s = s.replace(/\\LB(?!\w)/g, '{');
  s = s.replace(/\\RB(?!\w)/g, '}');
  s = s.replace(/\\UL(?!\w)/g, '_');
  s = s.replace(/\\J(?!\w)/g, '<code>@&amp;</code>');
  s = s.replace(/\\section(?!\w)/g, '&sect;');
  s = s.replace(/\\g?glob(?!\w)/g, 'glob');
  s = s.replace(/\\[AU]s?\b/g, ''); // Skip cross-ref notes like \A, \As, \U, \Us
  s = s.replace(/\\Y\b/g, isInline ? '' : '</p><p>');

  // Paragraph breaks
  if (!isInline) {
    s = s.replace(/\n[ \t]*\n+/g, '</p><p>');
  }


  // Spacing and structural macros
  s = s.replace(/\\\\(?!\w)/g, '<br>');
  s = s.replace(/\\hfill(?!\w)/g, '<span class="hfill"></span>');
  s = s.replace(/\\(small|med|big)skip(?!\w)/g, (_, sz) => `<span class="skip-${sz}"></span>`);
  s = s.replace(/\\noindent\b/g, '');
  s = s.replace(/\\yskip\b/g, '<span class="skip-small"></span>');
  s = s.replace(/\\item\{([^}]*)\}/g, (_, lbl) => `<span class="item"><span class="item-label">${lbl}</span>`);

  s = s.replace(/\\qquad(?!\w)/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
  s = s.replace(/\\quad(?!\w)/g, '&nbsp;&nbsp;');
  s = s.replace(/(?<!\\)~/g, '&nbsp;');
  s = s.replace(/\\\s/g, ' ');

  // Clean up unknown macros
  s = s.replace(/\\[a-zA-Z]+\b/g, '');

  // Stray { } from TeX grouping
  s = s.replace(/[{}]/g, '');

  // Restore escaped braces
  s = s.replace(/\x01/g, '{').replace(/\x02/g, '}');

  // Restore placeholders (multiple passes in case of nesting)
  while (s.includes('\x07P')) {
    s = s.replace(/\x07P(\d+)\x07/g, (_, i) => placeholders[Number(i)]);
  }

  // & (unencoded)
  s = s.replace(/&(?![a-zA-Z#\d]+;)/g, '&amp;');

  return isInline ? s : `<p>${s}</p>`;
}
