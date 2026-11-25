const assert = require("assert/strict");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

const ROOT_DIR = path.resolve(__dirname, "..");
const SERVER_PATH = path.join(ROOT_DIR, "server.js");
const ORDERS_PATH = path.join(ROOT_DIR, "data", "orders.json");
const CUSTOMERS_PATH = path.join(ROOT_DIR, "data", "customers.json");
const BANNERS_PATH = path.join(ROOT_DIR, "data", "banners.json");
const SETTINGS_PATH = path.join(ROOT_DIR, "data", "settings.json");
const SMOKE_PASSWORD = "smoke-admin-password";
const SMOKE_BOT_TOKEN = "123456:smoke-test-bot-token";

function buildSignedInitData(user, botToken = SMOKE_BOT_TOKEN, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams();
  params.set("auth_date", String(authDate));
  params.set("query_id", "smoke-query");
  params.set("user", JSON.stringify(user));
  const dataCheckString = [...params.entries()].map(([key, value]) => `${key}=${value}`).sort().join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}
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

const DATA_DIR = path.join(ROOT_DIR, "data");
const SNAPSHOT_PATHS = [ORDERS_PATH, CUSTOMERS_PATH, BANNERS_PATH, SETTINGS_PATH]
  .flatMap((filePath) => [filePath, `${filePath}.bak`]);

function listDataArtifacts() {
  return fs.readdirSync(DATA_DIR).filter((name) => /\.corrupt-\d+$|\.tmp$/.test(name));
}

