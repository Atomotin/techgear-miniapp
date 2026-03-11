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

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(CATALOG_PATH)) {
    writeJson(CATALOG_PATH, loadLegacyCatalog());
  }

  if (!fs.existsSync(ORDERS_PATH)) {
    writeJson(ORDERS_PATH, []);
  }
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
  const normalizedImages = [...explicitImages, product?.image].map((item) => normalizeString(item)).filter(Boolean);

  return {
    id: Number(product?.id) || fallbackId,
    name: normalizeString(product?.name),
    category: normalizeString(product?.category),
    sortOrder: Number.isFinite(Number(product?.sortOrder)) ? Number(product.sortOrder) : fallbackId,
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
    .filter((product) => product.name && product.category);
}

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

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/catalog/public") {
    sendJson(res, 200, getCatalog());
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const body = await readBody(req);
    const error = validateOrderPayload(body);

    if (error) {
      sendJson(res, 400, { error });
      return true;
    }

    const orders = getOrders();
    const order = buildOrderRecord(body, req);
    orders.unshift(order);
    saveOrders(orders);
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
    sendJson(res, 200, getCatalog());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/orders") {
    sendJson(res, 200, { orders: getOrders() });
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

    const orders = getOrders();
    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      sendJson(res, 404, { error: "Заказ не найден" });
      return true;
    }

    order.status = nextStatus;
    saveOrders(orders);
    sendJson(res, 200, { ok: true, order });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/categories") {
    const body = await readBody(req);
    const catalog = getCatalog();
    const category = {
      key: normalizeString(body.key),
      label: normalizeString(body.label)
    };

    if (!category.key || !category.label) {
      sendJson(res, 400, { error: "Заполните key и label" });
      return true;
    }

    if (catalog.categories.some((item) => item.key === category.key)) {
      sendJson(res, 409, { error: "Категория уже существует" });
      return true;
    }

    catalog.categories.push(category);
    sendJson(res, 201, saveCatalog(catalog));
    return true;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/categories/")) {
    const categoryKey = decodeURIComponent(url.pathname.split("/").pop() || "");
    const catalog = getCatalog();

    if (categoryKey === "all") {
      sendJson(res, 400, { error: "Категорию all удалять нельзя" });
      return true;
    }

    if (catalog.products.some((item) => item.category === categoryKey)) {
      sendJson(res, 409, { error: "Сначала перенесите или удалите товары из этой категории" });
      return true;
    }

    catalog.categories = catalog.categories.filter((item) => item.key !== categoryKey);
    sendJson(res, 200, saveCatalog(catalog));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/products") {
    const body = await readBody(req);
    const catalog = getCatalog();
    const nextId = catalog.products.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    const product = sanitizeProduct(body, nextId);

    if (!product.name || !product.category) {
      sendJson(res, 400, { error: "У товара должны быть name и category" });
      return true;
    }

    catalog.products.unshift(product);
    sendJson(res, 201, saveCatalog(catalog));
    return true;
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/admin/products/")) {
    const productId = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const catalog = getCatalog();
    const index = catalog.products.findIndex((item) => item.id === productId);

    if (index === -1) {
      sendJson(res, 404, { error: "Товар не найден" });
      return true;
    }

    catalog.products[index] = sanitizeProduct({ ...catalog.products[index], ...body, id: productId }, productId);
    sendJson(res, 200, saveCatalog(catalog));
    return true;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/admin/products/")) {
    const productId = Number(url.pathname.split("/").pop());
    const catalog = getCatalog();
    const nextProducts = catalog.products.filter((item) => item.id !== productId);

    if (nextProducts.length === catalog.products.length) {
      sendJson(res, 404, { error: "Товар не найден" });
      return true;
    }

    catalog.products = nextProducts;
    sendJson(res, 200, saveCatalog(catalog));
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
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
}

ensureDataFiles();

http.createServer(requestListener).listen(PORT, HOST, () => {
  console.log(`TechGear server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
