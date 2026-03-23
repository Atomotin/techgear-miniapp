const fs = require("fs");

function buildSharedStorageModule({
  createHttpError,
  normalizeString,
  sanitizeCategories,
  sanitizeProducts,
  sanitizeCustomerProfile,
  sanitizePromoBanner,
  sanitizePromoBanners,
  sanitizeAppSettings,
  sanitizeProduct,
  buildDefaultPromoBanners,
  buildDefaultAppSettings,
  loadCatalogFile,
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
    writeJson(catalogPath, loadCatalogFile());
  }

  if (!fs.existsSync(ordersPath)) {
    writeJson(ordersPath, []);
  }

  if (!fs.existsSync(customersPath)) {
    writeJson(customersPath, []);
  }

  if (!fs.existsSync(bannersPath)) {
    const catalog = fs.existsSync(catalogPath) ? readJson(catalogPath, loadCatalogFile()) : loadCatalogFile();
    writeJson(bannersPath, buildDefaultPromoBanners(Array.isArray(catalog?.products) ? catalog.products : []));
  }

  if (!fs.existsSync(settingsPath)) {
    writeJson(settingsPath, buildDefaultAppSettings());
  }
}

function normalizeImportCatalog(catalog = {}) {
  return {
    categories: sanitizeCategories(Array.isArray(catalog?.categories) ? catalog.categories : []),
    products: sanitizeProducts(Array.isArray(catalog?.products) ? catalog.products : []),
    updatedAt: catalog?.updatedAt || new Date().toISOString()
  };
}

function getCatalogImportSource(sourceKey = "") {
  const normalizedKey = normalizeString(sourceKey).toLowerCase();

  if (normalizedKey === "legacy" || normalizedKey === "card-tovary" || normalizedKey === "card-tovary.js") {
    return {
      key: "legacy",
      label: "card-tovary.js",
      path: "card-tovary.js",
      fallbackUsed: false,
      catalog: normalizeImportCatalog(loadLegacyCatalog())
    };
  }

  const fileCatalog = readJson(catalogPath, null);
  return {
    key: "data",
    label: "data/catalog.json",
    path: "data/catalog.json",
    fallbackUsed: !fileCatalog,
    catalog: normalizeImportCatalog(fileCatalog || loadCatalogFile())
  };
}

function isSameImportEntity(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

function summarizeImportActions(actions = []) {
  return actions.reduce((summary, action) => {
    if (action === "create") {
      summary.create += 1;
    } else if (action === "update") {
      summary.update += 1;
    } else {
      summary.unchanged += 1;
    }

    return summary;
  }, { create: 0, update: 0, unchanged: 0 });
}

function buildCatalogImportPlan(targetCatalog = {}, options = {}) {
  const source = getCatalogImportSource(options.source);
  const sourceCatalog = normalizeImportCatalog(source.catalog);
  const currentCatalog = normalizeImportCatalog(targetCatalog);
  const categoriesByKey = new Map(currentCatalog.categories.map((category) => [category.key, category]));
  const productsById = new Map(currentCatalog.products.map((product) => [Number(product.id), product]));

  const categoryEntries = sourceCatalog.categories.map((category) => {
    const existing = categoriesByKey.get(category.key) || null;
    const action = !existing
      ? "create"
      : (isSameImportEntity(existing, category) ? "unchanged" : "update");

    return { action, item: category };
  });

  const productEntries = sourceCatalog.products.map((product) => {
    const existing = productsById.get(Number(product.id)) || null;
    const action = !existing
      ? "create"
      : (isSameImportEntity(existing, product) ? "unchanged" : "update");

    return { action, item: product };
  });

  const categorySummary = summarizeImportActions(categoryEntries.map((entry) => entry.action));
  const productSummary = summarizeImportActions(productEntries.map((entry) => entry.action));
  const totalChanges = categorySummary.create
    + categorySummary.update
    + productSummary.create
    + productSummary.update;

  return {
    source,
    sourceCatalog,
    currentCatalog,
    categoriesToUpsert: categoryEntries
      .filter((entry) => entry.action === "create" || entry.action === "update")
      .map((entry) => entry.item),
    productsToUpsert: productEntries
      .filter((entry) => entry.action === "create" || entry.action === "update")
      .map((entry) => entry.item),
    report: {
      source: {
        key: source.key,
        label: source.label,
        path: source.path,
        fallbackUsed: source.fallbackUsed === true,
        categories: sourceCatalog.categories.length,
        products: sourceCatalog.products.length
      },
      target: {
        categories: currentCatalog.categories.length,
        products: currentCatalog.products.length
      },
      summary: {
        categories: categorySummary,
        products: productSummary,
        totalChanges,
        hasChanges: totalChanges > 0
      }
    }
  };
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

function normalizeCatalogFeedOptions(options = {}) {
  const normalizeMode = (value, allowed, fallback) => {
    const normalized = normalizeString(value).toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
  };
  const parsePositiveInt = (value, fallback, { min = 1, max = 100 } = {}) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  const parseIdList = (value) => {
    const source = Array.isArray(value)
      ? value
      : String(value || "").split(/\r?\n|,/);

    return [...new Set(
      source
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item) && item > 0)
    )];
  };

  const ids = parseIdList(options.ids);
  const focusProductId = Number.parseInt(options.focusProductId, 10);

  return {
    search: normalizeString(options.search),
    category: normalizeString(options.category) || "all",
    availability: normalizeMode(options.availability, ["all", "available", "soon"], "all"),
    sort: normalizeMode(options.sort, ["manual", "price-asc", "price-desc", "name", "newest"], "manual"),
    page: parsePositiveInt(options.page, 1, { min: 1, max: 10000 }),
    pageSize: parsePositiveInt(options.pageSize, 8, { min: 1, max: 48 }),
    includeMeta: options.includeMeta === true || String(options.includeMeta || "").trim().toLowerCase() === "true" || String(options.includeMeta || "").trim() === "1",
    ids,
    focusProductId: Number.isFinite(focusProductId) && focusProductId > 0 ? focusProductId : 0
  };
}

