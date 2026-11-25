// Simple in-memory sliding-window rate limiter. Good enough for a single
// server instance; limits reset on restart.
function createRateLimiter({ windowMs, max, maxKeys = 10000 }) {
  const hits = new Map();

  function prune(now) {
    for (const [key, timestamps] of hits) {
      const fresh = timestamps.filter((time) => now - time < windowMs);
      if (fresh.length) {
        hits.set(key, fresh);
      } else {
        hits.delete(key);
      }
    }
  }

  // Returns { allowed, retryAfterSeconds }. Only counts allowed hits.
  function consume(key, now = Date.now()) {
    const normalizedKey = String(key || "unknown");
    if (hits.size > maxKeys) prune(now);

    const timestamps = (hits.get(normalizedKey) || []).filter((time) => now - time < windowMs);
    if (timestamps.length >= max) {
      const retryAfterMs = windowMs - (now - timestamps[0]);
      hits.set(normalizedKey, timestamps);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }

    timestamps.push(now);
    hits.set(normalizedKey, timestamps);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Checks the limit without counting a hit.
  function isBlocked(key, now = Date.now()) {
    const timestamps = (hits.get(String(key || "unknown")) || []).filter((time) => now - time < windowMs);
    if (timestamps.length < max) return { blocked: false, retryAfterSeconds: 0 };
    return { blocked: true, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - timestamps[0])) / 1000)) };
  }

  function reset(key) {
    hits.delete(String(key || "unknown"));
  }

  return { consume, isBlocked, reset };
}

// Client IP. Behind a reverse proxy (Railway) the socket address is the
// proxy, so use the last X-Forwarded-For entry, which the proxy itself
// appends and the client cannot forge.
function getClientIp(req, { trustProxy = false } = {}) {
  if (trustProxy) {
    const header = req.headers["x-forwarded-for"];
    const value = Array.isArray(header) ? header.join(",") : String(header || "");
    const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }

  return req.socket?.remoteAddress || "";
}

module.exports = {
  createRateLimiter,
  getClientIp
};
