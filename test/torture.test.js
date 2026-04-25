import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texToHtml } from '../src/tex-to-html.js';

test('TeX Torture: Font Commands', () => {
  const input = `
    Normal text.
    {\\tt typewriter}
    {\\it italic}
    {\\bf bold}
    {\\sl slanted}
    \\sc small caps\\mc
    \\.{typewriter macro}
    \\\\{italic macro}
    \\|{identifier}
    \\&{reserved}
    \\={verbatim}
  `;
  const out = texToHtml(input);
  assert.match(out, /<code>typewriter<\/code>/);
  assert.match(out, /<em>italic<\/em>/);
  assert.match(out, /<strong>bold<\/strong>/);
  assert.match(out, /<em class="slanted">slanted<\/em>/);
  assert.match(out, /<span class="smallcaps">small caps<\/span>/);
  assert.match(out, /<code>typewriter macro<\/code>/);
  assert.match(out, /<em>italic macro<\/em>/);
  assert.match(out, /<em>identifier<\/em>/);
  assert.match(out, /<strong>reserved<\/strong>/);
  assert.match(out, /<span class="verbatim-box"><code>verbatim<\/code><\/span>/);
});

test('TeX Torture: Typewriter Special Characters', () => {
  const input = String.raw`
    \.{\\ \' \` \{ \} \~ \  \_ \&}
    \.{ \BS \RQ \LQ \LB \RB \TL \SP \UL \AM \AT }
  `;
  const out = texToHtml(input);
  // All these should be rendered as their literal counterparts inside <code>
  assert.match(out, /<code>\\ ' ` { } ~   _ &amp;<\/code>/);
  assert.match(out, /<code> \\ ' ` { } ~   _ &amp; @ <\/code>/);
});

test('TeX Torture: Math Symbols', () => {
  // Weave/webmac macros used in math mode
  const input = `
    $a \\to b$
    $x \\G y$
    $p \\I q$
    $v \\K 0$
    $i \\L n$
    $\\R p$
    $A \\S B$
    $x \\V y$
    $a \\W b$
    $\\H{FF}$
    $\\O{77}$
    $x \\dots y$
    $x \\ldots y$
  `;
  const out = texToHtml(input);
  // These should be handled by KaTeX. We check if they don't crash and produce KaTeX output.
  assert.match(out, /katex-display|katex/);
});

test('TeX Torture: Logos and Compounds', () => {
  const input = `
    \\TeX, \\TeXbook, \\TeX82, \\MF, \\WEB, \\PASCAL, \\ph, \\pct!
  `;
  const out = texToHtml(input);
  assert.match(out, /<span class="tex-logo">T<sub>e<\/sub>X<\/span>/);
  assert.match(out, /<span class="tex-logo">T<sub>e<\/sub>X<\/span>book/);
  assert.match(out, /<span class="tex-logo">T<sub>e<\/sub>X<\/span>82/);
  assert.match(out, /METAFONT/);
  assert.match(out, /WEB/);
  assert.match(out, /<span class="smallcaps">Pascal<\/span>/);
  assert.match(out, /Pascal-H/);
  assert.match(out, /%/);
});

test('TeX Torture: Structural and Spacing', () => {
  const input = `
    \\section Section marker
    \\noindent No indent.
    \\item{1} First item.
    \\hfill horizontal fill
    \\smallskip small
    \\medskip med
    \\bigskip big
    \\yskip yskip
    \\qquad double quad
    \\quad quad
    ~ non-breaking space
    \\  forced space
    \\Y Forced paragraph
  `;
  const out = texToHtml(input);
  assert.match(out, /&sect;/);
  assert.match(out, /<span class="item"><span class="item-label">1<\/span>/);
  assert.match(out, /<span class="hfill"><\/span>/);
  assert.match(out, /<span class="skip-small"><\/span>/);
  assert.match(out, /<span class="skip-med"><\/span>/);
  assert.match(out, /<span class="skip-big"><\/span>/);
  assert.match(out, /&nbsp;&nbsp;&nbsp;&nbsp;/);
  assert.match(out, /&nbsp;&nbsp;/);
  assert.match(out, /&nbsp;/);
  assert.match(out, /<\/p><p>/); // From \Y
});


test('TeX Torture: Escaped Characters', () => {
  const input = `\\% \\$ \\# \\_ \\&`;
  const out = texToHtml(input);
  assert.match(out, /<code>%<\/code>/);
  assert.match(out, /<code>\$<\/code>/);
  assert.match(out, /<code>#<\/code>/);
  assert.match(out, /<code>_<\/code>/);
  assert.match(out, /&amp;/);
});

test('TeX Torture: Nesting and Interaction', () => {
  const input = `
    |code_snippet| inside prose.
    \\it{italic with |code| inside}
    $math with \\bf{bold} and \\.{typewriter}$
    @<Chunk Name@> in prose.
    \\bf{bold with \\it{italic} nested}
  `;
  const out = texToHtml(input);
  assert.match(out, /<code>code_snippet<\/code>/);
  assert.match(out, /<em>italic with <code>code<\/code> inside<\/em>/);
  assert.match(out, /<strong>bold with <em>italic<\/em> nested<\/strong>/);
  assert.match(out, /&lang;<em>Chunk Name<\/em>&rang;/);
});

test('TeX Torture: Edge Cases', () => {
  const inputs = [
    '',                       // empty
    '\\\\',                   // stray double backslash
    '\\it{}',                 // empty argument
    '\\unknownMacro',         // unknown
    '   \\n   ',              // whitespace
    'Multiple\\n\\nParagraphs', // paragraphs
    '\\dots\\dots\\dots',     // sequences
    '\\.{unclosed',           // unclosed brace
    '$unclosed math',         // unclosed math
  ];
  for (const i of inputs) {
    assert.doesNotThrow(() => texToHtml(i));
  }
});
