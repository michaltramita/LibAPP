const fs = require('fs');
const path = require('path');

function loadFaq() {
  const file = path.join(process.cwd(), 'docs', 'help', 'topics.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function embed(text) {
  const tokens = text.toLowerCase().split(/[^a-z0-9á-ž]+/).filter(Boolean);
  const counts = new Map();
  tokens.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
  return counts;
}

function similarity(a, b) {
  let dot = 0; let normA = 0; let normB = 0;
  for (const [, value] of a) normA += value * value;
  for (const [, value] of b) normB += value * value;
  for (const [key, value] of a) if (b.has(key)) dot += value * b.get(key);
  return dot / (Math.sqrt(normA || 1) * Math.sqrt(normB || 1));
}

function searchContext(query, k = 2) {
  const docs = loadFaq();
  const queryVec = embed(query);
  const scored = docs.map((d) => ({ ...d, score: similarity(queryVec, embed(d.content || '')) }));
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

module.exports = { searchContext, loadFaq };
