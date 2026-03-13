const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const IMAGE_UPLOAD_DIR = path.join(ROOT_DIR, "images.img");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");
const CUSTOMERS_PATH = path.join(DATA_DIR, "customers.json");
const BANNERS_PATH = path.join(DATA_DIR, "banners.json");
const LEGACY_CATALOG_PATH = path.join(ROOT_DIR, "card-tovary.js");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "techgear-admin";
const TOKEN_SECRET = process.env.ADMIN_SECRET || crypto.createHash("sha256").update(ADMIN_PASSWORD).digest("hex");
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const SUPABASE_REST_URL = SUPABASE_ENABLED ? `${SUPABASE_URL}/rest/v1` : "";
const SUPABASE_STORAGE_URL = SUPABASE_ENABLED ? `${SUPABASE_URL}/storage/v1` : "";
const SUPABASE_UPLOAD_BUCKET = normalizeString(process.env.SUPABASE_STORAGE_BUCKET || "techgear-assets") || "techgear-assets";
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_WEBHOOK_SECRET = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
const TELEGRAM_CHANNEL_URL = normalizeTelegramUrl(process.env.TELEGRAM_CHANNEL_URL || "https://t.me/techgear_uz");
const TELEGRAM_MANAGER_URL = normalizeTelegramUrl(process.env.TELEGRAM_MANAGER_URL || "https://t.me/atomotin");
const TELEGRAM_LOGO_URL = normalizeTelegramUrl(process.env.TELEGRAM_LOGO_URL || "");
const TELEGRAM_BOT_NAME = normalizeString(process.env.TELEGRAM_BOT_NAME || "TechGear Store");
const TELEGRAM_BOT_ENABLED = Boolean(TELEGRAM_BOT_TOKEN && PUBLIC_BASE_URL);
const TELEGRAM_API_BASE = TELEGRAM_BOT_ENABLED ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : "";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const UPLOAD_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"]
]);

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeTelegramUrl(value) {
  const normalized = String(value || "").trim();
  return normalized.startsWith("https://") ? normalized : "";
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function limitString(value, maxLength) {
  return normalizeString(value).slice(0, maxLength);
}

function stripEmoji(value) {
  return normalizeString(value).replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, "");
}

function sanitizePersonName(value) {
  return stripEmoji(value)
    .replace(/[0-9]/g, "")
    .replace(/[^\p{L}\s'-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 100);
}

function sanitizeTelegramUsername(value) {
  return stripEmoji(value)
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9_@]/g, "")
    .slice(0, 50);
}

