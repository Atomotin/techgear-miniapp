function buildSupabaseStorageModule({
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
  bannersPath,
  supabaseEnabled,
  supabaseRestUrl,
  supabaseStorageUrl,
  supabaseServiceRoleKey,
  supabaseUploadBucket,
  uploadExtensions,
  readJson,
  writeJson,
  getFallbackCustomers,
  upsertFallbackCustomerProfile,
  shouldUseCustomerFallback,
  shouldUseBannerFallback,
  categoryRowToModel,
  productRowToModel,
  productModelToRow,
  orderRowToModel,
  orderModelToRow,
  customerRowToModel,
  customerModelToRow,
  bannerRowToModel,
  bannerModelToRow
}) {
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

function isMissingBucketError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.statusCode === 404 || message.includes("bucket not found");
}

async function supabaseRequest(method, resource, { query = "", body, prefer, headers = {} } = {}) {
  if (!supabaseEnabled) {
    throw createHttpError(500, "Supabase is not configured");
  }

  const response = await fetch(`${supabaseRestUrl}/${resource}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
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
  if (!supabaseEnabled) {
    throw createHttpError(500, "Supabase is not configured");
  }

  const response = await fetch(`${supabaseStorageUrl}/${resourcePath}`, {
    method,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
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
  if (!supabaseEnabled) {
    return false;
  }

  if (uploadBucketReadyPromise) {
    return uploadBucketReadyPromise;
  }

  uploadBucketReadyPromise = (async () => {
    try {
      await supabaseStorageRequest("GET", `bucket/${encodeURIComponent(supabaseUploadBucket)}`);
      return true;
    } catch (error) {
      if (!isMissingBucketError(error)) {
        throw error;
      }

      await supabaseStorageRequest("POST", "bucket", {
        body: JSON.stringify({
          id: supabaseUploadBucket,
          name: supabaseUploadBucket,
          public: true,
          allowed_mime_types: Array.from(uploadExtensions.keys())
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
  await supabaseStorageRequest("POST", `object/${encodeURIComponent(supabaseUploadBucket)}/${objectPath}`, {
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
    path: `${supabaseStorageUrl}/object/public/${supabaseUploadBucket}/${objectPath}`,
    fileName,
    storage: "supabase"
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
          banners = readJson(bannersPath, buildDefaultPromoBanners(catalog.products));
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
          return readJson(bannersPath, buildDefaultPromoBanners(loadLegacyCatalog().products));
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
          const banners = readJson(bannersPath, buildDefaultPromoBanners(loadLegacyCatalog().products));
          const nextId = banners.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
          banners.unshift(sanitizePromoBanner(body, nextId));
          writeJson(bannersPath, sanitizePromoBanners(banners));
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
          const banners = readJson(bannersPath, buildDefaultPromoBanners(loadLegacyCatalog().products));
          const index = banners.findIndex((item) => Number(item.id) === bannerId);
          if (index === -1) {
            throw createHttpError(404, "Баннер не найден");
          }
          banners[index] = sanitizePromoBanner({ ...banners[index], ...body, id: bannerId }, bannerId);
          writeJson(bannersPath, sanitizePromoBanners(banners));
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
          const banners = readJson(bannersPath, buildDefaultPromoBanners(loadLegacyCatalog().products));
          const nextBanners = banners.filter((item) => Number(item.id) !== bannerId);
          if (nextBanners.length === banners.length) {
            throw createHttpError(404, "Баннер не найден");
          }
          writeJson(bannersPath, sanitizePromoBanners(nextBanners));
          return sanitizePromoBanners(nextBanners);
        }
        throw error;
      }

      return this.getBanners();
    }
  };
}

  return {
    createSupabaseStorageProvider,
    ensureSupabaseUploadBucket,
    uploadBinaryToSupabaseStorage
  };
}

module.exports = {
  buildSupabaseStorageModule
};
