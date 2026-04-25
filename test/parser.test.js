import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sec(src) {
  return parse(src).sections;
}

function xref(src) {
  const { chunkDefs, chunkRefs } = parse(src);
  return { chunkDefs, chunkRefs };
}

// ── Section delimiters ────────────────────────────────────────────────────────

test('single unnamed section', () => {
  const s = sec('@ This is the prose.');
  assert.equal(s.length, 1);
  assert.equal(s[0].starred, false);
  assert.equal(s[0].number, 1);
  assert.match(s[0].tex, /This is the prose/);
});

test('single starred section with title', () => {
  const s = sec('@* Introduction. Some text here.');
  assert.equal(s.length, 1);
  assert.equal(s[0].starred, true);
  assert.equal(s[0].title, 'Introduction');
  assert.match(s[0].tex, /Some text here/);
});

test('starred section title stops at first period', () => {
  const s = sec('@* Knuth, D.E. said so. The rest.');
  assert.equal(s[0].title, 'Knuth, D.E. said so');
  assert.match(s[0].tex, /The rest/);
});

test('multiple sections in sequence', () => {
  const s = sec('@ First.\n@ Second.\n@ Third.');
  assert.equal(s.length, 3);
  assert.equal(s[0].number, 1);
  assert.equal(s[1].number, 2);
  assert.equal(s[2].number, 3);
});

test('mix of unnamed and starred sections', () => {
  const s = sec('@ Intro.\n@* Major. Title body.\n@ After.');
  assert.equal(s.length, 3);
  assert.equal(s[0].starred, false);
  assert.equal(s[1].starred, true);
  assert.equal(s[2].starred, false);
});

test('empty TeX part — section with code only', () => {
  const s = sec('@ @p begin end.');
  assert.equal(s[0].tex, '');
  assert.match(s[0].code, /begin end/);
});

test('empty code part — section with docs only', () => {
  const s = sec('@ Just documentation, no code.');
  assert.equal(s[0].code, '');
  assert.match(s[0].tex, /Just documentation/);
});

test('preamble before first section is discarded', () => {
  const s = sec('\\def\\foo{bar}\n\\font\\tt=cmtt10\n@ Real section.');
  assert.equal(s.length, 1);
  assert.match(s[0].tex, /Real section/);
});

test('empty file produces no sections', () => {
  assert.equal(sec('').length, 0);
});

test('file with only preamble produces no sections', () => {
  assert.equal(sec('\\def\\foo{bar}\n\\title{WEB}').length, 0);
});

// ── Control codes ─────────────────────────────────────────────────────────────

test('@d simple macro definition', () => {
  const s = sec('@ Prose.\n@d limit==100');
  assert.equal(s[0].defs.length, 1);
  assert.equal(s[0].defs[0].kind, 'd');
  assert.equal(s[0].defs[0].name, 'limit');
  assert.match(s[0].defs[0].value, /100/);
});

test('@d macro with multi-line value', () => {
  const s = sec('@ Prose.\n@d long_macro==\n  first_part+\n  second_part');
  assert.equal(s[0].defs[0].name, 'long_macro');
  assert.match(s[0].defs[0].value, /first_part/);
  assert.match(s[0].defs[0].value, /second_part/);
});

test('@f format directive', () => {
  const s = sec('@ Prose.\n@f integer==int');
  assert.equal(s[0].defs.length, 1);
  assert.equal(s[0].defs[0].kind, 'f');
  assert.equal(s[0].defs[0].name, 'integer');
});

test('multiple @d and @f before @p', () => {
  const s = sec('@ Prose.\n@d a==1\n@d b==2\n@f c==char\n@p begin end.');
  assert.equal(s[0].defs.length, 3);
  assert.equal(s[0].defs[0].name, 'a');
  assert.equal(s[0].defs[1].name, 'b');
  assert.equal(s[0].defs[2].kind, 'f');
  assert.match(s[0].code, /begin end/);
});

test('@p introduces Pascal code block', () => {
  const s = sec('@ Prose.\n@p program hello; begin writeln end.');
  assert.match(s[0].code, /program hello/);
  assert.match(s[0].code, /writeln/);
});

test('@<Name@>= defines a named chunk', () => {
  const s = sec('@ Prose.\n@<Initialize variables@>=\nx := 0; y := 0;');
  assert.equal(s[0].chunkName, 'Initialize variables');
  assert.match(s[0].code, /x := 0/);
});

