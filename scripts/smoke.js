const assert = require("assert/strict");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const SERVER_PATH = path.join(ROOT_DIR, "server.js");
const ORDERS_PATH = path.join(ROOT_DIR, "data", "orders.json");
const CUSTOMERS_PATH = path.join(ROOT_DIR, "data", "customers.json");
const BANNERS_PATH = path.join(ROOT_DIR, "data", "banners.json");
const SETTINGS_PATH = path.join(ROOT_DIR, "data", "settings.json");
const SMOKE_PASSWORD = "smoke-admin-password";
const BULLET_SEPARATOR = " \u2022 ";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

function snapshotFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, content: "" };
  }

  return {
    exists: true,
    content: fs.readFileSync(filePath, "utf8")
  };
}

function restoreFile(filePath, snapshot) {
  if (snapshot.exists) {
    fs.writeFileSync(filePath, snapshot.content, "utf8");
    return;
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function request({ port, method = "GET", pathname = "/", headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: {
          ...(payload ? {
            "Content-Type": "application/json",
            "Content-Length": String(payload.length)
          } : {}),
          ...headers
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const rawText = Buffer.concat(chunks).toString("utf8");
          const contentType = String(res.headers["content-type"] || "").toLowerCase();
          let parsedBody = rawText;

          if (contentType.includes("application/json")) {
            try {
              parsedBody = rawText ? JSON.parse(rawText) : null;
            } catch (error) {
              reject(new Error(`Failed to parse JSON from ${method} ${pathname}: ${error.message}`));
              return;
            }
          }

          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: parsedBody,
            rawText
          });
        });
      }
    );

    req.once("error", reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function waitForServer(port, child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before smoke checks started with code ${child.exitCode}`);
    }

    try {
      const response = await request({ port, pathname: "/api/health" });
      if (response.statusCode === 200) {
        return;
      }
    } catch (error) {}

    await delay(200);
  }

  throw new Error("Timed out while waiting for the server to start");
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeOptionList(value) {
  const source = Array.isArray(value)
    ? value
    : (typeof value === "string" ? value.split(/\r?\n|,/) : []);

  return [...new Set(
    source
      .map((item) => normalizeString(item))
      .filter(Boolean)
  )];
}

function getProductVariantGroups(product = {}) {
  const prefix = "__tg_option_groups__=";
  const parsed = {
    colors: [],
    models: [],
    variants: []
  };

  (Array.isArray(product.variants) ? product.variants : []).forEach((item) => {
    const value = normalizeString(item);
    if (!value) return;

    if (value.startsWith(prefix)) {
      try {
        const payload = JSON.parse(value.slice(prefix.length));
        parsed.colors = normalizeOptionList(payload && payload.colors);
        parsed.models = normalizeOptionList(payload && payload.models);
        return;
      } catch (error) {}
    }

    parsed.variants.push(value);
  });

  return [parsed.colors, parsed.models, parsed.variants].filter((group) => group.length > 0);
}

function buildValidVariant(product = {}) {
  const groups = getProductVariantGroups(product);
  if (!groups.length) {
    return "";
  }

  return groups.map((group) => group[0]).join(BULLET_SEPARATOR);
}

function pickSmokeProduct(products = []) {
  const visibleProducts = products.filter((product) => product && product.isVisible !== false);
  const pricedVariantProduct = visibleProducts.find((product) => Number(product.price) > 0 && getProductVariantGroups(product).length > 0);
  if (pricedVariantProduct) {
    return pricedVariantProduct;
  }

  const pricedProduct = visibleProducts.find((product) => Number(product.price) > 0);
  if (pricedProduct) {
    return pricedProduct;
  }

  return visibleProducts[0] || null;
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill();
  const exited = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

  if (!exited && child.exitCode === null) {
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

async function main() {
  const ordersSnapshot = snapshotFile(ORDERS_PATH);
  const customersSnapshot = snapshotFile(CUSTOMERS_PATH);
  const bannersSnapshot = snapshotFile(BANNERS_PATH);
  const settingsSnapshot = snapshotFile(SETTINGS_PATH);
  const port = await getFreePort();
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      ADMIN_PASSWORD: SMOKE_PASSWORD,
      PUBLIC_BASE_URL: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_MANAGER_CHAT_ID: "",
      TELEGRAM_MANAGER_CHAT_IDS: "",
      NODE_ENV: process.env.NODE_ENV || "development"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  try {
    await waitForServer(port, child);

    const homeResponse = await request({ port, pathname: "/" });
    assert.equal(homeResponse.statusCode, 200, "GET / should return 200");
    assert.match(String(homeResponse.headers["content-type"] || ""), /text\/html/i, "GET / should return HTML");

    const adminPageResponse = await request({ port, pathname: "/admin" });
    assert.equal(adminPageResponse.statusCode, 200, "GET /admin should return 200");
    assert.match(String(adminPageResponse.headers["content-type"] || ""), /text\/html/i, "GET /admin should return HTML");

    const healthResponse = await request({ port, pathname: "/api/health" });
    assert.equal(healthResponse.statusCode, 200, "GET /api/health should return 200");
    assert.equal(healthResponse.body && healthResponse.body.ok, true, "Health check should report ok: true");
    assert.equal(healthResponse.body && healthResponse.body.telegramManagerNotificationsEnabled, false, "Health check should report manager Telegram notifications disabled in smoke");

    const catalogResponse = await request({ port, pathname: "/api/catalog/public" });
    assert.equal(catalogResponse.statusCode, 200, "GET /api/catalog/public should return 200");

    const product = pickSmokeProduct(Array.isArray(catalogResponse.body && catalogResponse.body.products) ? catalogResponse.body.products : []);
    assert.ok(product, "Smoke check needs at least one visible product in catalog");

    const pagedCatalogResponse = await request({ port, pathname: "/api/catalog/public?page=1&pageSize=4&includeMeta=1" });
    assert.equal(pagedCatalogResponse.statusCode, 200, "GET /api/catalog/public paged feed should return 200");
    assert.ok(Array.isArray(pagedCatalogResponse.body && pagedCatalogResponse.body.products), "Paged catalog feed should return products array");
    assert.ok(Array.isArray(pagedCatalogResponse.body && pagedCatalogResponse.body.categories), "Paged catalog feed should return categories when includeMeta=1");
    assert.equal(typeof (pagedCatalogResponse.body && pagedCatalogResponse.body.pagination), "object", "Paged catalog feed should return pagination");
    assert.equal(Number(pagedCatalogResponse.body && pagedCatalogResponse.body.pagination && pagedCatalogResponse.body.pagination.pageSize), 4, "Paged catalog feed should respect pageSize");
    assert.ok((pagedCatalogResponse.body && pagedCatalogResponse.body.products && pagedCatalogResponse.body.products.length || 0) <= 4, "Paged catalog feed should limit product count");

    const idsCatalogResponse = await request({ port, pathname: `/api/catalog/public?ids=${encodeURIComponent(String(product.id))}` });
    assert.equal(idsCatalogResponse.statusCode, 200, "GET /api/catalog/public by ids should return 200");
    assert.equal(Number(idsCatalogResponse.body && idsCatalogResponse.body.products && idsCatalogResponse.body.products[0] && idsCatalogResponse.body.products[0].id), Number(product.id), "Catalog ids lookup should return requested product");

    const wrongLoginResponse = await request({
      port,
      method: "POST",
      pathname: "/api/admin/login",
      body: { password: "wrong-password" }
    });
    assert.equal(wrongLoginResponse.statusCode, 401, "Wrong admin password should return 401");

    const loginResponse = await request({
      port,
      method: "POST",
      pathname: "/api/admin/login",
      body: { password: SMOKE_PASSWORD }
    });
    assert.equal(loginResponse.statusCode, 200, "Correct admin password should return 200");
    assert.ok(normalizeString(loginResponse.body && loginResponse.body.token), "Admin login should return a token");

    const adminToken = String(loginResponse.body.token);
    const adminOrdersBeforeResponse = await request({
      port,
      pathname: "/api/admin/orders",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert.equal(adminOrdersBeforeResponse.statusCode, 200, "Authorized GET /api/admin/orders should return 200");

    const catalogImportPreviewResponse = await request({
      port,
      method: "POST",
      pathname: "/api/admin/catalog/import",
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        source: "data",
        apply: false
      }
    });
    assert.equal(catalogImportPreviewResponse.statusCode, 200, "Admin catalog import preview should return 200");
    assert.equal(catalogImportPreviewResponse.body && catalogImportPreviewResponse.body.ok, true, "Admin catalog import preview should return ok: true");
    assert.equal(catalogImportPreviewResponse.body && catalogImportPreviewResponse.body.report && catalogImportPreviewResponse.body.report.dryRun, true, "Catalog import preview should be dry-run");
    assert.equal(typeof (catalogImportPreviewResponse.body && catalogImportPreviewResponse.body.report && catalogImportPreviewResponse.body.report.summary), "object", "Catalog import preview should include summary");

    const validVariant = buildValidVariant(product);
    const expectedItemPrice = Number(product.price) || 0;
    const expectedTotal = expectedItemPrice * 2;
    const createOrderResponse = await request({
      port,
      method: "POST",
      pathname: "/api/orders",
      body: {
        name: "Ali",
        phone: "+998900001122",
        username: "@ali",
        contactMethod: "telegram",
        deliveryTime: "today",
        delivery: "Tashkent smoke address",
        comment: "Smoke order",
        location: "41.3111,69.2797",
        telegram: {
          id: "123456",
          username: "ali"
        },
        items: [
          {
            id: product.id,
            qty: 2,
            variant: validVariant,
            price: 1
          }
        ],
        total: 2
      }
    });
    assert.equal(createOrderResponse.statusCode, 201, "Valid order should return 201");
    assert.ok(Number.isFinite(Number(createOrderResponse.body && createOrderResponse.body.orderId)), "Valid order should return orderId");
    assert.equal(typeof (createOrderResponse.body && createOrderResponse.body.notification), "object", "Valid order should return notification metadata");
    assert.equal(typeof (createOrderResponse.body && createOrderResponse.body.notification && createOrderResponse.body.notification.sent), "boolean", "Notification metadata should include sent flag");
    assert.equal(typeof (createOrderResponse.body && createOrderResponse.body.notification && createOrderResponse.body.notification.customer), "object", "Notification metadata should include customer delivery result");
    assert.equal(typeof (createOrderResponse.body && createOrderResponse.body.notification && createOrderResponse.body.notification.manager), "object", "Notification metadata should include manager delivery result");

    const createdOrderId = Number(createOrderResponse.body.orderId);
    const adminOrdersAfterResponse = await request({
      port,
      pathname: "/api/admin/orders",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert.equal(adminOrdersAfterResponse.statusCode, 200, "Authorized GET /api/admin/orders after create should return 200");

    const savedOrders = Array.isArray(adminOrdersAfterResponse.body && adminOrdersAfterResponse.body.orders)
      ? adminOrdersAfterResponse.body.orders
      : [];
    const savedOrder = savedOrders.find((item) => Number(item && item.id) === createdOrderId);
    assert.ok(savedOrder, "Created order should be present in admin orders");
    assert.equal(Number(savedOrder.total), expectedTotal, "Server should recalculate trusted order total");
    assert.equal(Number(savedOrder.items && savedOrder.items[0] && savedOrder.items[0].price), expectedItemPrice, "Server should keep catalog price");
    assert.equal(normalizeString(savedOrder.items && savedOrder.items[0] && savedOrder.items[0].variant), validVariant, "Server should store the expected variant");
    assert.match(String(savedOrder.rawText || ""), /Ali/, "Saved order should contain server-built rawText");
    assert.equal(typeof (savedOrder.requestMeta && savedOrder.requestMeta.telegramCreationNotification), "object", "Order should persist Telegram creation notification snapshot");
    assert.equal(savedOrder.requestMeta && savedOrder.requestMeta.telegramCreationNotification && savedOrder.requestMeta.telegramCreationNotification.kind, "created", "Creation notification snapshot should be marked as created");

    const updateStatusResponse = await request({
      port,
      method: "PATCH",
      pathname: `/api/admin/orders/${createdOrderId}`,
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: { status: "processing" }
    });
    assert.equal(updateStatusResponse.statusCode, 200, "Admin status update should return 200");
    assert.equal(typeof (updateStatusResponse.body && updateStatusResponse.body.order && updateStatusResponse.body.order.requestMeta && updateStatusResponse.body.order.requestMeta.telegramStatusNotification), "object", "Status update should persist Telegram status notification snapshot");
    assert.equal(updateStatusResponse.body && updateStatusResponse.body.order && updateStatusResponse.body.order.requestMeta && updateStatusResponse.body.order.requestMeta.telegramStatusNotification && updateStatusResponse.body.order.requestMeta.telegramStatusNotification.kind, "status_update", "Status notification snapshot should be marked as status_update");

    const tooManyQtyResponse = await request({
      port,
      method: "POST",
      pathname: "/api/orders",
      body: {
        name: "Ali",
        phone: "+998900001122",
        delivery: "Tashkent smoke address",
        items: [
          {
            id: product.id,
            qty: 21,
            variant: validVariant
          }
        ],
        total: 0
      }
    });
    assert.equal(tooManyQtyResponse.statusCode, 400, "Order with qty > 20 should return 400");

    if (getProductVariantGroups(product).length > 0) {
      const invalidVariantResponse = await request({
        port,
        method: "POST",
        pathname: "/api/orders",
        body: {
          name: "Ali",
          phone: "+998900001122",
          delivery: "Tashkent smoke address",
          items: [
            {
              id: product.id,
              qty: 1,
              variant: "not-a-real-variant"
            }
          ],
          total: 0
        }
      });
      assert.equal(invalidVariantResponse.statusCode, 400, "Order with invalid variant should return 400");
    }

    console.log("Smoke checks passed");
    console.log(`Server: http://127.0.0.1:${port}`);
    console.log("Checked: /, /admin, /api/health, /api/catalog/public, paged catalog feed, catalog ids lookup, admin login, catalog import preview, trusted order create, invalid order validation");
  } catch (error) {
    console.error("Smoke checks failed");
    console.error(error && error.stack ? error.stack : error);
    if (stdout.trim()) {
      console.error("\nServer stdout:\n" + stdout.trim());
    }
    if (stderr.trim()) {
      console.error("\nServer stderr:\n" + stderr.trim());
    }
    process.exitCode = 1;
  } finally {
    await stopServer(child);
    restoreFile(ORDERS_PATH, ordersSnapshot);
    restoreFile(CUSTOMERS_PATH, customersSnapshot);
    restoreFile(BANNERS_PATH, bannersSnapshot);
    restoreFile(SETTINGS_PATH, settingsSnapshot);
  }
}

main();
