const buckets = new Map();

function rateLimit({ key, limit = 30, windowMs = 60_000 }) {
  const now = Date.now();
  const current = buckets.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  entry.count += 1;
  buckets.set(key, entry);

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

module.exports = { rateLimit };
