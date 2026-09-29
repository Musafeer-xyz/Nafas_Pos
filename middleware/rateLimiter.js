/**
 * Minimal fixed-window in-memory rate limiter — no new dependencies.
 * Good enough for a single-node deployment (Render free tier). If the app
 * ever scales horizontally, swap for a shared store (e.g. Redis).
 */
const buckets = new Map(); // key → { count, resetAt }

function rateLimit({ windowMs = 60_000, max = 10, keyGenerator, message }) {
  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    // Opportunistic cleanup so the map doesn't grow forever
    if (buckets.size > 1000) {
      for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
    }

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ message: message || `Too many attempts — try again in ${retryAfter}s` });
    }
    next();
  };
}

module.exports = { rateLimit };