test('@<Name@> inline chunk reference in code', () => {
  const s = sec('@ Prose.\n@p @<Initialize variables@>;\n@<Main loop@>;');
  assert.ok(s[0].refs.includes('Initialize variables'));
  assert.ok(s[0].refs.includes('Main loop'));
});

test('@@ becomes literal @ in code (preserved in raw)', () => {
  // Parser keeps @@ in raw code; build step strips it to @
  const s = sec('@ Prose.\n@p write(@@);');
  assert.match(s[0].code, /@@/);
});

test('@! identifier preserved in code', () => {
  const s = sec('@ Prose.\n@p @!debug := true;');
  assert.match(s[0].code, /@!debug/);
});

test('line-break hints (@/ @| @# @+ @;) present in raw code', () => {
  const s = sec('@ Prose.\n@p a :=@/1;@|b :=@#2;');
  assert.match(s[0].code, /@\//);
});

test('@=verbatim@> span in code', () => {
  const s = sec('@ Prose.\n@p x := @=raw verbatim@>;');
  assert.match(s[0].code, /@=raw verbatim@>/);
});

test("@'x' character constant in code", () => {
  const s = sec("@ Prose.\n@p ch := @'A';");
  assert.match(s[0].code, /@'A'/);
});

test('@"hex constant in code', () => {
  const s = sec('@ Prose.\n@p x := @"FF;');
  assert.match(s[0].code, /@"FF/);
});

test('@<Name@> inside code that also has @d', () => {
  const s = sec('@ Prose.\n@d foo==1\n@p @<Setup@>; x := foo;');
  assert.equal(s[0].defs.length, 1);
  assert.ok(s[0].refs.includes('Setup'));
});

// ── Cross-references ──────────────────────────────────────────────────────────

test('chunk reference map built across sections', () => {
  const src = [
    '@ Define it.\n@<Buffer@>=\nbuf := nil;',
    '@ Use it.\n@p @<Buffer@>;',
  ].join('\n');
  const { chunkDefs, chunkRefs } = xref(src);
  assert.ok(chunkDefs.has('Buffer'));
  assert.ok(chunkRefs.has('Buffer'));
  assert.equal(chunkDefs.get('Buffer').length, 1);
  assert.equal(chunkRefs.get('Buffer').length, 1);
});

test('single chunk defined in one section, referenced in two', () => {
  const src = [
    '@ Define.\n@<Init@>=\nx:=0;',
    '@ Use A.\n@p @<Init@>;',
    '@ Use B.\n@p @<Init@>;',
  ].join('\n');
  const { chunkDefs, chunkRefs } = xref(src);
  assert.equal(chunkDefs.get('Init').length, 1);
  assert.equal(chunkRefs.get('Init').length, 2);
});

test('chunk defined in multiple sections (continuation)', () => {
  const src = [
    '@ Part 1.\n@<Globals@>=\na: integer;',
    '@ Part 2.\n@<Globals@>=\nb: integer;',
  ].join('\n');
  const { chunkDefs } = xref(src);
  assert.equal(chunkDefs.get('Globals').length, 2);
});

test('refs list contains unique names only', () => {
  const s = sec('@ Prose.\n@p @<Foo@>; @<Foo@>; @<Bar@>;');
  assert.equal(s[0].refs.filter(r => r === 'Foo').length, 1);
  assert.ok(s[0].refs.includes('Bar'));
});

// ── Edge cases ────────────────────────────────────────────────────────────────

test('section with only @d, no TeX text and no @p', () => {
  const s = sec('@ @d max_n==1000');
  assert.equal(s[0].tex, '');
  assert.equal(s[0].defs.length, 1);
  assert.equal(s[0].code, '');
});

test('@<..@> inside TeX prose is not treated as chunk definition', () => {
  // A @<Name@> in the TeX part without a following = is a reference, not def
  const s = sec('@ See @<Algorithm@> for details.');
  assert.equal(s[0].chunkName, null);
});

test('double-starred section @** treated like starred @*', () => {
  const s = sec('@** Big Title. Some text.');
  assert.equal(s[0].starred, true);
  assert.equal(s[0].title, 'Big Title');
});