function sanitizeLongText(value, maxLength) {
  return stripEmoji(value)
    .replace(/\s{3,}/g, "  ")
    .trim()
    .slice(0, maxLength);
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function sanitizeCategories(categories) {
  const normalized = categories
    .map((category) => ({
      key: normalizeString(category?.key),
      label: normalizeString(category?.label)
    }))
    .filter((category) => category.key && category.label);

  if (!normalized.some((category) => category.key === "all")) {
    normalized.unshift({ key: "all", label: "Все" });
  }

  return normalized;
}

function sanitizeProduct(product, fallbackId) {
  const explicitImages = Array.isArray(product?.images) ? product.images : [];
  const normalizedImages = [...new Set([...explicitImages, product?.image].map((item) => normalizeString(item)).filter(Boolean))];
  const parsedId = Number(product?.id);
  const resolvedId = Number.isFinite(parsedId) && parsedId > 0
    ? parsedId
    : (Number.isFinite(Number(fallbackId)) && Number(fallbackId) > 0 ? Number(fallbackId) : null);
  const parsedSortOrder = Number(product?.sortOrder);
  const parsedPrice = Number(product?.price) || 0;
  const parsedOldPrice = Number(product?.oldPrice) || 0;
  const normalizedOldPrice = parsedOldPrice > parsedPrice ? parsedOldPrice : 0;

  return {
    id: resolvedId,
    name: normalizeString(product?.name),
    category: normalizeString(product?.category),
    sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : (resolvedId || 1),
    isVisible: product?.isVisible !== false,
    isSoon: Boolean(product?.isSoon),
    price: parsedPrice,
    oldPrice: normalizedOldPrice,
    image: normalizedImages[0] || "",
    images: normalizedImages,
    desc: normalizeString(product?.desc),
    stock: normalizeString(product?.stock),
    variants: normalizeArray(product?.variants),
    badge: ["new", "hot"].includes(normalizeString(product?.badge)) ? normalizeString(product?.badge) : ""
  };
}

function sanitizeProducts(products) {
  return products
    .map((product, index) => sanitizeProduct(product, index + 1))
    .filter((product) => product.name && product.category)
    .map((product, index) => ({
      ...product,
      id: product.id || index + 1
    }));
}

function loadLegacyCatalog() {
  const fallback = {
    categories: [{ key: "all", label: "Все" }],
    products: [],
    updatedAt: new Date().toISOString()
  };

  if (!fs.existsSync(LEGACY_CATALOG_PATH)) {
    return fallback;
  }

  const source = fs.readFileSync(LEGACY_CATALOG_PATH, "utf8");
  const sandbox = { window: {} };

  try {
    vm.runInNewContext(source, sandbox, { filename: "card-tovary.js" });
  } catch (error) {
    console.error("Failed to seed catalog from card-tovary.js:", error);
    return fallback;
  }

  return {
    categories: sanitizeCategories(Array.isArray(sandbox.window.TECHGEAR_CATEGORIES) ? sandbox.window.TECHGEAR_CATEGORIES : fallback.categories),
    products: sanitizeProducts(Array.isArray(sandbox.window.TECHGEAR_PRODUCTS) ? sandbox.window.TECHGEAR_PRODUCTS : fallback.products),
    updatedAt: new Date().toISOString()
  };
}

function buildOrderRecord(payload, req) {
  const items = Array.isArray(payload.items) ? payload.items : [];

  return {
    id: Date.now(),
    status: "new",
    createdAt: new Date().toISOString(),
    source: "miniapp",
    customer: {
      name: sanitizePersonName(payload.name),
      phone: limitString(payload.phone, 32),
      username: sanitizeTelegramUsername(payload.username),
      contactMethod: normalizeString(payload.contactMethod),
      deliveryTime: normalizeString(payload.deliveryTime),
      delivery: sanitizeLongText(payload.delivery, 300),
      comment: sanitizeLongText(payload.comment, 500),
      location: sanitizeLongText(payload.location, 300)
    },
    items: items.map((item) => ({
      id: Number(item.id) || 0,
      name: normalizeString(item.name),
      qty: Number(item.qty) || 0,
      variant: normalizeString(item.variant),
      price: Number(item.price) || 0
    })),
    total: Number(payload.total) || 0,
    rawText: normalizeString(payload.orderText),
    telegram: payload.telegram || {},
    requestMeta: {
      userAgent: req.headers["user-agent"] || "",
      ip: req.socket.remoteAddress || ""
    }
  };
}

function buildCustomerKey(payload = {}) {
  const telegramId = normalizeString(payload.telegramId || payload.telegram?.id);
  const phone = normalizeString(payload.phone);
  const username = normalizeString(payload.username).replace(/^@/, "");
  const name = normalizeString(payload.name).toLowerCase();
  const delivery = normalizeString(payload.delivery).toLowerCase();

  if (telegramId) return `tg:${telegramId}`;
  if (phone) return `phone:${phone.replace(/[^\d+]/g, "")}`;
  if (username) return `user:${username.toLowerCase()}`;
  if (name || delivery) return `fallback:${name}|${delivery}`;
  return "";
}

function sanitizeCustomerProfile(payload = {}) {
  return {
    key: buildCustomerKey(payload),
    telegramId: normalizeString(payload.telegramId || payload.telegram?.id),
    name: sanitizePersonName(payload.name),
    phone: limitString(payload.phone, 32),
    username: sanitizeTelegramUsername(payload.username),
    delivery: sanitizeLongText(payload.delivery, 300),
    comment: sanitizeLongText(payload.comment, 500),
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function sanitizePromoBanner(payload = {}, fallbackId) {
  const explicitId = Number(payload?.id);
  const id = Number.isFinite(explicitId) && explicitId > 0
    ? explicitId
    : (Number.isFinite(Number(fallbackId)) && Number(fallbackId) > 0 ? Number(fallbackId) : null);
  const sortOrder = Number(payload?.sortOrder);
  const actionType = normalizeString(payload?.actionType || "reset").toLowerCase();
  const secondaryActionType = normalizeString(payload?.secondaryActionType || "").toLowerCase();
  const allowedActionTypes = ["reset", "category", "product", "link"];
  const image = normalizeString(payload?.image);

  return {
    id,
    title: normalizeString(payload?.title),
    kicker: normalizeString(payload?.kicker),
    image,
    cta: normalizeString(payload?.cta || payload?.ctaLabel),
    secondary: normalizeString(payload?.secondary || payload?.secondaryLabel),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : (id || 1),
    isActive: payload?.isActive !== false,
    actionType: allowedActionTypes.includes(actionType) ? actionType : "reset",
    actionValue: normalizeString(payload?.actionValue),
    secondaryActionType: secondaryActionType && allowedActionTypes.includes(secondaryActionType) ? secondaryActionType : "",
    secondaryActionValue: normalizeString(payload?.secondaryActionValue),
  };
}

function sanitizePromoBanners(banners) {
  return (Array.isArray(banners) ? banners : [])
    .map((banner, index) => sanitizePromoBanner(banner, index + 1))
    .filter((banner) => banner.title && banner.image)
    .map((banner, index) => ({
      ...banner,
      id: banner.id || index + 1,
      sortOrder: Number.isFinite(Number(banner.sortOrder)) ? Number(banner.sortOrder) : index + 1,
    }))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || (a.id || 0) - (b.id || 0));
}

function buildDefaultPromoBanners(products = []) {
  const catalog = sanitizeProducts(products);
  const withImage = catalog.filter((product) => product.images?.[0]);
  const hot = withImage.find((product) => product.badge === "hot") || withImage[0];
  const fresh = withImage.find((product) => product.badge === "new") || withImage[1] || hot;
  const setup = withImage.find((product) => ["decor", "headphones", "stands"].includes(product.category)) || withImage[2] || fresh;

  const banners = [];

  if (hot) {
    banners.push({
      id: 1,
      kicker: "Хит",
      title: hot.name,
      image: hot.images[0],
      cta: "Смотреть",
      secondary: "Каталог",
      actionType: "product",
      actionValue: String(hot.id),
      secondaryActionType: "reset",
      sortOrder: 1,
      isActive: true
    });
  }

  if (fresh) {
    banners.push({
      id: 2,
      kicker: "Новинки",
      title: "Новая поставка",
      image: fresh.images[0],
      cta: "Открыть",
      secondary: "Все товары",
      actionType: "product",
      actionValue: String(fresh.id),
      secondaryActionType: "reset",
      sortOrder: 2,
      isActive: true
    });
  }

  if (setup) {
    banners.push({
      id: 3,
      kicker: "Подборка",
      title: "Для стильного сетапа",
      image: setup.images[0],
      cta: "Подборка",
      secondary: "Связь",
      actionType: "category",
      actionValue: setup.category || "all",
      secondaryActionType: "link",
      secondaryActionValue: TELEGRAM_MANAGER_URL,
      sortOrder: 3,
      isActive: true
    });
  }

  if (!banners.length) {
    banners.push({
      id: 1,
      kicker: "TechGear",
      title: "Новинки и акции",
      image: "images.img/lolo.png",
      cta: "Каталог",
      secondary: "Канал",
      actionType: "reset",
      actionValue: "",
      secondaryActionType: "link",
      secondaryActionValue: TELEGRAM_CHANNEL_URL,
      sortOrder: 1,
      isActive: true
    });
  }

  return sanitizePromoBanners(banners);
}

function validateCustomerProfile(payload) {
  const profile = sanitizeCustomerProfile(payload);
  if (!profile.key) return "Нужен хотя бы telegramId, телефон, username или имя";
  if (!profile.name) return "Введите имя";
  if (!/^[\p{L}\s'-]+$/u.test(profile.name)) return "В имени нельзя цифры и эмодзи";
  if (!profile.phone && !profile.username && !profile.telegramId) {
    return "Нужен хотя бы один контакт: телефон, username или Telegram";
  }
  return "";
}

function validateOrderPayload(payload) {
  const name = sanitizePersonName(payload.name);
  const username = sanitizeTelegramUsername(payload.username);
  const delivery = sanitizeLongText(payload.delivery, 300);
  const comment = sanitizeLongText(payload.comment, 500);
  if (!name) return "Введите имя";
  if (!/^[\p{L}\s'-]+$/u.test(name)) return "В имени нельзя цифры и эмодзи";
  if (!normalizeString(payload.phone)) return "Введите телефон";
  if (!delivery) return "Введите адрес";
  if (username.length > 50) return "Username слишком длинный";
  if (comment.length > 500) return "Комментарий слишком длинный";
  if (!Array.isArray(payload.items) || payload.items.length === 0) return "Добавьте товары";
  return "";
}

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
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(CATALOG_PATH)) {
    writeJson(CATALOG_PATH, loadLegacyCatalog());
  }

  if (!fs.existsSync(ORDERS_PATH)) {
    writeJson(ORDERS_PATH, []);
  }

  if (!fs.existsSync(CUSTOMERS_PATH)) {
    writeJson(CUSTOMERS_PATH, []);
  }

  if (!fs.existsSync(BANNERS_PATH)) {
    const catalog = fs.existsSync(CATALOG_PATH) ? readJson(CATALOG_PATH, loadLegacyCatalog()) : loadLegacyCatalog();
    writeJson(BANNERS_PATH, buildDefaultPromoBanners(Array.isArray(catalog?.products) ? catalog.products : []));
  }
}

function getFallbackCustomers() {
  ensureDataFiles();
  const customers = readJson(CUSTOMERS_PATH, []);
  return Array.isArray(customers)
    ? customers.map((customer) => sanitizeCustomerProfile(customer)).filter((customer) => customer.key)
    : [];
}

function saveFallbackCustomers(customers) {
  ensureDataFiles();
  writeJson(CUSTOMERS_PATH, customers);
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

function shouldUseCustomerFallback(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("customers") && (message.includes("relation") || message.includes("schema cache") || message.includes("does not exist"));
}

function shouldUseBannerFallback(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("promo_banners") && (message.includes("relation") || message.includes("schema cache") || message.includes("does not exist"));
}

function parseSupabaseError(payload, response) {
  if (payload && typeof payload === "object") {
    if (payload.code === "23505") {
      return createHttpError(409, "Запись уже существует");
    }

    if (payload.code === "23503") {
      return createHttpError(409, "Связанная запись не найдена");
    }
  }

  return createHttpError(response.status || 500, payload?.message || payload?.error || "Supabase request failed");
}

function parseSupabaseStorageError(payload, response) {
  if (payload && typeof payload === "object") {
    const statusCode = response?.status || 500;
    return createHttpError(
      statusCode,
      payload.message || payload.error || payload.msg || "Supabase Storage request failed"
    );
  }

  return createHttpError(response?.status || 500, "Supabase Storage request failed");
}

async function supabaseRequest(method, resource, { query = "", body, prefer, headers = {} } = {}) {
  if (!SUPABASE_ENABLED) {
    throw createHttpError(500, "Supabase is not configured");
  }

  const response = await fetch(`${SUPABASE_REST_URL}/${resource}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw parseSupabaseError(data, response);
  }

  return data;
}

async function supabaseStorageRequest(method, resourcePath, { body, headers = {}, contentType, expectJson = true } = {}) {
  if (!SUPABASE_ENABLED) {
    throw createHttpError(500, "Supabase is not configured");
  }

  const response = await fetch(`${SUPABASE_STORAGE_URL}/${resourcePath}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...headers
    },
    body
  });

  const text = response.status === 204 ? "" : await response.text();
  const data = text && expectJson ? JSON.parse(text) : text || null;

  if (!response.ok) {
    throw parseSupabaseStorageError(data, response);
  }

  return data;
}

let uploadBucketReadyPromise = null;

async function ensureSupabaseUploadBucket() {
  if (!SUPABASE_ENABLED) {
    return false;
  }

  if (uploadBucketReadyPromise) {
    return uploadBucketReadyPromise;
  }

  uploadBucketReadyPromise = (async () => {
    try {
      await supabaseStorageRequest("GET", `bucket/${encodeURIComponent(SUPABASE_UPLOAD_BUCKET)}`);
      return true;
    } catch (error) {
      if (error?.statusCode !== 404) {
        throw error;
      }

      await supabaseStorageRequest("POST", "bucket", {
        body: JSON.stringify({
          id: SUPABASE_UPLOAD_BUCKET,
          name: SUPABASE_UPLOAD_BUCKET,
          public: true,
          allowed_mime_types: Array.from(UPLOAD_EXTENSIONS.keys())
        }),
        contentType: "application/json"
      });

      return true;
    }
  })().catch((error) => {
    uploadBucketReadyPromise = null;
    throw error;
  });

  return uploadBucketReadyPromise;
}

async function uploadBinaryToSupabaseStorage(fileName, buffer, contentType) {
  await ensureSupabaseUploadBucket();

  const objectPath = `admin/${fileName}`;
  await supabaseStorageRequest("POST", `object/${encodeURIComponent(SUPABASE_UPLOAD_BUCKET)}/${objectPath}`, {
    body: buffer,
    headers: {
      "x-upsert": "true",
      "cache-control": "3600"
    },
    contentType,
    expectJson: false
  });

  return {
    ok: true,
    path: `${SUPABASE_STORAGE_URL}/object/public/${SUPABASE_UPLOAD_BUCKET}/${objectPath}`,
    fileName,
    storage: "supabase"
  };
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

function createLocalStorageProvider() {
  function getCatalog() {
    const catalog = readJson(CATALOG_PATH, null);
    if (!catalog) {
      const seeded = loadLegacyCatalog();
      writeJson(CATALOG_PATH, seeded);
      return seeded;
    }

    return {
      categories: sanitizeCategories(Array.isArray(catalog.categories) ? catalog.categories : []),
      products: sanitizeProducts(Array.isArray(catalog.products) ? catalog.products : []),
      updatedAt: catalog.updatedAt || new Date().toISOString()
    };
  }

  function saveCatalog(catalog) {
    const normalized = {
      categories: sanitizeCategories(catalog.categories || []),
      products: sanitizeProducts(catalog.products || []),
      updatedAt: new Date().toISOString()
    };

    writeJson(CATALOG_PATH, normalized);
    return normalized;
  }

  function getOrders() {
    const orders = readJson(ORDERS_PATH, []);
    return Array.isArray(orders) ? orders : [];
  }

  function saveOrders(orders) {
    writeJson(ORDERS_PATH, orders);
  }

  function getCustomers() {
    const customers = readJson(CUSTOMERS_PATH, []);
    return Array.isArray(customers)
      ? customers.map((customer) => sanitizeCustomerProfile(customer)).filter((customer) => customer.key)
      : [];
  }

  function saveCustomers(customers) {
    writeJson(CUSTOMERS_PATH, customers);
  }

  function getBanners() {
    const banners = readJson(BANNERS_PATH, null);
    if (!banners) {
      const seeded = buildDefaultPromoBanners(getCatalog().products);
      writeJson(BANNERS_PATH, seeded);
      return seeded;
    }

    const normalized = sanitizePromoBanners(banners);
    if (!normalized.length) {
      const seeded = buildDefaultPromoBanners(getCatalog().products);
      writeJson(BANNERS_PATH, seeded);
      return seeded;
    }

    return normalized;
  }

  function saveBanners(banners) {
    const normalized = sanitizePromoBanners(banners);
    writeJson(BANNERS_PATH, normalized);
    return normalized;
  }

  function upsertCustomerProfile(payload) {
    const profile = sanitizeCustomerProfile(payload);
    if (!profile.key) {
      throw createHttpError(400, "Некорректный профиль клиента");
    }

    const customers = getCustomers();
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

    saveCustomers(customers);
    return customers.find((item) => item.key === profile.key) || profile;
  }

  return {
    mode: "local",
    async init() {
      ensureDataFiles();
    },
    async getCatalog() {
      const catalog = getCatalog();
      return {
        ...catalog,
        banners: getBanners()
      };
    },
    async getOrders() {
      return getOrders();
    },
    async getCustomers() {
      return getCustomers();
    },
    async getBanners() {
      return getBanners();
    },
    async upsertCustomerProfile(payload) {
      return upsertCustomerProfile(payload);
    },
    async createOrder(payload, req) {
      const orders = getOrders();
      const order = buildOrderRecord(payload, req);
      orders.unshift(order);
      saveOrders(orders);
      upsertCustomerProfile({
        ...order.customer,
        telegramId: order.telegram?.id,
        telegram: order.telegram
      });
      return order;
    },
    async updateOrderStatus(orderId, status) {
      const orders = getOrders();
      const order = orders.find((item) => item.id === orderId);

      if (!order) {
        throw createHttpError(404, "Заказ не найден");
      }

      order.status = status;
      saveOrders(orders);
      return order;
    },
    async addCategory(category) {
      const catalog = getCatalog();

      if (catalog.categories.some((item) => item.key === category.key)) {
        throw createHttpError(409, "Категория уже существует");
      }

      catalog.categories.push(category);
      return saveCatalog(catalog);
    },
    async deleteCategory(categoryKey) {
      const catalog = getCatalog();

      if (categoryKey === "all") {
        throw createHttpError(400, "Категорию all удалять нельзя");
      }

      if (catalog.products.some((item) => item.category === categoryKey)) {
        throw createHttpError(409, "Сначала перенесите или удалите товары из этой категории");
      }

      catalog.categories = catalog.categories.filter((item) => item.key !== categoryKey);
      return saveCatalog(catalog);
    },
    async createProduct(body) {
      const catalog = getCatalog();
      const nextId = catalog.products.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
      const product = sanitizeProduct(body, nextId);

      if (!product.name || !product.category) {
        throw createHttpError(400, "У товара должны быть name и category");
      }

      catalog.products.unshift(product);
      return saveCatalog(catalog);
    },
    async updateProduct(productId, body) {
      const catalog = getCatalog();
      const index = catalog.products.findIndex((item) => item.id === productId);

      if (index === -1) {
        throw createHttpError(404, "Товар не найден");
      }

      catalog.products[index] = sanitizeProduct({ ...catalog.products[index], ...body, id: productId }, productId);
      return saveCatalog(catalog);
    },
    async deleteProduct(productId) {
      const catalog = getCatalog();
      const nextProducts = catalog.products.filter((item) => item.id !== productId);

      if (nextProducts.length === catalog.products.length) {
        throw createHttpError(404, "Товар не найден");
      }

      catalog.products = nextProducts;
      return saveCatalog(catalog);
    },
    async createBanner(body) {
      const banners = getBanners();
      const nextId = banners.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
      const banner = sanitizePromoBanner(body, nextId);
      if (!banner.title || !banner.image) {
        throw createHttpError(400, "У баннера должны быть title и image");
      }
      banners.unshift(banner);
      return saveBanners(banners);
    },
    async updateBanner(bannerId, body) {
      const banners = getBanners();
      const index = banners.findIndex((item) => item.id === bannerId);
      if (index === -1) {
        throw createHttpError(404, "Баннер не найден");
      }
      banners[index] = sanitizePromoBanner({ ...banners[index], ...body, id: bannerId }, bannerId);
      return saveBanners(banners);
    },
    async deleteBanner(bannerId) {
      const banners = getBanners();
      const nextBanners = banners.filter((item) => item.id !== bannerId);
      if (nextBanners.length === banners.length) {
        throw createHttpError(404, "Баннер не найден");
      }
      return saveBanners(nextBanners);
    }
  };
}

function createSupabaseStorageProvider() {
  function wrapDiscountSchemaError(error) {
    if (String(error?.message || "").toLowerCase().includes("old_price")) {
      throw createHttpError(400, "Для скидок сначала обновите Supabase через supabase/schema.sql");
    }
    throw error;
  }

  async function getProductsWithDiscountSupport(queryWithDiscount, fallbackQuery) {
    try {
      return await supabaseRequest("GET", "products", { query: queryWithDiscount });
    } catch (error) {
      if (String(error?.message || "").toLowerCase().includes("old_price")) {
        return supabaseRequest("GET", "products", { query: fallbackQuery });
      }
      throw error;
    }
  }

  async function getCatalog() {
    const [categoriesRows, productRows] = await Promise.all([
      supabaseRequest("GET", "categories", {
        query: "select=key,label&order=key.asc"
      }),
      getProductsWithDiscountSupport(
        "select=id,name,category_key,sort_order,is_visible,is_soon,price,old_price,image,images,description,stock,variants,badge&order=sort_order.asc,id.asc",
        "select=id,name,category_key,sort_order,is_visible,is_soon,price,image,images,description,stock,variants,badge&order=sort_order.asc,id.asc"
      )
    ]);

    return {
      categories: sanitizeCategories((categoriesRows || []).map(categoryRowToModel)),
      products: sanitizeProducts((productRows || []).map(productRowToModel)),
      updatedAt: new Date().toISOString()
    };
  }

  async function ensureSeeded() {
    const existingCategories = await supabaseRequest("GET", "categories", {
      query: "select=key&limit=1"
    });

    if (Array.isArray(existingCategories) && existingCategories.length > 0) {
      return;
    }

    const legacyCatalog = loadLegacyCatalog();
    const categories = sanitizeCategories(legacyCatalog.categories)
      .map((category) => ({ key: category.key, label: category.label }));
    const products = sanitizeProducts(legacyCatalog.products)
      .map((product) => productModelToRow(product, { includeId: true }));

    if (categories.length) {
      await supabaseRequest("POST", "categories", {
        body: categories,
        prefer: "return=representation,resolution=merge-duplicates"
      });
    }

    if (products.length) {
      await supabaseRequest("POST", "products", {
        body: products,
        prefer: "return=representation,resolution=merge-duplicates"
      });
    }

    try {
      const existingBanners = await supabaseRequest("GET", "promo_banners", {
        query: "select=id&limit=1"
      });

      if (Array.isArray(existingBanners) && existingBanners.length === 0) {
        const banners = buildDefaultPromoBanners(legacyCatalog.products).map((banner) => bannerModelToRow(banner, { includeId: true }));
        if (banners.length) {
          await supabaseRequest("POST", "promo_banners", {
            body: banners,
            prefer: "return=representation,resolution=merge-duplicates"
          });
        }
      }
    } catch (error) {
      if (!shouldUseBannerFallback(error)) {
        throw error;
      }
    }
  }

  return {
    mode: "supabase",
    async init() {
      try {
        await ensureSupabaseUploadBucket();
      } catch (error) {
        console.warn("Supabase upload bucket is not ready:", error.message);
      }
      await ensureSeeded();
    },
    async getCatalog() {
      const catalog = await getCatalog();
      let banners = [];

      try {
        const rows = await supabaseRequest("GET", "promo_banners", {
          query: "select=id,title,kicker,image,cta_label,secondary_label,sort_order,is_active,action_type,action_value,secondary_action_type,secondary_action_value&order=sort_order.asc,id.asc"
        });
        banners = sanitizePromoBanners((rows || []).map(bannerRowToModel));
      } catch (error) {
        if (shouldUseBannerFallback(error)) {
          banners = readJson(BANNERS_PATH, buildDefaultPromoBanners(catalog.products));
        } else {
          throw error;
        }
      }

      return {
        ...catalog,
        banners
      };
    },
    async getOrders() {
      const rows = await supabaseRequest("GET", "orders", {
        query: "select=id,status,created_at,source,customer,items,total,raw_text,telegram,request_meta&order=created_at.desc"
      });

      return (rows || []).map(orderRowToModel);
    },
    async getCustomers() {
      try {
        const rows = await supabaseRequest("GET", "customers", {
          query: "select=key,telegram_id,name,phone,username,delivery,comment,created_at,updated_at&order=updated_at.desc"
        });

        return (rows || []).map(customerRowToModel);
      } catch (error) {
        if (shouldUseCustomerFallback(error)) {
          return getFallbackCustomers();
        }
        throw error;
      }
    },
    async getBanners() {
      try {
        const rows = await supabaseRequest("GET", "promo_banners", {
          query: "select=id,title,kicker,image,cta_label,secondary_label,sort_order,is_active,action_type,action_value,secondary_action_type,secondary_action_value&order=sort_order.asc,id.asc"
        });
        return sanitizePromoBanners((rows || []).map(bannerRowToModel));
      } catch (error) {
        if (shouldUseBannerFallback(error)) {
          return readJson(BANNERS_PATH, buildDefaultPromoBanners(loadLegacyCatalog().products));
        }
        throw error;
      }
    },
    async upsertCustomerProfile(payload) {
      const profile = sanitizeCustomerProfile(payload);
      if (!profile.key) {
        throw createHttpError(400, "Некорректный профиль клиента");
      }

      try {
        const rows = await supabaseRequest("POST", "customers", {
          body: [customerModelToRow(profile, { includeKey: true })],
          prefer: "return=representation,resolution=merge-duplicates"
        });

        return customerRowToModel(Array.isArray(rows) ? rows[0] : rows);
      } catch (error) {
        if (shouldUseCustomerFallback(error)) {
          return upsertFallbackCustomerProfile(profile);
        }
        throw error;
      }
    },
    async createOrder(payload, req) {
      const order = buildOrderRecord(payload, req);
      const rows = await supabaseRequest("POST", "orders", {
        body: [orderModelToRow(order, { includeId: true })],
        prefer: "return=representation"
      });

      await this.upsertCustomerProfile({
        ...order.customer,
        telegramId: order.telegram?.id,
        telegram: order.telegram
      });

      return orderRowToModel(Array.isArray(rows) ? rows[0] : rows);
    },
    async updateOrderStatus(orderId, status) {
      const rows = await supabaseRequest("PATCH", "orders", {
        query: `id=eq.${encodeURIComponent(orderId)}&select=id,status,created_at,source,customer,items,total,raw_text,telegram,request_meta`,
        body: { status },
        prefer: "return=representation"
      });

      if (!Array.isArray(rows) || rows.length === 0) {
        throw createHttpError(404, "Заказ не найден");
      }

      return orderRowToModel(rows[0]);
    },
    async addCategory(category) {
      await supabaseRequest("POST", "categories", {
        body: [category],
        prefer: "return=representation"
      });

      return getCatalog();
    },
    async deleteCategory(categoryKey) {
      if (categoryKey === "all") {
        throw createHttpError(400, "Категорию all удалять нельзя");
      }

      const products = await supabaseRequest("GET", "products", {
        query: `select=id&category_key=eq.${encodeURIComponent(categoryKey)}&limit=1`
      });

      if (Array.isArray(products) && products.length > 0) {
        throw createHttpError(409, "Сначала перенесите или удалите товары из этой категории");
      }

      await supabaseRequest("DELETE", "categories", {
        query: `key=eq.${encodeURIComponent(categoryKey)}`,
        headers: {
          Prefer: "return=minimal"
        }
      });

      return getCatalog();
    },
    async createProduct(body) {
      const product = sanitizeProduct(body);

      if (!product.name || !product.category) {
        throw createHttpError(400, "У товара должны быть name и category");
      }

      try {
        await supabaseRequest("POST", "products", {
          body: [productModelToRow(product, { includeId: false })],
          prefer: "return=representation"
        });
      } catch (error) {
        wrapDiscountSchemaError(error);
      }

      return getCatalog();
    },
    async updateProduct(productId, body) {
      const existingRows = await getProductsWithDiscountSupport(
        `select=id,name,category_key,sort_order,is_visible,is_soon,price,old_price,image,images,description,stock,variants,badge&id=eq.${encodeURIComponent(productId)}&limit=1`,
        `select=id,name,category_key,sort_order,is_visible,is_soon,price,image,images,description,stock,variants,badge&id=eq.${encodeURIComponent(productId)}&limit=1`
      );

      if (!Array.isArray(existingRows) || existingRows.length === 0) {
        throw createHttpError(404, "Товар не найден");
      }

      const existingProduct = productRowToModel(existingRows[0]);
      const product = sanitizeProduct({ ...existingProduct, ...body, id: productId }, productId);

      try {
        await supabaseRequest("PATCH", "products", {
          query: `id=eq.${encodeURIComponent(productId)}`,
          body: productModelToRow(product, { includeId: false }),
          prefer: "return=representation"
        });
      } catch (error) {
        wrapDiscountSchemaError(error);
      }

      return getCatalog();
    },
    async deleteProduct(productId) {
      const rows = await supabaseRequest("DELETE", "products", {
        query: `id=eq.${encodeURIComponent(productId)}&select=id`,
        headers: {
          Prefer: "return=representation"
        }
      });

      if (!Array.isArray(rows) || rows.length === 0) {
        throw createHttpError(404, "Товар не найден");
      }

      return getCatalog();
    },
    async createBanner(body) {
      const banner = sanitizePromoBanner(body);
      if (!banner.title || !banner.image) {
        throw createHttpError(400, "У баннера должны быть title и image");
      }

      try {
        await supabaseRequest("POST", "promo_banners", {
          body: [bannerModelToRow(banner, { includeId: false })],
          prefer: "return=representation"
        });
      } catch (error) {
        if (shouldUseBannerFallback(error)) {
          const banners = readJson(BANNERS_PATH, buildDefaultPromoBanners(loadLegacyCatalog().products));
          const nextId = banners.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
          banners.unshift(sanitizePromoBanner(body, nextId));
          writeJson(BANNERS_PATH, sanitizePromoBanners(banners));
          return sanitizePromoBanners(banners);
        }
        throw error;
      }

      return this.getBanners();
    },
    async updateBanner(bannerId, body) {
      try {
        const existingRows = await supabaseRequest("GET", "promo_banners", {
          query: `id=eq.${encodeURIComponent(bannerId)}&select=id,title,kicker,image,cta_label,secondary_label,sort_order,is_active,action_type,action_value,secondary_action_type,secondary_action_value&limit=1`
        });
        const existing = Array.isArray(existingRows) ? existingRows[0] : null;
        if (!existing) {
          throw createHttpError(404, "Баннер не найден");
        }
        const merged = sanitizePromoBanner({ ...bannerRowToModel(existing), ...body, id: bannerId }, bannerId);
        await supabaseRequest("PATCH", "promo_banners", {
          query: `id=eq.${encodeURIComponent(bannerId)}`,
          body: bannerModelToRow(merged, { includeId: false }),
          prefer: "return=representation"
        });
      } catch (error) {
        if (shouldUseBannerFallback(error)) {
          const banners = readJson(BANNERS_PATH, buildDefaultPromoBanners(loadLegacyCatalog().products));
          const index = banners.findIndex((item) => Number(item.id) === bannerId);
          if (index === -1) {
            throw createHttpError(404, "Баннер не найден");
          }
          banners[index] = sanitizePromoBanner({ ...banners[index], ...body, id: bannerId }, bannerId);
          writeJson(BANNERS_PATH, sanitizePromoBanners(banners));
          return sanitizePromoBanners(banners);
        }
        throw error;
      }

      return this.getBanners();
    },
    async deleteBanner(bannerId) {
      try {
        await supabaseRequest("DELETE", "promo_banners", {
          query: `id=eq.${encodeURIComponent(bannerId)}`
        });
      } catch (error) {
        if (shouldUseBannerFallback(error)) {
          const banners = readJson(BANNERS_PATH, buildDefaultPromoBanners(loadLegacyCatalog().products));
          const nextBanners = banners.filter((item) => Number(item.id) !== bannerId);
          if (nextBanners.length === banners.length) {
            throw createHttpError(404, "Баннер не найден");
          }
          writeJson(BANNERS_PATH, sanitizePromoBanners(nextBanners));
          return sanitizePromoBanners(nextBanners);
        }
        throw error;
      }

      return this.getBanners();
    }
  };
}

const storage = SUPABASE_ENABLED ? createSupabaseStorageProvider() : createLocalStorageProvider();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "geolocation=(self)"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "geolocation=(self)"
  });
  res.end(payload);
}

function readBinaryBody(req, maxSize = 1024 * 1024 * 8) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxSize) {
        reject(createHttpError(413, "Файл слишком большой"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024 * 2) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function sanitizeUploadName(fileName) {
  const parsed = path.parse(String(fileName || "").trim());
  const safeName = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "image";
  return safeName;
}

async function saveAdminUpload(req, url) {
  const originalName = normalizeString(url.searchParams.get("filename"));
  const contentType = normalizeString(req.headers["content-type"]).split(";")[0];
  const extension = UPLOAD_EXTENSIONS.get(contentType);

  if (!extension) {
    throw createHttpError(400, "Поддерживаются только JPG, PNG, WEBP и SVG");
  }

  const buffer = await readBinaryBody(req);
  if (!buffer.length) {
    throw createHttpError(400, "Пустой файл");
  }

  const safeBaseName = sanitizeUploadName(originalName);
  const fileName = `${Date.now()}-${safeBaseName}${extension}`;

  if (SUPABASE_ENABLED) {
    return uploadBinaryToSupabaseStorage(fileName, buffer, contentType);
  }

  fs.mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });
  const absolutePath = path.join(IMAGE_UPLOAD_DIR, fileName);
  fs.writeFileSync(absolutePath, buffer);

  return {
    ok: true,
    path: `images.img/${fileName}`,
    fileName,
    storage: "local"
  };
}

