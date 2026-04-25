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

/**
 * Render a math string with KaTeX, returning HTML.
 * Falls back to the raw source in a <code> if KaTeX throws.
 */
function renderMath(math, display) {
  try {
    return katex.renderToString(math, { displayMode: display, throwOnError: false });
  } catch {
    return `<code class="math-fallback">${escapeHtml(math)}</code>`;
  }
}

/**
 * Main converter. Takes raw TeX prose (from parser.js section.tex) and
 * returns an HTML string.
 */
export function texToHtml(tex) {
  if (!tex) return '';

  let s = tex;

  // --- WEB font commands: process BEFORE math so they don't confuse KaTeX ---
  // \.{text} → <code>text</code>  (typewriter / identifier)
  s = s.replace(/\\\.{([^}]*)}/g, (_, t) => `<code>${escapeHtml(t)}</code>`);
  // \&{text} → <strong>text</strong>
  s = s.replace(/\\&{([^}]*)}/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`);
  // \|{text} → <em>text</em>
  s = s.replace(/\\\|{([^}]*)}/g, (_, t) => `<em>${escapeHtml(t)}</em>`);
  // {\tt text}, {\it text}, {\bf text}, {\sl text}
  s = s.replace(/\{\\tt\s+([^}]*)\}/g, (_, t) => `<code>${escapeHtml(t)}</code>`);
  s = s.replace(/\{\\it\s+([^}]*)\}/g, (_, t) => `<em>${escapeHtml(t)}</em>`);
  s = s.replace(/\{\\bf\s+([^}]*)\}/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`);
  s = s.replace(/\{\\sl\s+([^}]*)\}/g, (_, t) => `<em class="slanted">${escapeHtml(t)}</em>`);

  // --- Math: $$...$$ display, $...$ inline ---
  // Process display math first (longer delimiter)
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => renderMath(m, true));
  s = s.replace(/\$((?:[^$\\]|\\.)+?)\$/g, (_, m) => renderMath(m, false));

  // --- WEB-specific TeX macros (font commands already handled above) ---

  // \^{x} → superscript
  s = s.replace(/\\\^{([^}]*)}/g, (_, t) => `<sup>${escapeHtml(t)}</sup>`);

  // _{x} → subscript (bare form)
  s = s.replace(/_{([^}]*)}/g, (_, t) => `<sub>${escapeHtml(t)}</sub>`);

  // \TeX → TeX logo
  s = s.replace(/\\TeX\b/g, '<span class="tex-logo">T<sub>e</sub>X</span>');

  // \MF → METAFONT logo
  s = s.replace(/\\MF\b/g, '<span class="tex-logo">METAFONT</span>');

  // \WEB → WEB logo
  s = s.replace(/\\WEB\b/g, '<span class="tex-logo">WEB</span>');

  // Paragraph breaks
  s = s.replace(/\n{2,}/g, '</p><p>');

  // \\ → <br>
  s = s.replace(/\\\\/g, '<br>');

  // \hfill → flex spacer
  s = s.replace(/\\hfill\b/g, '<span class="hfill"></span>');

  // \smallskip \medskip \bigskip → spacing divs
  s = s.replace(/\\(small|med|big)skip\b/g, (_, sz) => `<div class="skip-${sz}"></div>`);

  // \noindent
  s = s.replace(/\\noindent\b\s*/g, '');

  // \quad \qquad → non-breaking spaces
  s = s.replace(/\\qquad\b/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
  s = s.replace(/\\quad\b/g, '&nbsp;&nbsp;');

  // ~ → non-breaking space
  s = s.replace(/(?<!\\)~/g, '&nbsp;');

  // Remaining unknown macros: wrap in span so they're visible
  s = s.replace(/\\[a-zA-Z]+\b/g, m => `<span class="tex-unknown">${escapeHtml(m)}</span>`);

  // Escape remaining HTML-unsafe characters (outside of spans we already built)
  // We can't do a simple escapeHtml here since we've already inserted HTML.
  // Instead we replace stray < > & that aren't part of tags.
  // This is a best-effort approach for the TeX source's non-math content.
  s = s.replace(/&(?![a-zA-Z#\d]+;)/g, '&amp;');

  return `<p>${s}</p>`;
}
