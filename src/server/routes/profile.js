function createProfileRouteHandler({
  storage,
  sendJson,
  readBody,
  normalizeString,
  sanitizeCustomerProfile,
  validateCustomerProfile
}) {
  return async function handleProfileRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/profile") {
      const customers = await storage.getCustomers();
      const lookupProfile = sanitizeCustomerProfile({
        telegramId: normalizeString(url.searchParams.get("telegramId")),
        phone: normalizeString(url.searchParams.get("phone")),
        username: normalizeString(url.searchParams.get("username")),
        name: normalizeString(url.searchParams.get("name")),
        delivery: normalizeString(url.searchParams.get("delivery"))
      });
      const customer = customers.find((item) => item.key === lookupProfile.key) || null;
      sendJson(res, 200, { ok: true, customer });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/profile") {
      const body = await readBody(req);
      const error = validateCustomerProfile(body);

      if (error) {
        sendJson(res, 400, { error });
        return true;
      }

      const customer = await storage.upsertCustomerProfile(body);
      sendJson(res, 200, { ok: true, customer });
      return true;
    }

    return false;
  };
}

module.exports = {
  createProfileRouteHandler
};
