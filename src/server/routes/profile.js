function createProfileRouteHandler({
  storage,
  sendJson,
  readBody,
  sanitizeCustomerProfile,
  validateCustomerProfile,
  getVerifiedTelegramUser,
  rateLimiters = {}
}) {
  // Profiles are only reachable through a verified Telegram identity.
  // Lookups by phone, username or a client-supplied telegramId are not allowed,
  // otherwise anyone could read or overwrite another customer's data.
  function requireTelegramUser(req, res) {
    const telegramUser = typeof getVerifiedTelegramUser === "function" ? getVerifiedTelegramUser(req) : null;
    if (!telegramUser) {
      sendJson(res, 401, { error: "Профиль доступен только внутри Telegram" });
      return null;
    }
    return telegramUser;
  }

  return async function handleProfileRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/profile") {
      const telegramUser = requireTelegramUser(req, res);
      if (!telegramUser) return true;

      const customers = await storage.getCustomers();
      const { key } = sanitizeCustomerProfile({ telegramId: telegramUser.id });
      const customer = customers.find((item) => item.key === key) || null;
      sendJson(res, 200, { ok: true, customer });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/profile") {
      const telegramUser = requireTelegramUser(req, res);
      if (!telegramUser) return true;

      const limit = rateLimiters.profileWrites?.consume(`tg:${telegramUser.id}`);
      if (limit && !limit.allowed) {
        res.setHeader("Retry-After", String(limit.retryAfterSeconds));
        sendJson(res, 429, { error: "Слишком много сохранений. Попробуйте позже." });
        return true;
      }

      const body = await readBody(req, { maxSize: 16 * 1024 });
      const profilePayload = {
        ...(body && typeof body === "object" ? body : {}),
        telegramId: telegramUser.id,
        telegram: undefined
      };
      const error = validateCustomerProfile(profilePayload);

      if (error) {
        sendJson(res, 400, { error });
        return true;
      }

      const customer = await storage.upsertCustomerProfile(profilePayload);
      sendJson(res, 200, { ok: true, customer });
      return true;
    }

    return false;
  };
}

module.exports = {
  createProfileRouteHandler
};
