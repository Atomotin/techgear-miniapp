const fs = require("fs");

function buildSharedStorageModule({
  createHttpError,
  normalizeString,
  sanitizeCustomerProfile,
  sanitizePromoBanner,
  sanitizePromoBanners,
  sanitizeAppSettings,
  sanitizeProduct,
  buildDefaultPromoBanners,
  buildDefaultAppSettings,
  loadLegacyCatalog,
  dataDir,
  catalogPath,
  ordersPath,
  customersPath,
  bannersPath,
  settingsPath
}) {
function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function ensureDataFiles() {
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(catalogPath)) {
    writeJson(catalogPath, loadLegacyCatalog());
  }

  if (!fs.existsSync(ordersPath)) {
    writeJson(ordersPath, []);
  }

  if (!fs.existsSync(customersPath)) {
    writeJson(customersPath, []);
  }

  if (!fs.existsSync(bannersPath)) {
    const catalog = fs.existsSync(catalogPath) ? readJson(catalogPath, loadLegacyCatalog()) : loadLegacyCatalog();
    writeJson(bannersPath, buildDefaultPromoBanners(Array.isArray(catalog?.products) ? catalog.products : []));
  }

  if (!fs.existsSync(settingsPath)) {
    writeJson(settingsPath, buildDefaultAppSettings());
  }
}

function getFallbackCustomers() {
  ensureDataFiles();
  const customers = readJson(customersPath, []);
  return Array.isArray(customers)
    ? customers.map((customer) => sanitizeCustomerProfile(customer)).filter((customer) => customer.key)
    : [];
}

function saveFallbackCustomers(customers) {
  ensureDataFiles();
  writeJson(customersPath, customers);
}

function upsertFallbackCustomerProfile(payload) {
  const profile = sanitizeCustomerProfile(payload);
  if (!profile.key) {
    throw createHttpError(400, "Некорректный профиль клиента");
  }

  const customers = getFallbackCustomers();
  const existingIndex = customers.findIndex((item) => item.key === profile.key);

  if (existingIndex >= 0) {
    const existing = customers[existingIndex];
    customers[existingIndex] = {
      ...existing,
      ...profile,
      createdAt: existing.createdAt || profile.createdAt,
      updatedAt: new Date().toISOString()
    };
  } else {
    customers.unshift(profile);
  }

  saveFallbackCustomers(customers);
  return customers.find((item) => item.key === profile.key) || profile;
}

function getFallbackSettings() {
  ensureDataFiles();
  return sanitizeAppSettings(readJson(settingsPath, buildDefaultAppSettings()));
}

function saveFallbackSettings(settings) {
  ensureDataFiles();
  const normalized = sanitizeAppSettings(settings);
  writeJson(settingsPath, normalized);
  return normalized;
}

function shouldUseCustomerFallback(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("customers") && (message.includes("relation") || message.includes("schema cache") || message.includes("does not exist"));
}

function shouldUseBannerFallback(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("promo_banners") && (message.includes("relation") || message.includes("schema cache") || message.includes("does not exist"));
}

function shouldUseSettingsFallback(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("app_settings") && (message.includes("relation") || message.includes("schema cache") || message.includes("does not exist"));
}

function categoryRowToModel(row) {
  return {
    key: normalizeString(row?.key),
    label: normalizeString(row?.label)
  };
}

function productRowToModel(row) {
  return sanitizeProduct({
    id: row?.id,
    name: row?.name,
    category: row?.category_key,
    sortOrder: row?.sort_order,
    isVisible: row?.is_visible,
    isSoon: row?.is_soon,
    price: row?.price,
    oldPrice: row?.old_price,
    image: row?.image,
    images: Array.isArray(row?.images) ? row.images : [],
    desc: row?.description,
    stock: row?.stock,
    variants: Array.isArray(row?.variants) ? row.variants : [],
    badge: row?.badge
  });
}

function productModelToRow(product, { includeId = true } = {}) {
  const row = {
    name: product.name,
    category_key: product.category,
    sort_order: product.sortOrder,
    is_visible: product.isVisible,
    is_soon: product.isSoon,
    price: product.price,
    image: product.image,
    images: product.images,
    description: product.desc,
    stock: product.stock,
    variants: product.variants,
    badge: product.badge || null
  };

  if (product.oldPrice > 0) {
    row.old_price = product.oldPrice;
  }

  if (includeId && product.id) {
    row.id = product.id;
  }

  return row;
}