async function main() {
  const snapshots = SNAPSHOT_PATHS.map((filePath) => [filePath, snapshotFile(filePath)]);
  const artifactsBefore = new Set(listDataArtifacts());
  const port = await getFreePort();
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      ADMIN_PASSWORD: SMOKE_PASSWORD,
      ADMIN_SECRET: "smoke-admin-token-secret",
      PUBLIC_BASE_URL: "",
      TRUST_PROXY: "true",
      TELEGRAM_BOT_TOKEN: SMOKE_BOT_TOKEN,
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

    // --- Admin login brute-force protection and logout ---
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request({
        port,
        method: "POST",
        pathname: "/api/admin/login",
        headers: { "X-Forwarded-For": "10.0.3.1" },
        body: { password: `wrong-${attempt}` }
      });
      assert.equal(response.statusCode, 401, `Wrong admin password attempt ${attempt} should return 401`);
    }
    const blockedLoginResponse = await request({
      port,
      method: "POST",
      pathname: "/api/admin/login",
      headers: { "X-Forwarded-For": "10.0.3.1" },
      body: { password: "wrong-6" }
    });
    assert.equal(blockedLoginResponse.statusCode, 429, "6th wrong admin password from one IP should return 429");
    const blockedCorrectLoginResponse = await request({
      port,
      method: "POST",
      pathname: "/api/admin/login",
      headers: { "X-Forwarded-For": "10.0.3.1" },
      body: { password: SMOKE_PASSWORD }
    });
    assert.equal(blockedCorrectLoginResponse.statusCode, 429, "Correct password from a blocked IP should still return 429");

    const throwawayLoginResponse = await request({
      port,
      method: "POST",
      pathname: "/api/admin/login",
      headers: { "X-Forwarded-For": "10.0.3.2" },
      body: { password: SMOKE_PASSWORD }
    });
    const throwawayToken = String(throwawayLoginResponse.body && throwawayLoginResponse.body.token);
    const logoutResponse = await request({
      port,
      method: "POST",
      pathname: "/api/admin/logout",
      headers: { Authorization: `Bearer ${throwawayToken}` }
    });
    assert.equal(logoutResponse.statusCode, 200, "Admin logout should return 200");
    const afterLogoutResponse = await request({
      port,
      pathname: "/api/admin/orders",
      headers: { Authorization: `Bearer ${throwawayToken}` }
    });
    assert.equal(afterLogoutResponse.statusCode, 401, "Token should stop working after logout");
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
    assert.equal(createOrderResponse.body && createOrderResponse.body.notification, undefined, "Order response must not expose notification details (manager chat IDs)");
    // Notifications run in the background; give them a moment to persist the snapshot.
    await delay(300);

    const idempotencyKey = "smoke-idempotency-key-0001";
    const idempotentOrderBody = { name: "Ali", phone: "+998900001122", delivery: "Idempotent street", items: [{ id: product.id, qty: 1, variant: validVariant }], total: 0 };
    const firstAttemptResponse = await request({ port, method: "POST", pathname: "/api/orders", headers: { "X-Idempotency-Key": idempotencyKey, "X-Forwarded-For": "10.0.4.1" }, body: idempotentOrderBody });
    const retryAttemptResponse = await request({ port, method: "POST", pathname: "/api/orders", headers: { "X-Idempotency-Key": idempotencyKey, "X-Forwarded-For": "10.0.4.1" }, body: idempotentOrderBody });
    assert.equal(firstAttemptResponse.statusCode, 201, "First attempt with idempotency key should return 201");
    assert.equal(retryAttemptResponse.statusCode, 201, "Retry with the same idempotency key should return 201");
    assert.equal(retryAttemptResponse.body.orderId, firstAttemptResponse.body.orderId, "Retry with the same idempotency key must return the same order, not a duplicate");
    assert.equal(retryAttemptResponse.body.duplicate, true, "Retry should be marked as duplicate");

    const createdOrderId = Number(createOrderResponse.body.orderId);

    // --- Telegram identity checks ---
    const smokeTelegramUser = { id: 777000111, username: "smoke_user", first_name: "Smoke" };
    const signedInitData = buildSignedInitData(smokeTelegramUser);

    const profileNoAuthResponse = await request({ port, pathname: "/api/profile?telegramId=123456" });
    assert.equal(profileNoAuthResponse.statusCode, 401, "GET /api/profile without initData should return 401");

    const profileByPhoneResponse = await request({ port, pathname: "/api/profile?phone=%2B998900001122" });
    assert.equal(profileByPhoneResponse.statusCode, 401, "GET /api/profile by phone should return 401");

    const forgedProfileResponse = await request({
      port,
      method: "POST",
      pathname: "/api/profile",
      body: { telegramId: "123456", name: "Attacker", phone: "+998901111111" }
    });
    assert.equal(forgedProfileResponse.statusCode, 401, "POST /api/profile without initData should return 401");

    const tamperedInitData = signedInitData.replace(encodeURIComponent('"id":777000111'), encodeURIComponent('"id":123456'));
    assert.notEqual(tamperedInitData, signedInitData, "Tampered initData should differ from the signed one");
    const tamperedProfileResponse = await request({
      port,
      pathname: "/api/profile",
      headers: { "X-Telegram-Init-Data": tamperedInitData }
    });
    assert.equal(tamperedProfileResponse.statusCode, 401, "Tampered initData should return 401");

    const expiredProfileResponse = await request({
      port,
      pathname: "/api/profile",
      headers: { "X-Telegram-Init-Data": buildSignedInitData(smokeTelegramUser, SMOKE_BOT_TOKEN, Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60) }
    });
    assert.equal(expiredProfileResponse.statusCode, 401, "Expired initData should return 401");

    const signedProfileSaveResponse = await request({
      port,
      method: "POST",
      pathname: "/api/profile",
      headers: { "X-Telegram-Init-Data": signedInitData },
      body: { telegramId: "123456", name: "Smoke", phone: "+998902222222", delivery: "Smoke street" }
    });
    assert.equal(signedProfileSaveResponse.statusCode, 200, "POST /api/profile with valid initData should return 200");
    assert.equal(
      String(signedProfileSaveResponse.body && signedProfileSaveResponse.body.customer && signedProfileSaveResponse.body.customer.telegramId),
      String(smokeTelegramUser.id),
      "Profile should be saved under the verified Telegram ID, not the one in the body"
    );

    const signedProfileLoadResponse = await request({
      port,
      pathname: "/api/profile",
      headers: { "X-Telegram-Init-Data": signedInitData }
    });
    assert.equal(signedProfileLoadResponse.statusCode, 200, "GET /api/profile with valid initData should return 200");
    assert.equal(
      signedProfileLoadResponse.body && signedProfileLoadResponse.body.customer && signedProfileLoadResponse.body.customer.phone,
      "+998902222222",
      "GET /api/profile should return the verified user's own profile"
    );

    const signedOrderResponse = await request({
      port,
      method: "POST",
      pathname: "/api/orders",
      headers: { "X-Telegram-Init-Data": signedInitData },
      body: {
        name: "Smoke",
        phone: "+998902222222",
        delivery: "Smoke street",
        telegram: { id: "123456" },
        items: [{ id: product.id, qty: 1, variant: validVariant }],
        total: 0
      }
    });
    assert.equal(signedOrderResponse.statusCode, 201, "Order with valid initData should return 201");

    const overwriteAttemptResponse = await request({
      port,
      method: "POST",
      pathname: "/api/orders",
      body: {
        name: "Attacker",
        phone: "+998900001122",
        delivery: "Attacker address",
        items: [{ id: product.id, qty: 1, variant: validVariant }],
        total: 0
      }
    });
    assert.equal(overwriteAttemptResponse.statusCode, 201, "Order without Telegram should still be accepted");

    const identityOrdersResponse = await request({
      port,
      pathname: "/api/admin/orders",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const identityOrders = (identityOrdersResponse.body && identityOrdersResponse.body.orders) || [];
    const forgedTelegramOrder = identityOrders.find((item) => Number(item && item.id) === createdOrderId);
    assert.equal(normalizeString(forgedTelegramOrder && forgedTelegramOrder.telegram && forgedTelegramOrder.telegram.id), "", "Telegram ID from the request body must be ignored");
    const signedOrder = identityOrders.find((item) => Number(item && item.id) === Number(signedOrderResponse.body.orderId));
    assert.equal(String(signedOrder && signedOrder.telegram && signedOrder.telegram.id), String(smokeTelegramUser.id), "Order should use the verified Telegram ID");

    const identityCustomersResponse = await request({
      port,
      pathname: "/api/admin/customers",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const identityCustomers = (identityCustomersResponse.body && identityCustomersResponse.body.customers) || [];
    const phoneCustomer = identityCustomers.find((item) => item && item.key === "phone:+998900001122");
    assert.ok(phoneCustomer, "Order without Telegram should create a phone-keyed customer");
    assert.equal(phoneCustomer.name, "Ali", "Order without Telegram must not overwrite an existing customer profile");
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

    // --- Order spam protection ---
    const crossSiteFormResponse = await request({
      port,
      method: "POST",
      pathname: "/api/orders",
      headers: { "Content-Type": "text/plain", "X-Forwarded-For": "10.0.2.1" },
      body: { name: "Ali", phone: "+998900001122", delivery: "x", items: [{ id: product.id, qty: 1, variant: validVariant }] }
    });
    assert.equal(crossSiteFormResponse.statusCode, 415, "Order sent as text/plain (cross-site form) should return 415");

    const oversizedOrderResponse = await request({
      port,
      method: "POST",
      pathname: "/api/orders",
      headers: { "X-Forwarded-For": "10.0.2.2" },
      body: { name: "Ali", phone: "+998900001122", delivery: "x", comment: "a".repeat(70 * 1024), items: [{ id: product.id, qty: 1, variant: validVariant }] }
    }).catch((error) => ({ statusCode: 413, error }));
    assert.equal(oversizedOrderResponse.statusCode, 413, "Order body over 64 KB should return 413");

    let rateLimitedResponse = null;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await request({
        port,
        method: "POST",
        pathname: "/api/orders",
        headers: { "X-Forwarded-For": "10.0.2.3" },
        body: { name: "Ali", phone: "+998900001122", delivery: "Rate limit street", items: [{ id: product.id, qty: 1, variant: validVariant }], total: 0 }
      });
      if (attempt <= 5) {
        assert.equal(response.statusCode, 201, `Order ${attempt} from one IP should be accepted`);
      } else {
        rateLimitedResponse = response;
      }
    }
    assert.equal(rateLimitedResponse.statusCode, 429, "6th order from one IP within 10 minutes should return 429");
    assert.ok(Number(rateLimitedResponse.headers["retry-after"]) > 0, "429 should include Retry-After");

    // --- Corrupt data file must not wipe order history ---
    await delay(300); // let background notification snapshots finish writing
    const ordersBeforeCorruption = JSON.parse(fs.readFileSync(ORDERS_PATH, "utf8"));
    assert.ok(ordersBeforeCorruption.length >= 2, "Smoke should have created orders before the corruption check");
    fs.writeFileSync(ORDERS_PATH, "[{\"id\": 1, \"broken", "utf8");
    const orderAfterCorruptionResponse = await request({
      port,
      method: "POST",
      pathname: "/api/orders",
      headers: { "X-Forwarded-For": "10.0.1.1" },
      body: {
        name: "Ali",
        phone: "+998900001122",
        delivery: "Tashkent smoke address",
        items: [{ id: product.id, qty: 1, variant: validVariant }],
        total: 0
      }
    });
    assert.equal(orderAfterCorruptionResponse.statusCode, 201, "Order after corruption should recover from backup and return 201");
    const ordersAfterCorruption = JSON.parse(fs.readFileSync(ORDERS_PATH, "utf8"));
    assert.ok(
      ordersAfterCorruption.length >= ordersBeforeCorruption.length,
      "Corrupt orders.json must be recovered from backup, not replaced with an empty list"
    );
    assert.ok(listDataArtifacts().some((name) => name.startsWith("orders.json.corrupt-")), "A copy of the corrupt file should be kept");

    await delay(300); // let background notification snapshots finish writing
    fs.writeFileSync(ORDERS_PATH, "not json", "utf8");
    fs.writeFileSync(`${ORDERS_PATH}.bak`, "not json either", "utf8");
    const orderWithoutBackupResponse = await request({
      port,
      method: "POST",
      pathname: "/api/orders",
      headers: { "X-Forwarded-For": "10.0.1.2" },
      body: {
        name: "Ali",
        phone: "+998900001122",
        delivery: "Tashkent smoke address",
        items: [{ id: product.id, qty: 1, variant: validVariant }],
        total: 0
      }
    });
    assert.equal(orderWithoutBackupResponse.statusCode, 500, "Order must be refused when orders.json is corrupt and has no usable backup");
    assert.equal(fs.readFileSync(ORDERS_PATH, "utf8"), "not json", "Corrupt orders.json must not be overwritten");

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
    snapshots.forEach(([filePath, snapshot]) => restoreFile(filePath, snapshot));
    listDataArtifacts()
      .filter((name) => !artifactsBefore.has(name))
      .forEach((name) => fs.rmSync(path.join(DATA_DIR, name), { force: true }));
  }
}

main();
