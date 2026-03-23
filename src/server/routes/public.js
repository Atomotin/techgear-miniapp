function createPublicRouteHandler({
  storage,
  sendJson,
  supabaseEnabled,
  requirePersistentAdminStorage,
  telegramBotEnabled,
  telegramManagerNotificationsEnabled
}) {
  function hasCatalogFeedQuery(searchParams) {
    return [
      "search",
      "category",
      "availability",
      "sort",
      "page",
      "pageSize",
      "includeMeta",
      "ids",
      "focusProductId"
    ].some((key) => searchParams.has(key));
  }

  function getCatalogFeedOptions(searchParams) {
    return {
      search: searchParams.get("search") || "",
      category: searchParams.get("category") || "",
      availability: searchParams.get("availability") || "",
      sort: searchParams.get("sort") || "",
      page: searchParams.get("page") || "",
      pageSize: searchParams.get("pageSize") || "",
      includeMeta: searchParams.get("includeMeta") || "",
      ids: searchParams.get("ids") || "",
      focusProductId: searchParams.get("focusProductId") || ""
    };
  }

  function sendLegacyCatalogScript(res, catalog) {
    const categories = Array.isArray(catalog?.categories) ? catalog.categories : [];
    const products = Array.isArray(catalog?.products) ? catalog.products : [];
    const banners = Array.isArray(catalog?.banners) ? catalog.banners : [];
    const settings = catalog?.settings || {};
    const script = [
      "// Generated from current catalog storage. card-tovary.js is compatibility-only.",
      `window.TECHGEAR_CATEGORIES = ${JSON.stringify(categories, null, 2)};`,
      `window.TECHGEAR_PRODUCTS = ${JSON.stringify(products, null, 2)};`,
      `window.TECHGEAR_BANNERS = ${JSON.stringify(banners, null, 2)};`,
      `window.TECHGEAR_SETTINGS = ${JSON.stringify(settings, null, 2)};`
    ].join("\n\n");

    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN"
    });
    res.end(script);
  }

  return async function handlePublicRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === "/card-tovary.js") {
      sendLegacyCatalogScript(res, await storage.getCatalog());
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      const diagnostics = typeof storage.getDiagnostics === "function"
        ? await storage.getDiagnostics()
        : null;

      sendJson(res, 200, {
        ok: true,
        storage: storage.mode,
        supabaseEnabled,
        requirePersistentAdminStorage,
        telegramBotEnabled,
        telegramManagerNotificationsEnabled,
        diagnostics,
        timestamp: new Date().toISOString()
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/catalog/public") {
      if (hasCatalogFeedQuery(url.searchParams) && typeof storage.getPublicCatalog === "function") {
        sendJson(res, 200, await storage.getPublicCatalog(getCatalogFeedOptions(url.searchParams)));
      } else {
        sendJson(res, 200, await storage.getCatalog());
      }
      return true;
    }

    return false;
  };
}

module.exports = {
  createPublicRouteHandler
};