async function telegramApi(method, payload) {
  if (!TELEGRAM_BOT_ENABLED) {
    throw new Error("Telegram bot is not configured");
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.description || `Telegram API request failed: ${method}`);
  }

  return data;
}

function buildTelegramStartMessage() {
  return [
    `<b>${TELEGRAM_BOT_NAME}</b>`,
    "",
    "Добро пожаловать.",
    "",
    "TechGear — это магазин аксессуаров, товаров для сетапа и стильных деталей для рабочего пространства.",
    "",
    "Открой Mini App ниже, чтобы посмотреть каталог, новинки и оформить заказ в несколько нажатий."
  ].join("\n");
}

function buildTelegramStartKeyboard() {
  const rows = [
    [{ text: "🛍 Открыть магазин", web_app: { url: `${PUBLIC_BASE_URL}/` } }]
  ];

  const linksRow = [];
  if (TELEGRAM_CHANNEL_URL) {
    linksRow.push({ text: "📢 Наш канал", url: TELEGRAM_CHANNEL_URL });
  }
  if (TELEGRAM_MANAGER_URL) {
    linksRow.push({ text: "💬 Написать менеджеру", url: TELEGRAM_MANAGER_URL });
  }
  if (linksRow.length) {
    rows.push(linksRow);
  }

  rows.push([{ text: "🔥 Новинки и аксессуары", web_app: { url: `${PUBLIC_BASE_URL}/` } }]);

  return { inline_keyboard: rows };
}

