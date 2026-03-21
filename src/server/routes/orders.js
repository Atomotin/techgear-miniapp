function createOrdersRouteHandler({
  storage,
  sendJson,
  readBody,
  validateOrderPayload
}) {
  function normalizeOrderVariant(value) {
    return String(value || "").trim().slice(0, 160);
  }

  function getPositiveInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.trunc(parsed);
  }

  async function buildTrustedOrderPayload(payload) {
    const catalog = await storage.getCatalog();
    const products = Array.isArray(catalog?.products) ? catalog.products : [];
    const productsById = new Map(
      products
        .map((product) => [Number(product?.id), product])
        .filter(([productId]) => Number.isFinite(productId) && productId > 0)
    );

    const sourceItems = Array.isArray(payload.items) ? payload.items : [];
    const trustedItems = [];
    let trustedTotal = 0;

    for (const item of sourceItems) {
      const productId = getPositiveInteger(item?.id);
      const qty = getPositiveInteger(item?.qty);
      const product = productsById.get(productId);

      if (!product || product.isVisible === false) {
        return {
          error: "Один из товаров больше недоступен. Обновите каталог и попробуйте снова."
        };
      }

      if (qty <= 0) {
        return {
          error: `Некорректное количество для товара "${product.name || "без названия"}"`
        };
      }

      const trustedPrice = Number(product.price) || 0;
      trustedItems.push({
        id: productId,
        name: String(product.name || "").trim(),
        qty,
        variant: normalizeOrderVariant(item?.variant),
        price: trustedPrice
      });
      trustedTotal += trustedPrice * qty;
    }

    return {
      ...payload,
      items: trustedItems,
      total: trustedTotal
    };
  }

  return async function handleOrdersRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== "/api/orders") {
      return false;
    }

    const body = await readBody(req);
    const error = validateOrderPayload(body);

    if (error) {
      sendJson(res, 400, { error });
      return true;
    }

    const trustedPayload = await buildTrustedOrderPayload(body);
    if (trustedPayload.error) {
      sendJson(res, 400, { error: trustedPayload.error });
      return true;
    }

    const order = await storage.createOrder(trustedPayload, req);
    sendJson(res, 201, { ok: true, orderId: order.id });
    return true;
  };
}

module.exports = {
  createOrdersRouteHandler
};
