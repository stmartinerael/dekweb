import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';

test('Index Torture: Identifiers in TeX prose |...|', () => {
  const src = '@ This is |my_identifier| and another |id2|.';
  const { indexMap } = parse(src);
  assert.ok(indexMap.has('my_identifier'), 'Identifier in |...| should be indexed');
  assert.ok(indexMap.has('id2'), 'Another identifier in |...| should be indexed');
});

test('Index Torture: Case sensitivity (best effort)', () => {
  // Pascal is case-insensitive, but WEB usually preserves case for indexing
  // while grouping them.
  const src = '@ |MyId| and |myid| and |MYID| @p MyId := myid;';
  const { indexMap } = parse(src);
  // Our current implementation stores them as they appear (with keywords excluded in lowercase)
  // Let's see what it does.
  assert.ok(indexMap.has('MyId'));
  assert.ok(indexMap.has('myid'));
});

test('Index Torture: Manual entries with special chars', () => {
  const src = '@* Manual. @^system dependencies@> and @.typewriter_id@> and @:sort key}{entry@>.';
  const { indexMap } = parse(src);
  assert.ok(indexMap.has('system dependencies'));
  assert.ok(indexMap.has('typewriter_id'));
  assert.ok(indexMap.has('sort key}{entry'));
});

test('Index Torture: Multi-part entries and force-index', () => {
  // @! before an identifier or macro
  const src = '@ @p @!my_global := 1; @!@^forced manual@>';
  const { indexMap } = parse(src);
  assert.ok(indexMap.has('my_global'));
  assert.ok(indexMap.has('forced manual'));
});

test('Index Torture: Keywords should NOT be indexed', () => {
  const src = '@ |begin| and |end| in prose. @p for i := 1 to 10 do begin end;';
  const { indexMap } = parse(src);
  assert.ok(!indexMap.has('begin'));
  assert.ok(!indexMap.has('for'));
  assert.ok(!indexMap.has('to'));
});

test('Index Torture: Short identifiers', () => {
  // Current logic: id.length > 2
  const src = '@ |a| and |bc| and |def|. @p x := y + zzz;';
  const { indexMap } = parse(src);
  assert.ok(!indexMap.has('a'));
  assert.ok(!indexMap.has('bc'));
  assert.ok(indexMap.has('def'));
  assert.ok(indexMap.has('zzz'));
});

test('Index Torture: Macro names and chunk names', () => {
  const src = '@ @d my_macro(#) == #+1\n@<My named chunk@>=\nbegin end.';
  const { indexMap } = parse(src);
  assert.ok(indexMap.has('my_macro'));
  assert.ok(indexMap.has('My named chunk'));
});
