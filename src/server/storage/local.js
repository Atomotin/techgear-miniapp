function buildLocalStorageModule({
  createHttpError,
  sanitizeCategories,
  sanitizeProduct,
  sanitizeProducts,
  sanitizeCustomerProfile,
  sanitizePromoBanner,
  sanitizePromoBanners,
  buildDefaultPromoBanners,
  buildOrderRecord,
  loadLegacyCatalog,
  catalogPath,
  ordersPath,
  customersPath,
  bannersPath,
  readJson,
  writeJson,
  ensureDataFiles
}) {
function createLocalStorageProvider() {
  function getCatalog() {
    const catalog = readJson(catalogPath, null);
    if (!catalog) {
      const seeded = loadLegacyCatalog();
      writeJson(catalogPath, seeded);
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

    writeJson(catalogPath, normalized);
    return normalized;
  }

  function getOrders() {
    const orders = readJson(ordersPath, []);
    return Array.isArray(orders) ? orders : [];
  }

  function saveOrders(orders) {
    writeJson(ordersPath, orders);
  }

  function getCustomers() {
    const customers = readJson(customersPath, []);
    return Array.isArray(customers)
      ? customers.map((customer) => sanitizeCustomerProfile(customer)).filter((customer) => customer.key)
      : [];
  }

  function saveCustomers(customers) {
    writeJson(customersPath, customers);
  }

  function getBanners() {
    const banners = readJson(bannersPath, null);
    if (!banners) {
      const seeded = buildDefaultPromoBanners(getCatalog().products);
      writeJson(bannersPath, seeded);
      return seeded;
    }

    const normalized = sanitizePromoBanners(banners);
    if (!normalized.length) {
      const seeded = buildDefaultPromoBanners(getCatalog().products);
      writeJson(bannersPath, seeded);
      return seeded;
    }

    return normalized;
  }

  function saveBanners(banners) {
    const normalized = sanitizePromoBanners(banners);
    writeJson(bannersPath, normalized);
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
    async updateOrderStatus(orderId, status, options = {}) {
      const orders = getOrders();
      const order = orders.find((item) => item.id === orderId);

      if (!order) {
        throw createHttpError(404, "Заказ не найден");
      }

      if (status) {
        order.status = status;
      }

      if (Object.prototype.hasOwnProperty.call(options, "managerNote")) {
        const managerNote = String(options.managerNote || "");
        const requestMeta = { ...(order.requestMeta || {}) };

        requestMeta.adminNote = managerNote;
        if (managerNote) {
          requestMeta.adminNoteUpdatedAt = new Date().toISOString();
        } else {
          delete requestMeta.adminNoteUpdatedAt;
        }

        order.requestMeta = requestMeta;
      }
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

  return {
    createLocalStorageProvider
  };
}

module.exports = {
  buildLocalStorageModule
};
