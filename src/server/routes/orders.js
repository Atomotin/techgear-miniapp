function createOrdersRouteHandler({
  storage,
  sendJson,
  readBody,
  validateOrderPayload,
  notifyOrderCreated,
  getVerifiedTelegramUser,
  resolveClientIp,
  rateLimiters = {}
}) {
  const MAX_ORDER_BODY_BYTES = 64 * 1024;
  const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
  const MAX_IDEMPOTENCY_ENTRIES = 5000;
  const idempotentOrders = new Map(); // key -> { orderIdPromise, expiresAt }

  function readIdempotencyKey(req) {
    const header = req.headers["x-idempotency-key"];
    const value = String(Array.isArray(header) ? header[0] : header || "").trim();
    return /^[A-Za-z0-9_-]{16,100}$/.test(value) ? value : "";
  }

  function pruneIdempotentOrders(now = Date.now()) {
    for (const [key, entry] of idempotentOrders) {
      if (entry.expiresAt <= now) idempotentOrders.delete(key);
    }
    while (idempotentOrders.size > MAX_IDEMPOTENCY_ENTRIES) {
      idempotentOrders.delete(idempotentOrders.keys().next().value);
    }
  }

  function rememberIdempotentOrder(key, orderIdPromise) {
    pruneIdempotentOrders();
    idempotentOrders.set(key, { orderIdPromise, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
    orderIdPromise.catch(() => idempotentOrders.delete(key));
  }

  async function findIdempotentOrder(key) {
    const entry = idempotentOrders.get(key);
    if (!entry || entry.expiresAt <= Date.now()) return null;
    try {
      return await entry.orderIdPromise;
    } catch (error) {
      return null;
    }
  }

  function sendCreationNotificationInBackground(order) {
    (async () => {
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

      if (typeof storage.updateOrderRequestMeta === "function") {
        await storage.updateOrderRequestMeta(order.id, {
          telegramCreationNotification: buildOrderCreationNotificationSnapshot(notification)
        });
      }
    })().catch((error) => {
      console.error(`Failed to save Telegram notification snapshot for order #${order.id}:`, error);
    });
  }

  function checkOrderRateLimit(req, telegramUser) {
    const ip = typeof resolveClientIp === "function" ? resolveClientIp(req) : "";
    const checks = [
      [rateLimiters.ordersPerIp, `ip:${ip}`],
      [rateLimiters.ordersPerIpDaily, `ip:${ip}`],
      telegramUser ? [rateLimiters.ordersPerTelegramUser, `tg:${telegramUser.id}`] : null
    ].filter((check) => check && check[0]);

    for (const [limiter, key] of checks) {
      const result = limiter.consume(key);
      if (!result.allowed) return result;
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }
  const PRODUCT_OPTION_GROUP_PREFIX = "__tg_option_groups__=";
  const MAX_ORDER_LINES = 24;
  const MAX_ITEM_QTY = 20;
  const MAX_ORDER_UNITS = 100;

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

  function buildOrderCreationNotificationSnapshot(notification = {}) {
    return {
      kind: "created",
      checkedAt: new Date().toISOString(),
      sent: notification.sent === true,
      skipped: notification.skipped === true,
      partial: notification.partial === true,
      reason: String(notification.reason || "").trim(),
      error: String(notification.error || "").trim(),
      customer: notification.customer || {},
      manager: notification.manager || {}
    };
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
      const trustedVariant = productVariantGroups.length > 0 ? normalizedVariant : "";

      // Merge repeated lines of the same product and variant, so the per-item
      // limit cannot be bypassed by sending the same item on many lines.
      const existingItem = trustedItems.find((entry) => entry.id === productId && entry.variant === trustedVariant);
      if (existingItem) {
        existingItem.qty += qty;
        if (existingItem.qty > MAX_ITEM_QTY) {
          return {
            error: `Слишком большое количество для товара "${product.name || "без названия"}". Максимум: ${MAX_ITEM_QTY}`
          };
        }
      } else {
        trustedItems.push({
          id: productId,
          name: String(product.name || "").trim(),
          qty,
          variant: trustedVariant,
          price: trustedPrice
        });
      }
      trustedTotal += trustedPrice * qty;
    }

    const totalUnits = trustedItems.reduce((sum, entry) => sum + entry.qty, 0);
    if (totalUnits > MAX_ORDER_UNITS) {
      return {
        error: `Слишком много товаров в одном заказе. Максимум: ${MAX_ORDER_UNITS} шт.`
      };
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

    const body = await readBody(req, { maxSize: MAX_ORDER_BODY_BYTES });
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      sendJson(res, 400, { error: "Некорректный заказ" });
      return true;
    }
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

    // Never trust a Telegram identity sent in the body: it decides which chat
    // the bot messages and which customer profile the order is linked to.
    const telegramUser = typeof getVerifiedTelegramUser === "function" ? getVerifiedTelegramUser(req) : null;
    trustedPayload.telegram = telegramUser || {};
    delete trustedPayload.telegramId;

    // A retry of the same checkout (same idempotency key) returns the order
    // that was already created instead of creating a duplicate.
    const idempotencyKey = readIdempotencyKey(req);
    if (idempotencyKey) {
      const existingOrderId = await findIdempotentOrder(idempotencyKey);
      if (existingOrderId) {
        sendJson(res, 201, { ok: true, orderId: existingOrderId, duplicate: true });
        return true;
      }
    }

    const rateLimit = checkOrderRateLimit(req, telegramUser);
    if (!rateLimit.allowed) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      sendJson(res, 429, { error: "Слишком много заказов подряд. Попробуйте позже или напишите менеджеру." });
      return true;
    }

    const creation = storage.createOrder(trustedPayload, req, {
      telegramVerified: Boolean(telegramUser)
    });
    if (idempotencyKey) {
      rememberIdempotentOrder(idempotencyKey, creation.then((created) => created.id));
    }

    const order = await creation;

    // Answer right away. Notifications run in the background, so a slow or
    // failing Telegram API can no longer turn a saved order into an error
    // that makes the customer submit it again. The response carries no
    // notification details (they included private manager chat IDs).
    sendJson(res, 201, { ok: true, orderId: order.id });
    sendCreationNotificationInBackground(order);
    return true;
  };
}

module.exports = {
  createOrdersRouteHandler
};
