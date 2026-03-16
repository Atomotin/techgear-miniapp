const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const { createHttpHelpers } = require("./src/server/http");
const { createStaticHandler } = require("./src/server/static");
const { createTelegramService } = require("./src/server/telegram");
const { createUploadService } = require("./src/server/uploads");
const { createApiHandler } = require("./src/server/api");
const { createStorageRuntime } = require("./src/server/storage");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
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

const { sendJson, sendText, readBinaryBody, readBody } = createHttpHelpers({ createHttpError });

function normalizeTelegramUrl(value) {
  const normalized = String(value || "").trim();
  return normalized.startsWith("https://") ? normalized : "";
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

const telegramService = createTelegramService({
  normalizeString,
  telegramApiBase: TELEGRAM_API_BASE,
  publicBaseUrl: PUBLIC_BASE_URL,
  telegramBotEnabled: TELEGRAM_BOT_ENABLED,
  telegramBotName: TELEGRAM_BOT_NAME,
  telegramChannelUrl: TELEGRAM_CHANNEL_URL,
  telegramManagerUrl: TELEGRAM_MANAGER_URL,
  telegramLogoUrl: TELEGRAM_LOGO_URL
});

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
    categories: [{ key: "all", label: "\u0412\u0441\u0435" }],
    products: [],
    updatedAt: new Date().toISOString()
  };

  const normalizeCatalog = (catalog = {}) => ({
    categories: sanitizeCategories(Array.isArray(catalog.categories) ? catalog.categories : fallback.categories),
    products: sanitizeProducts(Array.isArray(catalog.products) ? catalog.products : fallback.products),
    updatedAt: catalog.updatedAt || new Date().toISOString()
  });

  if (fs.existsSync(CATALOG_PATH)) {
    try {
      const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
      return normalizeCatalog(catalog);
    } catch (error) {
      console.warn("Failed to read catalog.json, fallback to legacy card-tovary.js:", error.message);
    }
  }

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

  return normalizeCatalog({
    categories: Array.isArray(sandbox.window.TECHGEAR_CATEGORIES) ? sandbox.window.TECHGEAR_CATEGORIES : fallback.categories,
    products: Array.isArray(sandbox.window.TECHGEAR_PRODUCTS) ? sandbox.window.TECHGEAR_PRODUCTS : fallback.products
  });
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

const storageRuntime = createStorageRuntime({
  createHttpError,
  normalizeString,
  sanitizeCategories,
  sanitizeProduct,
  sanitizeProducts,
  sanitizeCustomerProfile,
  sanitizePromoBanner,
  sanitizePromoBanners,
  buildDefaultPromoBanners,
  buildOrderRecord,
  loadLegacyCatalog,
  dataDir: DATA_DIR,
  catalogPath: CATALOG_PATH,
  ordersPath: ORDERS_PATH,
  customersPath: CUSTOMERS_PATH,
  bannersPath: BANNERS_PATH,
  supabaseEnabled: SUPABASE_ENABLED,
  supabaseRestUrl: SUPABASE_REST_URL,
  supabaseStorageUrl: SUPABASE_STORAGE_URL,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  supabaseUploadBucket: SUPABASE_UPLOAD_BUCKET,
  uploadExtensions: UPLOAD_EXTENSIONS
});

const { storage, ensureDataFiles, uploadBinaryToSupabaseStorage } = storageRuntime;

const saveAdminUpload = createUploadService({
  normalizeString,
  uploadExtensions: UPLOAD_EXTENSIONS,
  readBinaryBody,
  createHttpError,
  imageUploadDir: IMAGE_UPLOAD_DIR,
  supabaseEnabled: SUPABASE_ENABLED,
  uploadBinaryToSupabaseStorage
});

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

const handleApi = createApiHandler({
  storage,
  sendJson,
  readBody,
  normalizeString,
  sanitizeCustomerProfile,
  validateCustomerProfile,
  validateOrderPayload,
  adminPassword: ADMIN_PASSWORD,
  createToken,
  ensureAdmin,
  saveAdminUpload,
  supabaseEnabled: SUPABASE_ENABLED,
  telegramBotEnabled: TELEGRAM_BOT_ENABLED,
  telegramWebhookSecret: TELEGRAM_WEBHOOK_SECRET,
  handleTelegramUpdate: telegramService.handleTelegramUpdate,
  notifyOrderStatusUpdate: telegramService.notifyOrderStatusUpdate
});

const { serveStatic } = createStaticHandler({
  rootDir: ROOT_DIR,
  publicDir: PUBLIC_DIR,
  mimeTypes: MIME_TYPES,
  sendText
});

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
  await telegramService.configureTelegramBot({ telegramWebhookSecret: TELEGRAM_WEBHOOK_SECRET });

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