function sortProductsByExplicitIds(products, ids = []) {
  if (!ids.length) {
    return [...products];
  }

  const orderMap = new Map(ids.map((id, index) => [Number(id), index]));
  return [...products].sort((left, right) => {
    const leftOrder = orderMap.get(Number(left?.id));
    const rightOrder = orderMap.get(Number(right?.id));
    return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
  });
}

function sortPublicCatalogProducts(products = [], options = {}) {
  const normalized = normalizeCatalogFeedOptions(options);

  if (normalized.ids.length) {
    return sortProductsByExplicitIds(products, normalized.ids);
  }

  return [...products].sort((left, right) => {
    if (normalized.sort === "price-asc") {
      return (Number(left?.price) || Number.MAX_SAFE_INTEGER) - (Number(right?.price) || Number.MAX_SAFE_INTEGER);
    }

    if (normalized.sort === "price-desc") {
      return (Number(right?.price) || 0) - (Number(left?.price) || 0);
    }

    if (normalized.sort === "name") {
      return String(left?.name || "").localeCompare(String(right?.name || ""), "ru");
    }

    if (normalized.sort === "newest") {
      const score = (item) => {
        if (item?.badge === "new") return 0;
        if (item?.badge === "hot") return 1;
        if (item?.isSoon) return 2;
        return 3;
      };
      const diff = score(left) - score(right);
      if (diff) return diff;
    }

    return (Number(left?.sortOrder) || 0) - (Number(right?.sortOrder) || 0)
      || (Number(left?.id) || 0) - (Number(right?.id) || 0);
  });
}

function filterPublicCatalogProducts(products = [], options = {}) {
  const normalized = normalizeCatalogFeedOptions(options);

  if (normalized.ids.length) {
    return sortPublicCatalogProducts(
      products.filter((product) => normalized.ids.includes(Number(product?.id))),
      normalized
    );
  }

  const searchValue = normalized.search.toLowerCase();
  const filtered = products.filter((product) => {
    if (!product || product.isVisible === false) {
      return false;
    }

    if (normalized.category !== "all" && product.category !== normalized.category) {
      return false;
    }

    if (normalized.availability === "available" && product.isSoon) {
      return false;
    }

    if (normalized.availability === "soon" && !product.isSoon) {
      return false;
    }

    if (!searchValue) {
      return true;
    }

    const searchableVariants = Array.isArray(product.variants) ? product.variants : [];
    const haystack = [
      product.name,
      product.desc,
      product.stock,
      ...searchableVariants
    ].filter(Boolean).join(" ").toLowerCase();

    return haystack.includes(searchValue);
  });

  return sortPublicCatalogProducts(filtered, normalized);
}

function paginatePublicCatalogProducts(products = [], options = {}) {
  const normalized = normalizeCatalogFeedOptions(options);

  if (normalized.ids.length) {
    return {
      items: products,
      pagination: {
        currentPage: 1,
        pageSize: products.length || normalized.pageSize,
        totalItems: products.length,
        totalPages: 1,
        endIndex: products.length,
        hasMorePages: false,
        focusProductId: null,
        focusFound: false
      }
    };
  }

  const totalItems = products.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / normalized.pageSize));

  let currentPage = normalized.page;
  let focusFound = false;

  if (normalized.focusProductId) {
    const focusIndex = products.findIndex((product) => Number(product?.id) === normalized.focusProductId);
    if (focusIndex >= 0) {
      currentPage = Math.floor(focusIndex / normalized.pageSize) + 1;
      focusFound = true;
    }
  }

  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (currentPage - 1) * normalized.pageSize;
  const items = products.slice(startIndex, startIndex + normalized.pageSize);
  const endIndex = startIndex + items.length;

  return {
    items,
    pagination: {
      currentPage,
      pageSize: normalized.pageSize,
      totalItems,
      totalPages,
      endIndex,
      hasMorePages: currentPage < totalPages,
      focusProductId: normalized.focusProductId || null,
      focusFound
    }
  };
}

function buildPublicCatalogFeed(products = [], options = {}) {
  const filteredProducts = filterPublicCatalogProducts(products, options);
  return paginatePublicCatalogProducts(filteredProducts, options);
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
    settingsModelToRow,
    getCatalogImportSource,
    buildCatalogImportPlan,
    normalizeCatalogFeedOptions,
    sortPublicCatalogProducts,
    filterPublicCatalogProducts,
    paginatePublicCatalogProducts,
    buildPublicCatalogFeed
  };
}

module.exports = {
  buildSharedStorageModule
};
