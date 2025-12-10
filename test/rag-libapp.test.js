const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');
const { buildLibAppIndex, searchLibAppDocs } = require('../api/lib/rag');

test('LibApp docs are loaded and parsed', () => {
  const { chunks } = buildLibAppIndex();
  const moduleIds = new Set(chunks.map((c) => c.moduleId));
  assert.ok(moduleIds.has('obchodny-rozhovor'));
  assert.ok(moduleIds.has('individualny-rozhovor'));
  assert.ok(chunks.some((c) => c.sectionHeading && c.content));
});

test('Search returns obchodny rozhovor snippets for relevant query', () => {
  const results = searchLibAppDocs('obchodný rozhovor námietka ceny', 3);
  assert.ok(results.length > 0);
  assert.ok(results.some((r) => r.moduleId === 'obchodny-rozhovor'));
});

test('New module file is indexed without code changes', () => {
  const tempFile = path.join(process.cwd(), 'docs', 'libapp', 'docasny-modul.md');
  const tempContent = `---
id: docasny-modul
name: Dočasný modul
tags:
  - test
updated: 2024-07-02
---
# Účel modulu
Dočasný modul na test vyhľadávania.

## Kedy použiť
Keď chceme overiť, že nové súbory sú automaticky načítané.

## Postup / kroky
1. Vlož dotaz obsahujúci slovo dočasný.

## Príklady dialógu
- "Toto je dočasný modul." 

## Tipy a časté chyby
- Nezabudni tento súbor po teste vymazať.

## Poznámky pre Libo
- Ak je v dotaze slovo dočasný, mala by sa použiť táto sekcia.
`;

  try {
    fs.writeFileSync(tempFile, tempContent);
    const results = searchLibAppDocs('potrebujem dočasný modul', 5);
    assert.ok(results.some((r) => r.moduleId === 'docasny-modul'));
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
});
