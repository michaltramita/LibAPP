# LibApp moduly – dokumentačný formát

Tento priečinok obsahuje samostatné Markdown súbory pre každý modul LibApp. Každý nový modul pridaj ako nový `.md` súbor – **nie je potrebné meniť kód**, stačí dodržať formát nižšie. Súbory sa automaticky načítajú cez RAG vrstvu a Libo z nich získa relevantný kontext.

## Názov súboru
- Použi krátky strojový názov s pomlčkami, napr. `obchodny-rozhovor.md`.
- README je ignorované pri indexovaní.

## Povinná štruktúra súboru
1. **YAML frontmatter** (ohraničené `---`), napr.:
   ```yaml
   ---
   id: obchodny-rozhovor
   name: Obchodný rozhovor
   tags:
     - obchod
     - predaj
   updated: 2024-07-01
   ---
   ```
   - `id`: strojový identifikátor (použi rovnaký ako v názve súboru).
   - `name`: ľudský názov modulu.
   - `tags`: krátke kľúčové slová.
   - `updated`: dátum v ISO formáte.

2. **Obsahové sekcie** (presné nadpisy):
   - `# Účel modulu`
   - `## Kedy použiť`
   - `## Postup / kroky`
   - `## Príklady dialógu`
   - `## Tipy a časté chyby`
   - `## Poznámky pre Libo`

3. Každú sekciu vyplň konkrétnymi bodmi a príkladmi, aby sa dali vytvárať zmysluplné úryvky.

## Ako pridať nový modul
1. Vytvor nový súbor podľa vzoru: `docs/libapp/<id>.md`.
2. Vyplň frontmatter a všetky sekcie.
3. Ulož súbor – ďalšie spustenie Libo alebo testov automaticky načíta nový modul, nie je potrebné meniť kód.

## Ukážka
Pozri príklady `obchodny-rozhovor.md` a `individualny-rozhovor.md` v tomto priečinku.
