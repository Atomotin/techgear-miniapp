const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");
const LEGACY_CATALOG_PATH = path.join(ROOT_DIR, "card-tovary.js");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "techgear-admin";
const TOKEN_SECRET = process.env.ADMIN_SECRET || crypto.createHash("sha256").update(ADMIN_PASSWORD).digest("hex");
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const SUPABASE_REST_URL = SUPABASE_ENABLED ? `${SUPABASE_URL}/rest/v1` : "";
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

  return {
    id: resolvedId,
    name: normalizeString(product?.name),
    category: normalizeString(product?.category),
    sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : (resolvedId || 1),
    isVisible: product?.isVisible !== false,
    isSoon: Boolean(product?.isSoon),
    price: Number(product?.price) || 0,
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
      name: normalizeString(payload.name),
      phone: normalizeString(payload.phone),
      username: normalizeString(payload.username),
      contactMethod: normalizeString(payload.contactMethod),
      deliveryTime: normalizeString(payload.deliveryTime),
      delivery: normalizeString(payload.delivery),
      comment: normalizeString(payload.comment),
      location: normalizeString(payload.location)
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

function validateOrderPayload(payload) {
  if (!normalizeString(payload.name)) return "Введите имя";
  if (!normalizeString(payload.phone)) return "Введите телефон";
  if (!normalizeString(payload.delivery)) return "Введите адрес";
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

  return {
    mode: "local",
    async init() {
      ensureDataFiles();
    },
    async getCatalog() {
      return getCatalog();
    },
    async getOrders() {
      return getOrders();
    },
    async createOrder(payload, req) {
      const orders = getOrders();
      const order = buildOrderRecord(payload, req);
      orders.unshift(order);
      saveOrders(orders);
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
    }
  };
}

function createSupabaseStorageProvider() {
  async function getCatalog() {
    const [categoriesRows, productRows] = await Promise.all([
      supabaseRequest("GET", "categories", {
        query: "select=key,label&order=key.asc"
      }),
      supabaseRequest("GET", "products", {
        query: "select=id,name,category_key,sort_order,is_visible,is_soon,price,image,images,description,stock,variants,badge&order=sort_order.asc,id.asc"
      })
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
  }

  return {
    mode: "supabase",
    async init() {
      await ensureSeeded();
    },
    async getCatalog() {
      return getCatalog();
    },
    async getOrders() {
      const rows = await supabaseRequest("GET", "orders", {
        query: "select=id,status,created_at,source,customer,items,total,raw_text,telegram,request_meta&order=created_at.desc"
      });

      return (rows || []).map(orderRowToModel);
    },
    async createOrder(payload, req) {
      const order = buildOrderRecord(payload, req);
      const rows = await supabaseRequest("POST", "orders", {
        body: [orderModelToRow(order, { includeId: true })],
        prefer: "return=representation"
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

      await supabaseRequest("POST", "products", {
        body: [productModelToRow(product, { includeId: false })],
        prefer: "return=representation"
      });

      return getCatalog();
    },
    async updateProduct(productId, body) {
      const existingRows = await supabaseRequest("GET", "products", {
        query: `select=id,name,category_key,sort_order,is_visible,is_soon,price,image,images,description,stock,variants,badge&id=eq.${encodeURIComponent(productId)}&limit=1`
      });

      if (!Array.isArray(existingRows) || existingRows.length === 0) {
        throw createHttpError(404, "Товар не найден");
      }

      const existingProduct = productRowToModel(existingRows[0]);
      const product = sanitizeProduct({ ...existingProduct, ...body, id: productId }, productId);

      await supabaseRequest("PATCH", "products", {
        query: `id=eq.${encodeURIComponent(productId)}`,
        body: productModelToRow(product, { includeId: false }),
        prefer: "return=representation"
      });

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
    }
  };
}

const storage = SUPABASE_ENABLED ? createSupabaseStorageProvider() : createLocalStorageProvider();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(payload);
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
    "Добро пожаловать в наш магазин аксессуаров и сетап-товаров.",
    "",
    "Здесь можно:",
    "• открыть Mini App магазин",
    "• перейти в Telegram-канал",
    "• быстро написать менеджеру"
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
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
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