async function handleTelegramUpdate(update) {
  const message = update?.message;
  if (!message?.chat?.id) return;

  const text = normalizeString(message.text);
  if (text !== "/start") return;

  const payload = {
    chat_id: message.chat.id,
    parse_mode: "HTML",
    reply_markup: buildTelegramStartKeyboard()
  };

  if (TELEGRAM_LOGO_URL) {
    await telegramApi("sendPhoto", {
      ...payload,
      photo: TELEGRAM_LOGO_URL,
      caption: buildTelegramStartMessage()
    });
    return;
  }

  await telegramApi("sendMessage", {
    ...payload,
    text: buildTelegramStartMessage()
  });
}

async function configureTelegramBot() {
  if (!TELEGRAM_BOT_ENABLED) {
    return;
  }

  const webhookUrl = `${PUBLIC_BASE_URL}/api/telegram/webhook`;
  const webhookData = {
    url: webhookUrl,
    allowed_updates: ["message"]
  };

  if (TELEGRAM_WEBHOOK_SECRET) {
    webhookData.secret_token = TELEGRAM_WEBHOOK_SECRET;
  }

  try {
    await telegramApi("setWebhook", webhookData);
    await telegramApi("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "🛍 Магазин",
        web_app: {
          url: `${PUBLIC_BASE_URL}/`
        }
      }
    });
    await telegramApi("setMyCommands", {
      commands: [
        { command: "start", description: "Открыть приветствие и магазин" }
      ]
    });
    await telegramApi("setMyDescription", {
      description: "TechGear Store: магазин аксессуаров, товаров для сетапа и Mini App заказов."
    });
  } catch (error) {
    console.error("Failed to configure Telegram bot:", error);
  }
}

