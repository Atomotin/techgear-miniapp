function createAdminRouteHandler({
  storage,
  sendJson,
  readBody,
  normalizeString,
  sanitizeLongText,
  adminPassword,
  createToken,
  ensureAdmin,
  saveAdminUpload,
  requirePersistentAdminStorage,
  notifyOrderStatusUpdate
}) {
  async function ensurePersistentBannerStorage(res) {
    if (!requirePersistentAdminStorage) {
      return true;
    }

    if (typeof storage.getDiagnostics !== "function") {
      sendJson(res, 503, {
        error: "Не удалось проверить хранилище баннеров. Откройте /api/health и проверьте storage."
      });
      return false;
    }

    const diagnostics = await storage.getDiagnostics();
    const bannerInfo = diagnostics?.banners || null;
    if (bannerInfo?.persistent !== false) {
      return true;
    }

    sendJson(res, 503, {
      error: `Постоянное хранилище баннеров недоступно: ${bannerInfo.reason || "проверьте /api/health и настройку Supabase"}`
    });
    return false;
  }

  return async function handleAdminRoute(req, res, url) {
    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const body = await readBody(req);

      if (normalizeString(body.password) !== adminPassword) {
        sendJson(res, 401, { error: "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c" });
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
      const hasManagerNote = Object.prototype.hasOwnProperty.call(body, "managerNote");
      const managerNote = hasManagerNote ? sanitizeLongText(body.managerNote, 1000) : undefined;
      const hasManagerAssignee = Object.prototype.hasOwnProperty.call(body, "managerAssignee");
      const managerAssignee = hasManagerAssignee ? sanitizeLongText(body.managerAssignee, 80) : undefined;
      const allowedStatuses = ["new", "processing", "done", "cancelled"];
      const hasStatus = Boolean(nextStatus);

      if (!hasStatus && !hasManagerNote && !hasManagerAssignee) {
        sendJson(res, 400, { error: "Укажите статус, ответственного или заметку менеджера" });
        return true;
      }

      if (hasStatus && !allowedStatuses.includes(nextStatus)) {
        sendJson(res, 400, { error: "\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u0441\u0442\u0430\u0442\u0443\u0441" });
        return true;
      }

      const existingOrders = await storage.getOrders();
      const existingOrder = existingOrders.find((item) => Number(item.id) === orderId) || null;
      const previousStatus = normalizeString(existingOrder?.status);
      const order = await storage.updateOrderStatus(
        orderId,
        hasStatus ? nextStatus : undefined,
        {
          ...(hasManagerNote ? { managerNote } : {}),
          ...(hasManagerAssignee ? { managerAssignee } : {})
        }
      );

      let notification = { sent: false, skipped: true, reason: "status_unchanged" };
      if (hasStatus && previousStatus !== nextStatus) {
        if (typeof notifyOrderStatusUpdate === "function") {
          try {
            notification = await notifyOrderStatusUpdate(order, { previousStatus });
          } catch (error) {
            console.error(`Failed to send Telegram status update for order #${orderId}:`, error);
            notification = {
              sent: false,
              skipped: false,
              error: error.message || "notification_failed"
            };
          }
        } else {
          notification = { sent: false, skipped: true, reason: "notifier_unavailable" };
        }
      }

      sendJson(res, 200, { ok: true, order, notification });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/categories") {
      const body = await readBody(req);
      const category = {
        key: normalizeString(body.key),
        label: normalizeString(body.label)
      };

      if (!category.key || !category.label) {
        sendJson(res, 400, { error: "\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 key \u0438 label" });
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
      if (!(await ensurePersistentBannerStorage(res))) {
        return true;
      }

      const body = await readBody(req);
      sendJson(res, 201, { banners: await storage.createBanner(body) });
      return true;
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/admin/banners/")) {
      if (!(await ensurePersistentBannerStorage(res))) {
        return true;
      }

      const bannerId = Number(url.pathname.split("/").pop());
      const body = await readBody(req);
      sendJson(res, 200, { banners: await storage.updateBanner(bannerId, body) });
      return true;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/banners/")) {
      if (!(await ensurePersistentBannerStorage(res))) {
        return true;
      }

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