function orderRowToModel(row) {
  return {
    id: Number(row?.id) || 0,
    status: normalizeString(row?.status) || "new",
    createdAt: row?.created_at || new Date().toISOString(),
    source: normalizeString(row?.source) || "miniapp",
    customer: row?.customer || {},
    items: Array.isArray(row?.items) ? row.items : [],
    total: Number(row?.total) || 0,
    rawText: normalizeString(row?.raw_text),
    telegram: row?.telegram || {},
    requestMeta: row?.request_meta || {}
  };
}

function orderModelToRow(order, { includeId = true } = {}) {
  const row = {
    status: order.status,
    created_at: order.createdAt,
    source: order.source || "miniapp",
    customer: order.customer || {},
    items: order.items || [],
    total: order.total || 0,
    raw_text: order.rawText || "",
    telegram: order.telegram || {},
    request_meta: order.requestMeta || {}
  };

  if (includeId && order.id) {
    row.id = order.id;
  }

  return row;
}

function customerRowToModel(row) {
  return {
    key: normalizeString(row?.key),
    telegramId: normalizeString(row?.telegram_id),
    name: normalizeString(row?.name),
    phone: normalizeString(row?.phone),
    username: normalizeString(row?.username),
    delivery: normalizeString(row?.delivery),
    comment: normalizeString(row?.comment),
    createdAt: row?.created_at || new Date().toISOString(),
    updatedAt: row?.updated_at || new Date().toISOString()
  };
}

function customerModelToRow(profile, { includeKey = true } = {}) {
  const row = {
    telegram_id: profile.telegramId || "",
    name: profile.name || "",
    phone: profile.phone || "",
    username: profile.username || "",
    delivery: profile.delivery || "",
    comment: profile.comment || "",
    created_at: profile.createdAt || new Date().toISOString(),
    updated_at: profile.updatedAt || new Date().toISOString()
  };

  if (includeKey && profile.key) {
    row.key = profile.key;
  }

  return row;
}

function bannerRowToModel(row) {
  return sanitizePromoBanner({
    id: row?.id,
    title: row?.title,
    kicker: row?.kicker,
    image: row?.image,
    cta: row?.cta_label,
    secondary: row?.secondary_label,
    sortOrder: row?.sort_order,
    isActive: row?.is_active,
    actionType: row?.action_type,
    actionValue: row?.action_value,
    secondaryActionType: row?.secondary_action_type,
    secondaryActionValue: row?.secondary_action_value,
  }, row?.id);
}

function bannerModelToRow(banner, { includeId = true } = {}) {
  const row = {
    title: banner.title,
    kicker: banner.kicker || "",
    image: banner.image,
    cta_label: banner.cta || "",
    secondary_label: banner.secondary || "",
    sort_order: banner.sortOrder || 1,
    is_active: banner.isActive !== false,
    action_type: banner.actionType || "reset",
    action_value: banner.actionValue || "",
    secondary_action_type: banner.secondaryActionType || "",
    secondary_action_value: banner.secondaryActionValue || "",
  };

  if (includeId && banner.id) {
    row.id = banner.id;
  }

  return row;
}

function settingsRowToModel(row) {
  return sanitizeAppSettings(row?.value || {});
}

function settingsModelToRow(settings, { id = "miniapp", includeId = true } = {}) {
  const row = {
    value: sanitizeAppSettings(settings)
  };

  if (includeId) {
    row.id = id;
  }

  return row;
}

  return {
    readJson,
    writeJson,
    ensureDataFiles,
    getFallbackCustomers,
    upsertFallbackCustomerProfile,
    getFallbackSettings,
    saveFallbackSettings,
    shouldUseCustomerFallback,
    shouldUseBannerFallback,
    shouldUseSettingsFallback,
    categoryRowToModel,
    productRowToModel,
    productModelToRow,
    orderRowToModel,
    orderModelToRow,
    customerRowToModel,
    customerModelToRow,
    bannerRowToModel,
    bannerModelToRow,
    settingsRowToModel,
    settingsModelToRow
  };
}

module.exports = {
  buildSharedStorageModule
};