function signTokenPayload(payload) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({
    role: "admin",
    exp: Date.now() + TOKEN_TTL_MS
  })).toString("base64url");

  return `${payload}.${signTokenPayload(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (signTokenPayload(payload) !== signature) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.role === "admin" && Number(decoded.exp) > Date.now();
  } catch (error) {
    return false;
  }
}

function getAuthToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

function ensureAdmin(req, res) {
  if (verifyToken(getAuthToken(req))) return true;
  sendJson(res, 401, { error: "Unauthorized" });
  return false;
}

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/telegram/webhook") {
    if (TELEGRAM_WEBHOOK_SECRET) {
      const secret = req.headers["x-telegram-bot-api-secret-token"] || "";
      if (secret !== TELEGRAM_WEBHOOK_SECRET) {
        sendJson(res, 401, { error: "Invalid Telegram webhook secret" });
        return true;
      }
    }

    if (!TELEGRAM_BOT_ENABLED) {
      sendJson(res, 503, { error: "Telegram bot is not configured" });
      return true;
    }

    const update = await readBody(req);
    await handleTelegramUpdate(update);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      storage: storage.mode,
      supabaseEnabled: SUPABASE_ENABLED,
      telegramBotEnabled: TELEGRAM_BOT_ENABLED,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/catalog/public") {
    sendJson(res, 200, await storage.getCatalog());
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const body = await readBody(req);
    const error = validateOrderPayload(body);

    if (error) {
      sendJson(res, 400, { error });
      return true;
    }

    const order = await storage.createOrder(body, req);
    sendJson(res, 201, { ok: true, orderId: order.id });
    return true;
  }

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

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readBody(req);

    if (normalizeString(body.password) !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: "Неверный пароль" });
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
      sendJson(res, 400, { error: "Некорректный статус" });
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
      sendJson(res, 400, { error: "Заполните key и label" });
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
}

function resolveFilePath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname === "/" ? "/index.html" : urlPathname);
  const requestedPath = decodedPath === "/admin" ? "/admin.html" : decodedPath;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = path.join(ROOT_DIR, safePath);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    return "";
  }

  return absolutePath;
}

function serveStatic(res, url) {
  const filePath = resolveFilePath(url.pathname);

  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN"
  });
  fs.createReadStream(filePath).pipe(res);
}

async function requestListener(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    const handled = await handleApi(req, res, url);
    if (handled) return;
    serveStatic(res, url);
  } catch (error) {
    if (error?.statusCode) {
      sendJson(res, error.statusCode, { error: error.message });
      return;
    }

    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
}

async function main() {
  ensureDataFiles();
  await storage.init();
  await configureTelegramBot();

  http.createServer(requestListener).listen(PORT, HOST, () => {
    console.log(`TechGear server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Storage mode: ${storage.mode}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
