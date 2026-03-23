function createOrdersRouteHandler({
  storage,
  sendJson,
  readBody,
  validateOrderPayload,
  notifyOrderCreated
}) {
  const PRODUCT_OPTION_GROUP_PREFIX = "__tg_option_groups__=";
  const MAX_ORDER_LINES = 24;
  const MAX_ITEM_QTY = 20;

  function normalizeOrderVariant(value) {
    return String(value || "").trim().slice(0, 160);
  }

  function normalizeOrderOptionList(value) {
    const source = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/\r?\n|,/) : []);
    return [...new Set(
      source
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )].slice(0, 16);
  }

  function getPositiveInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.trunc(parsed);
  }

  function parseProductVariantOptions(variants = []) {
    const parsed = {
      colors: [],
      models: [],
      variants: []
    };

    (Array.isArray(variants) ? variants : []).forEach((item) => {
      const value = normalizeOrderVariant(item);
      if (!value) return;

      if (value.startsWith(PRODUCT_OPTION_GROUP_PREFIX)) {
        try {
          const payload = JSON.parse(value.slice(PRODUCT_OPTION_GROUP_PREFIX.length));
          parsed.colors = normalizeOrderOptionList(payload?.colors);
          parsed.models = normalizeOrderOptionList(payload?.models);
          return;
        } catch (error) {}
      }

      parsed.variants.push(value);
    });

    return parsed;
  }

  function getProductVariantGroups(product = {}) {
    const parsed = parseProductVariantOptions(product?.variants);
    return [parsed.colors, parsed.models, parsed.variants].filter((group) => Array.isArray(group) && group.length > 0);
  }

  function isValidSelectedVariant(product = {}, selectedVariant = "") {
    const groups = getProductVariantGroups(product);
    if (!groups.length) {
      return !normalizeOrderVariant(selectedVariant);
    }

    const parts = normalizeOrderVariant(selectedVariant)
      .split(/\s*[•·]\s*/)
      .map((item) => normalizeOrderVariant(item))
      .filter(Boolean);

    if (parts.length !== groups.length) {
      return false;
    }

    return groups.every((group, index) => group.includes(parts[index]));
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

    if (sourceItems.length > MAX_ORDER_LINES) {
      return {
        error: "Слишком много разных товаров в одном заказе"
      };
    }

    for (const item of sourceItems) {
      const productId = getPositiveInteger(item?.id);
      const qty = getPositiveInteger(item?.qty);
      const product = productsById.get(productId);
      const normalizedVariant = normalizeOrderVariant(item?.variant);

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

      if (qty > MAX_ITEM_QTY) {
        return {
          error: `Слишком большое количество для товара "${product.name || "без названия"}". Максимум: ${MAX_ITEM_QTY}`
        };
      }

      const productVariantGroups = getProductVariantGroups(product);
      if (productVariantGroups.length > 0) {
        if (!normalizedVariant) {
          return {
            error: `Выберите вариант для товара "${product.name || "без названия"}"`
          };
        }

        if (!isValidSelectedVariant(product, normalizedVariant)) {
          return {
            error: `Некорректный вариант для товара "${product.name || "без названия"}"`
          };
        }
      }

      const trustedPrice = Number(product.price) || 0;
      trustedItems.push({
        id: productId,
        name: String(product.name || "").trim(),
        qty,
        variant: productVariantGroups.length > 0 ? normalizedVariant : "",
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
    let notification = { sent: false, skipped: true, reason: "notifier_unavailable" };

    if (typeof notifyOrderCreated === "function") {
      try {
        notification = await notifyOrderCreated(order);
      } catch (notifyError) {
        console.error(`Failed to send Telegram creation notification for order #${order.id}:`, notifyError);
        notification = {
          sent: false,
          skipped: false,
          error: notifyError?.message || "notification_failed"
        };
      }
    }

    sendJson(res, 201, { ok: true, orderId: order.id, notification });
    return true;
  };
}

module.exports = {
  createOrdersRouteHandler
};
