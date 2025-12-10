const fs = require('fs');
const path = require('path');

const LIBAPP_DOCS_DIR = path.join(process.cwd(), 'docs', 'libapp');
let libAppIndexCache = null;
let libAppSignatureCache = null;

function loadFaq() {
  const file = path.join(process.cwd(), 'docs', 'help', 'topics.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9á-ž]+/).filter(Boolean);
}

function embed(text) {
  const tokens = tokenize(text);
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

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { frontmatter: {}, body: raw };
  const fmText = match[1];
  const body = raw.slice(match[0].length);
  const frontmatter = {};
  let currentKey = null;

  const parseValue = (value) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      return trimmed.slice(1, -1).split(',').map((v) => v.trim()).filter(Boolean);
    }
    return trimmed.replace(/^['"]|['"]$/g, '');
  };

  fmText.split(/\r?\n/).forEach((line) => {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = parseValue(keyMatch[2]);
      frontmatter[currentKey] = value === '' ? [] : value;
      return;
    }
    const listMatch = line.match(/^\s*-\s*(.+)$/);
    if (listMatch && currentKey && Array.isArray(frontmatter[currentKey])) {
      frontmatter[currentKey].push(listMatch[1].trim());
    }
  });

  return { frontmatter, body };
}

function splitIntoChunks(body) {
  const lines = body.split(/\r?\n/);
  const chunks = [];
  let heading = 'Obsah';
  let buffer = [];

  const pushBuffer = () => {
    if (!buffer.length) return;
    const text = buffer.join('\n').trim();
    if (!text) { buffer = []; return; }
    if (text.length > 800) {
      const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
      let current = '';
      paragraphs.forEach((p) => {
        if ((current + '\n\n' + p).trim().length > 800) {
          chunks.push({ heading, content: current.trim() });
          current = p;
        } else {
          current = current ? `${current}\n\n${p}` : p;
        }
      });
      if (current.trim()) chunks.push({ heading, content: current.trim() });
    } else {
      chunks.push({ heading, content: text });
    }
    buffer = [];
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      pushBuffer();
      heading = headingMatch[1].trim();
      return;
    }
    buffer.push(line);
  });
  pushBuffer();
  return chunks;
}

function readLibAppFiles(dir = LIBAPP_DOCS_DIR) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(readLibAppFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name.toLowerCase() !== 'readme.md') {
      const stat = fs.statSync(fullPath);
      files.push({ filePath: fullPath, mtimeMs: stat.mtimeMs });
    }
  });
  return files;
}

function buildSignature(files) {
  return files
    .map((f) => `${path.relative(process.cwd(), f.filePath)}:${f.mtimeMs}`)
    .sort()
    .join('|');
}

function parseLibAppFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const moduleId = frontmatter.id || path.basename(filePath, '.md');
  const moduleName = frontmatter.name || moduleId;
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const sections = splitIntoChunks(body);

  return sections.map(({ heading, content }) => {
    const snippet = content.length > 700 ? `${content.slice(0, 700)}…` : content;
    return {
      moduleId,
      moduleName,
      tags,
      sectionHeading: heading,
      content,
      snippet,
      filePath: path.relative(process.cwd(), filePath),
      embedding: embed(content),
    };
  });
}

function buildLibAppIndex(force = false) {
  const files = readLibAppFiles();
  const signature = buildSignature(files);

  if (!force && libAppIndexCache && libAppSignatureCache === signature) {
    return libAppIndexCache;
  }

  const chunks = files.flatMap(({ filePath }) => parseLibAppFile(filePath));
  libAppIndexCache = { chunks };
  libAppSignatureCache = signature;
  return libAppIndexCache;
}

function searchLibAppDocs(query, k = 3) {
  const { chunks } = buildLibAppIndex();
  const queryVec = embed(query);
  return chunks
    .map((chunk) => ({
      ...chunk,
      source: 'libapp',
      title: `${chunk.moduleName} – ${chunk.sectionHeading || 'Sekcia'}`,
      content: chunk.snippet,
      score: similarity(queryVec, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function searchFaq(query, k = 2) {
  const docs = loadFaq();
  const queryVec = embed(query);
  return docs
    .map((d) => ({
      ...d,
      source: 'faq',
      title: d.title || d.id,
      content: d.content || '',
      score: similarity(queryVec, embed(d.content || '')),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function searchContext(query, k = 2) {
  const faqResults = searchFaq(query, k);
  const libAppResults = searchLibAppDocs(query, Math.max(3, k));
  return [...faqResults, ...libAppResults].sort((a, b) => b.score - a.score);
}

module.exports = { searchContext, loadFaq, searchLibAppDocs, buildLibAppIndex };
