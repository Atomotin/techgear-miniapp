const crypto = require("crypto");
const { createRateLimiter } = require("./rate-limit");

// Values copied from .env.example or other obvious defaults. Admin login is
// refused with these, because they are public.
const KNOWN_DEFAULT_SECRETS = new Set([
  "change-me",
  "change-me-too",
  "changeme",
  "admin",
  "password",
  "123456",
  "12345678",
  "qwerty"
]);
const MIN_RECOMMENDED_PASSWORD_LENGTH = 12;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

function safeEqualStrings(left, right) {
  // Hash first so both buffers have the same length and the comparison
  // time does not depend on where the strings differ.
  return crypto.timingSafeEqual(sha256(left), sha256(right));
}

function createAdminAuth({
  password = "",
  secret = "",
  tokenTtlMs = 1000 * 60 * 60 * 12,
  loginWindowMs = 15 * 60 * 1000,
  maxFailedLoginsPerWindow = 5,
  logger = console
} = {}) {
  const normalizedPassword = String(password || "").trim();
  const normalizedSecret = String(secret || "").trim();
  const warnings = [];
  let disabledReason = "";

  if (!normalizedPassword) {
    disabledReason = "ADMIN_PASSWORD is not set";
  } else if (KNOWN_DEFAULT_SECRETS.has(normalizedPassword.toLowerCase())) {
    disabledReason = "ADMIN_PASSWORD is a known default value (for example from .env.example)";
  } else if (normalizedPassword.length < MIN_RECOMMENDED_PASSWORD_LENGTH) {
    warnings.push(`ADMIN_PASSWORD is shorter than ${MIN_RECOMMENDED_PASSWORD_LENGTH} characters; use a longer one`);
  }

  // The signing key must not be derived from the password: then one leaked
  // token would let an attacker brute-force the password offline. Without a
  // proper ADMIN_SECRET we use a random key, so tokens reset on restart.
  let signingKey;
  if (normalizedSecret && !KNOWN_DEFAULT_SECRETS.has(normalizedSecret.toLowerCase()) && normalizedSecret !== normalizedPassword) {
    signingKey = sha256(`techgear-admin-token:${normalizedSecret}`);
  } else {
    signingKey = crypto.randomBytes(32);
    if (normalizedPassword) {
      warnings.push("ADMIN_SECRET is missing, a default value or equal to ADMIN_PASSWORD; using a random key, so admins must log in again after every restart");
    }
  }

  const enabled = !disabledReason;
  const failedLogins = createRateLimiter({ windowMs: loginWindowMs, max: maxFailedLoginsPerWindow });
  const revokedTokens = new Map(); // jti -> exp

  function sign(payload) {
    return crypto.createHmac("sha256", signingKey).update(payload).digest("base64url");
  }

  function pruneRevoked(now = Date.now()) {
    for (const [jti, exp] of revokedTokens) {
      if (exp <= now) revokedTokens.delete(jti);
    }
  }

  function createToken() {
    const payload = Buffer.from(JSON.stringify({
      role: "admin",
      jti: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + tokenTtlMs
    })).toString("base64url");

    return `${payload}.${sign(payload)}`;
  }

  function decodeToken(token) {
    if (!enabled || !token || typeof token !== "string") return null;

    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

    const [payload, signature] = parts;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (decoded.role !== "admin" || !(Number(decoded.exp) > Date.now())) return null;
      if (decoded.jti && revokedTokens.has(decoded.jti)) return null;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  function verifyToken(token) {
    return Boolean(decodeToken(token));
  }

  // Revocation is kept in memory: it lasts until the token expires or the
  // server restarts.
  function revokeToken(token) {
    const decoded = decodeToken(token);
    if (!decoded?.jti) return false;
    pruneRevoked();
    revokedTokens.set(decoded.jti, Number(decoded.exp));
    return true;
  }

  // Returns { ok, status, error, retryAfterSeconds }.
  function attemptLogin(candidate, clientKey) {
    if (!enabled) {
      return { ok: false, status: 503, error: "admin_disabled" };
    }

    const key = `login:${clientKey || "unknown"}`;
    const isCorrect = safeEqualStrings(String(candidate || "").trim(), normalizedPassword);

    if (isCorrect) {
      const blocked = failedLogins.isBlocked(key);
      if (blocked.blocked) {
        return { ok: false, status: 429, error: "too_many_attempts", retryAfterSeconds: blocked.retryAfterSeconds };
      }
      failedLogins.reset(key);
      return { ok: true, status: 200, token: createToken() };
    }

    const result = failedLogins.consume(key);
    if (!result.allowed) {
      return { ok: false, status: 429, error: "too_many_attempts", retryAfterSeconds: result.retryAfterSeconds };
    }
    return { ok: false, status: 401, error: "wrong_password" };
  }

  function logStartupWarnings() {
    if (!enabled) {
      logger.warn(`Admin login is disabled: ${disabledReason}. Set a strong ADMIN_PASSWORD to enable /admin.`);
    }
    warnings.forEach((warning) => logger.warn(`Admin auth: ${warning}`));
  }

  return {
    enabled,
    disabledReason,
    createToken,
    verifyToken,
    revokeToken,
    attemptLogin,
    logStartupWarnings
  };
}

module.exports = {
  createAdminAuth,
  KNOWN_DEFAULT_SECRETS
};
