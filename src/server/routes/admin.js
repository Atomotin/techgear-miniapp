function createAdminRouteHandler({
  storage,
  sendJson,
  readBody,
  normalizeString,
  adminPassword,
  createToken,
  ensureAdmin,
  saveAdminUpload
}) {
  return async function handleAdminRoute(req, res, url) {
    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const body = await readBody(req);

      if (normalizeString(body.password) !== adminPassword) {
        sendJson(res, 401, { error: "Р СњР ВµР Р†Р ВµРЎР‚Р Р…РЎвЂ№Р в„– Р С—Р В°РЎР‚Р С•Р В»РЎРЉ" });
        return true;
      }

      sendJson(res, 200, { token: createToken() });
      return true;
    }

    if (!url.pathname.startsWith("/api/admin/")) {
      return false;
    }

    if (!ensureAdmin(req, res)) {
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/catalog") {
      sendJson(res, 200, await storage.getCatalog());
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/orders") {
      sendJson(res, 200, { orders: await storage.getOrders() });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/customers") {
      sendJson(res, 200, { customers: await storage.getCustomers() });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/banners") {
      sendJson(res, 200, { banners: await storage.getBanners() });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/uploads") {
      sendJson(res, 201, await saveAdminUpload(req, url));
      return true;
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/orders/")) {
      const orderId = Number(url.pathname.split("/").pop());
      const body = await readBody(req);
      const nextStatus = normalizeString(body.status);
      const allowedStatuses = ["new", "processing", "done", "cancelled"];

      if (!allowedStatuses.includes(nextStatus)) {
        sendJson(res, 400, { error: "Р СњР ВµР С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…РЎвЂ№Р в„– РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ" });
        return true;
      }

      const order = await storage.updateOrderStatus(orderId, nextStatus);
      sendJson(res, 200, { ok: true, order });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/categories") {
      const body = await readBody(req);
      const category = {
        key: normalizeString(body.key),
        label: normalizeString(body.label)
      };

      if (!category.key || !category.label) {
        sendJson(res, 400, { error: "Р вЂ”Р В°Р С—Р С•Р В»Р Р…Р С‘РЎвЂљР Вµ key Р С‘ label" });
        return true;
      }

      sendJson(res, 201, await storage.addCategory(category));
      return true;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/categories/")) {
      const categoryKey = decodeURIComponent(url.pathname.split("/").pop() || "");
      sendJson(res, 200, await storage.deleteCategory(categoryKey));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/products") {
      const body = await readBody(req);
      sendJson(res, 201, await storage.createProduct(body));
      return true;
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/admin/products/")) {
      const productId = Number(url.pathname.split("/").pop());
      const body = await readBody(req);
      sendJson(res, 200, await storage.updateProduct(productId, body));
      return true;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/products/")) {
      const productId = Number(url.pathname.split("/").pop());
      sendJson(res, 200, await storage.deleteProduct(productId));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/banners") {
      const body = await readBody(req);
      sendJson(res, 201, { banners: await storage.createBanner(body) });
      return true;
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/admin/banners/")) {
      const bannerId = Number(url.pathname.split("/").pop());
      const body = await readBody(req);
      sendJson(res, 200, { banners: await storage.updateBanner(bannerId, body) });
      return true;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/banners/")) {
      const bannerId = Number(url.pathname.split("/").pop());
      sendJson(res, 200, { banners: await storage.deleteBanner(bannerId) });
      return true;
    }

    sendJson(res, 404, { error: "Not found" });
    return true;
  };
}

module.exports = {
  createAdminRouteHandler
};
