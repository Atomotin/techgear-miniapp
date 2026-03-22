// Cart, checkout validation, and order submission

    let isSubmittingOrder = false;
    const MAX_CART_ITEM_QTY = 20;
    const DEFAULT_LOCATION_PICKER_CENTER = Object.freeze({ lat: 41.311081, lon: 69.240562 });
    const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    const LEAFLET_CSS_INTEGRITY = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    const LEAFLET_JS_INTEGRITY = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    const locationPickerState = {
      assetsPromise: null,
      map: null,
      marker: null,
      pendingLocation: ""
    };

    function formatCartItemToastLabel(item, variant = item?.selectedVariant || "") {
      if (!item) return "Товар";
      return `${item.name}${variant ? ` (${variant})` : ""}`;
    }

    function addToCart(productId, selectedVariant = "") {
      const product = normalizeProducts(PRODUCTS).find((p) => p.id === productId);
      if (!product) return;
      const cartKey = selectedVariant ? `${productId}::${selectedVariant}` : String(productId);
      const existing = state.cart.find((item) => item.cartKey === cartKey);

      if (existing) {
        if (existing.qty >= MAX_CART_ITEM_QTY) {
          showToast(`Максимум ${MAX_CART_ITEM_QTY} шт. для ${formatCartItemToastLabel(existing)}`, "error", {
            replaceKey: `cart-limit:${cartKey}`
          });
          return;
        }
        existing.qty += 1;
      } else {
        state.cart.push({
          ...product,
          qty: 1,
          selectedVariant,
          cartKey,
        });
      }

      persistCart();
      renderCart();
      updateCartButton();
      tg?.HapticFeedback?.impactOccurred?.("light");
      showToast(
        existing
          ? `${formatCartItemToastLabel(existing)}: теперь ${existing.qty} шт.`
          : `В корзине: ${formatCartItemToastLabel(product, selectedVariant)}`,
        "success",
        { replaceKey: `cart:${cartKey}` }
      );
    }

    function increaseQty(cartKey) {
      const item = state.cart.find((i) => (i.cartKey || String(i.id)) === cartKey);
      if (!item) return;
      if (item.qty >= MAX_CART_ITEM_QTY) {
        showToast(`Максимум ${MAX_CART_ITEM_QTY} шт. для ${formatCartItemToastLabel(item)}`, "error", {
          replaceKey: `cart-limit:${cartKey}`
        });
        return;
      }
      item.qty += 1;
      persistCart();
      renderCart();
      updateCartButton();
      showToast(`${formatCartItemToastLabel(item)}: ${item.qty} шт.`, "info", { replaceKey: `cart:${cartKey}` });
    }

    function decreaseQty(cartKey) {
      const item = state.cart.find((i) => (i.cartKey || String(i.id)) === cartKey);
      if (!item) return;
      item.qty -= 1;
      const itemLabel = formatCartItemToastLabel(item);
      if (item.qty <= 0) {
        state.cart = state.cart.filter((i) => (i.cartKey || String(i.id)) !== cartKey);
        showToast(`${itemLabel} удалён`, "info", { replaceKey: `cart:${cartKey}` });
      } else {
        showToast(`${itemLabel}: ${item.qty} шт.`, "info", { replaceKey: `cart:${cartKey}` });
      }
      persistCart();
      renderCart();
      updateCartButton();
    }

    function removeItem(cartKey) {
      const item = state.cart.find((i) => (i.cartKey || String(i.id)) === cartKey);
      state.cart = state.cart.filter((i) => (i.cartKey || String(i.id)) !== cartKey);
      persistCart();
      renderCart();
      updateCartButton();
      showToast(`${formatCartItemToastLabel(item)} удалён`, "info", { replaceKey: `cart:${cartKey}` });
    }

    function clearCart() {
      if (!state.cart.length) {
        showToast("Корзина уже пустая");
        return;
      }

      state.cart = [];
      persistCart();
      renderCart();
      updateCartButton();
      showToast("Корзина очищена");
    }

    function persistCart() {
      saveStorage(STORAGE_KEYS.cart, state.cart);
    }

    function setSubmitOrderState(isSubmitting) {
      isSubmittingOrder = Boolean(isSubmitting);
      const submitBtn = document.getElementById("submitOrderBtn");
      if (!submitBtn) return;

      if (!submitBtn.dataset.defaultLabel) {
        submitBtn.dataset.defaultLabel = submitBtn.textContent.trim();
      }

      submitBtn.disabled = !state.cart.length || isSubmittingOrder;
      submitBtn.textContent = isSubmittingOrder
        ? "Отправляем заказ..."
        : submitBtn.dataset.defaultLabel;
    }

    function renderCart() {
      const wrap = document.getElementById("cartItems");
      const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
      const uniqueItems = state.cart.length;
      const total = state.cart.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);

      document.getElementById("summaryItems").textContent = totalItems;
      document.getElementById("summaryUniqueItems").textContent = uniqueItems;
      document.getElementById("summaryTotal").textContent = formatPrice(total);

      const submitBtn = document.getElementById("submitOrderBtn");
      if (submitBtn) {
        submitBtn.disabled = !state.cart.length || isSubmittingOrder;
      }

      if (!state.cart.length) {
        wrap.innerHTML = '<div class="empty-text">Корзина пока пустая.</div>';
        return;
      }

      wrap.innerHTML = "";
      state.cart.forEach((item) => {
        const div = document.createElement("div");
        div.className = "cart-item";
        const itemKey = item.cartKey || String(item.id);
        div.innerHTML = `
          <div class="cart-top">
            <div>
              <h4>${escapeHtml(item.name)}</h4>
              ${item.selectedVariant ? `<div class="hint">${escapeHtml(item.selectedVariant)}</div>` : ""}
              <div class="cart-price">${formatPrice(item.price)}</div>
            </div>
            <button class="btn btn-danger cart-remove-btn" type="button" onclick="removeItem('${escapeHtml(itemKey)}')">✕</button>
          </div>
          <div class="cart-actions">
            <div class="qty-controls">
              <button type="button" onclick="decreaseQty('${escapeHtml(itemKey)}')">-</button>
              <span>${item.qty}</span>
              <button type="button" onclick="increaseQty('${escapeHtml(itemKey)}')">+</button>
            </div>
            <div><strong>${formatPrice((item.price || 0) * item.qty)}</strong></div>
          </div>
        `;
        wrap.appendChild(div);
      });
    }

    function bindProfileControls() {
      ["profileName", "profilePhone", "profileUsername", "profileDelivery", "profileComment"].forEach((id) => {
        document.getElementById(id)?.addEventListener("input", persistProfileFields);
      });

      ["customerName", "customerUsername", "customerComment"].forEach((id) => {
        document.getElementById(id)?.addEventListener("input", persistCheckoutFields);
      });

      document.getElementById("saveProfileBtn")?.addEventListener("click", async () => {
        const wasLocked = !isRegisteredProfile();
        persistProfileFields();
        applyProfileToCheckout();
        try {
          await saveProfileToServer();
          updateProfileOnboardingState();
          renderProfile();
          if (wasLocked && isRegisteredProfile()) {
            switchView("shop");
          }
          showToast("Профиль сохранён");
        } catch (error) {
          showToast(error.message || "Не удалось сохранить профиль", "error");
        }
      });

      document.getElementById("fillCheckoutBtn")?.addEventListener("click", () => {
        persistProfileFields();
        applyProfileToCheckout();
        switchView("cart");
        showToast("Профиль подставлен в заказ");
      });
    }

    function sanitizePhone(phone) {
      return phone.replace(/[^\d+]/g, "").trim();
    }

    function formatPhoneInput(value) {
      const digits = value.replace(/\D/g, "");
      if (!digits) return "";

      let normalized = digits;
      if (normalized.startsWith("998")) {
        normalized = normalized.slice(0, 12);
      } else if (normalized.startsWith("8")) {
        normalized = "998" + normalized.slice(1, 10);
      } else {
        normalized = ("998" + normalized).slice(0, 12);
      }

      const parts = [
        normalized.slice(0, 3),
        normalized.slice(3, 5),
        normalized.slice(5, 8),
        normalized.slice(8, 10),
        normalized.slice(10, 12),
      ].filter(Boolean);

      let formatted = "+" + parts[0];
      if (parts[1]) formatted += " " + parts[1];
      if (parts[2]) formatted += " " + parts[2];
      if (parts[3]) formatted += " " + parts[3];
      if (parts[4]) formatted += " " + parts[4];
      return formatted;
    }

    function stripEmoji(value) {
      return String(value || "").replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, "");
    }

    function sanitizeNameInput(value) {
      return stripEmoji(value)
        .replace(/[0-9]/g, "")
        .replace(/[^\p{L}\s'-]/gu, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 100);
    }

    function sanitizeUsernameInput(value) {
      return stripEmoji(String(value || ""))
        .replace(/\s+/g, "")
        .replace(/[^A-Za-z0-9_@]/g, "")
        .replace(/^@(.*)@+/g, "@$1")
        .slice(0, 50);
    }

    function sanitizeLongText(value, maxLength) {
      return stripEmoji(String(value || ""))
        .replace(/\s{3,}/g, "  ")
        .trim()
        .slice(0, maxLength);
    }

    function parseLocationCoordinates(location) {
      const match = String(location || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
      if (!match) return null;

      const lat = Number(match[1]);
      const lon = Number(match[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

      return { lat, lon };
    }

    function getCurrentUserCoordinates() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Геолокация не поддерживается на этом устройстве."));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: Number(position.coords.latitude),
              lon: Number(position.coords.longitude)
            });
          },
          () => reject(new Error("Не удалось получить локацию.")),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    function formatLocationValue(lat, lon) {
      return `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`;
    }

    function ensureLeafletAssets() {
      if (window.L) {
        return Promise.resolve(window.L);
      }

      if (locationPickerState.assetsPromise) {
        return locationPickerState.assetsPromise;
      }

      if (!document.getElementById("leafletStylesheet")) {
        const link = document.createElement("link");
        link.id = "leafletStylesheet";
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS_URL;
        link.integrity = LEAFLET_CSS_INTEGRITY;
        link.crossOrigin = "";
        document.head.appendChild(link);
      }

      locationPickerState.assetsPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById("leafletScript");
        const handleLoad = () => {
          if (window.L) {
            resolve(window.L);
            return;
          }

          reject(new Error("leaflet_unavailable"));
        };
        const handleError = () => reject(new Error("leaflet_load_failed"));

        if (existingScript) {
          existingScript.addEventListener("load", handleLoad, { once: true });
          existingScript.addEventListener("error", handleError, { once: true });
          return;
        }

        const script = document.createElement("script");
        script.id = "leafletScript";
        script.src = LEAFLET_JS_URL;
        script.integrity = LEAFLET_JS_INTEGRITY;
        script.crossOrigin = "";
        script.async = true;
        script.addEventListener("load", handleLoad, { once: true });
        script.addEventListener("error", handleError, { once: true });
        document.body.appendChild(script);
      }).catch((error) => {
        locationPickerState.assetsPromise = null;
        throw error;
      });

      return locationPickerState.assetsPromise;
    }

    function updateLocationPickerStatus() {
      const title = document.getElementById("locationPickerStatusTitle");
      const note = document.getElementById("locationPickerStatusNote");
      const saveBtn = document.getElementById("locationPickerSave");
      const hasPoint = Boolean(locationPickerState.pendingLocation);

      if (title) {
        title.textContent = hasPoint ? "Точка выбрана" : "Точка ещё не выбрана";
      }

      if (note) {
        note.textContent = hasPoint
          ? "Если нужно, просто тапни по другому месту на карте"
          : "Тапни по карте, чтобы поставить метку в удобном месте";
      }

      if (saveBtn) {
        saveBtn.disabled = !hasPoint;
      }
    }

    function clearLocationPickerMarker() {
      if (locationPickerState.map && locationPickerState.marker) {
        locationPickerState.map.removeLayer(locationPickerState.marker);
      }

      locationPickerState.marker = null;
      locationPickerState.pendingLocation = "";
      updateLocationPickerStatus();
    }

    function setLocationPickerPoint(lat, lon, options = {}) {
      const { center = true } = options;
      if (!locationPickerState.map || !window.L) return;

      const point = [Number(lat), Number(lon)];
      if (!locationPickerState.marker) {
        locationPickerState.marker = window.L.marker(point).addTo(locationPickerState.map);
      } else {
        locationPickerState.marker.setLatLng(point);
      }

      locationPickerState.pendingLocation = formatLocationValue(point[0], point[1]);
      if (center) {
        locationPickerState.map.setView(point, Math.max(locationPickerState.map.getZoom() || 16, 16), { animate: false });
      }

      updateLocationPickerStatus();
    }

    function initLocationPickerMap() {
      if (locationPickerState.map || !window.L) return;

      locationPickerState.map = window.L.map("locationPickerMap", {
        zoomControl: true
      });

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(locationPickerState.map);

      locationPickerState.map.on("click", (event) => {
        setLocationPickerPoint(event.latlng.lat, event.latlng.lng);
      });
    }

    function syncLocationPickerFromCheckout() {
      if (!locationPickerState.map) return;

      const currentValue = document.getElementById("customerLocation")?.value || state.checkout.location || "";
      const coords = parseLocationCoordinates(currentValue);
      if (coords) {
        setLocationPickerPoint(coords.lat, coords.lon);
        return;
      }

      clearLocationPickerMarker();
      locationPickerState.map.setView([DEFAULT_LOCATION_PICKER_CENTER.lat, DEFAULT_LOCATION_PICKER_CENTER.lon], 12, { animate: false });
    }

    function requestUserLocation() {
      getCurrentUserCoordinates()
        .then(({ lat, lon }) => {
          const value = formatLocationValue(lat, lon);
          document.getElementById("customerLocation").value = value;
          persistCheckoutFields();
          showToast("Локация получена");
        })
        .catch(() => {
          showToast("Не удалось получить локацию. Можно продолжить и без неё.", "error");
        });
    }

    function openLocationPicker() {
      const modal = document.getElementById("locationPickerModal");
      if (!modal) return;

      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");

      ensureLeafletAssets()
        .then(() => {
          initLocationPickerMap();
          syncLocationPickerFromCheckout();
          window.setTimeout(() => {
            locationPickerState.map?.invalidateSize();
          }, 40);
        })
        .catch(() => {
          closeLocationPicker();
          showToast("Не удалось загрузить карту. Можно использовать автолокацию.", "error");
        });
    }

    function closeLocationPicker() {
      const modal = document.getElementById("locationPickerModal");
      if (!modal) return;
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }

    function applyLocationPickerSelection() {
      if (!locationPickerState.pendingLocation) {
        showToast("Сначала выбери точку на карте", "error");
        return;
      }

      const input = document.getElementById("customerLocation");
      if (!input) return;

      input.value = locationPickerState.pendingLocation;
      persistCheckoutFields();
      closeLocationPicker();
      showToast("Точка на карте сохранена");
    }

    function useCurrentLocationInPicker() {
      const button = document.getElementById("locationPickerMyLocation");
      const defaultText = button?.textContent || "";

      if (button) {
        button.disabled = true;
        button.textContent = "Ищем...";
      }

      getCurrentUserCoordinates()
        .then(({ lat, lon }) => {
          setLocationPickerPoint(lat, lon);
        })
        .catch(() => {
          showToast("Не удалось получить текущую локацию", "error");
        })
        .finally(() => {
          if (button) {
            button.disabled = false;
            button.textContent = defaultText;
          }
        });
    }

    function clearUserLocation() {
      const input = document.getElementById("customerLocation");
      if (!input) return;
      input.value = "";
      clearLocationPickerMarker();
      persistCheckoutFields();
      showToast("Локация очищена", "info");
    }

    function buildYandexMapsLink(location) {
      const coords = parseLocationCoordinates(location);
      if (!coords) return "";
      return `https://yandex.uz/maps/?pt=${encodeURIComponent(coords.lon)},${encodeURIComponent(coords.lat)}&z=16&l=map`;
    }

    function buildOrderText(payload) {
      const user = getTelegramUser();
      const tgMeta = [];
      if (user?.id) tgMeta.push(`Telegram ID: ${user.id}`);
      if (user?.username) tgMeta.push(`Telegram профиль: @${user.username}`);

      const lines = [
        "Новый заказ TechGear",
        "",
        `Имя: ${payload.name}`,
        `Телефон: ${payload.phone}`,
        `Telegram username: ${payload.username}`,
        `Способ связи: ${payload.contactMethod}`,
        `Когда удобно: ${payload.deliveryTime}`,
        `Адрес / ориентир: ${payload.delivery}`,
        `Комментарий: ${payload.comment || "Нет"}`,
        `Локация: ${payload.location || "Не указана"}`,
        ...tgMeta,
        payload.location ? `Yandex Maps: ${buildYandexMapsLink(payload.location)}` : "",
        "",
        "Товары:",
        ...state.cart.map((item) => `• ${item.name}${item.selectedVariant ? ` (${item.selectedVariant})` : ""} × ${item.qty} — ${formatPrice((item.price || 0) * item.qty)}`),
        "",
        `Итого: ${formatPrice(payload.total)}`,
      ];

      return lines.filter(Boolean).join("\n");
    }

    async function submitOrderToBackend(payload) {
      const user = getTelegramUser();
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          items: state.cart.map((item) => ({
            id: item.id,
            name: item.name,
            qty: item.qty,
            variant: item.selectedVariant || "",
            price: item.price || 0,
          })),
          telegram: {
            id: user?.id || "",
            username: user?.username || "",
            first_name: user?.first_name || "",
            last_name: user?.last_name || "",
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Не удалось сохранить заказ. Попробуйте ещё раз.");
      }

      return data;
    }

    async function submitOrder() {
      if (isSubmittingOrder) {
        return;
      }
      if (!state.cart.length) {
        showToast("Корзина пустая", "error");
        return;
      }

      const telegramUser = getTelegramUser();
      const customerNameInput = document.getElementById("customerName");
      const customerUsernameInput = document.getElementById("customerUsername");
      const customerCommentInput = document.getElementById("customerComment");
      if (customerNameInput) customerNameInput.value = sanitizeNameInput(customerNameInput.value);
      if (customerUsernameInput) customerUsernameInput.value = sanitizeUsernameInput(customerUsernameInput.value);
      if (customerCommentInput) customerCommentInput.value = sanitizeLongText(customerCommentInput.value, 500);

      const name = document.getElementById("customerName").value.trim();
      const phone = sanitizePhone(document.getElementById("customerPhone").value.trim());
      const username = telegramUser?.username ? "@" + telegramUser.username : (document.getElementById("customerUsername").value.trim() || "");
      const contactMethod = document.getElementById("customerContactMethod").value;
      const deliveryTime = document.getElementById("customerDeliveryTime").value;
      const delivery = String(state.profile?.delivery || state.checkout.delivery || "").trim();
      const comment = document.getElementById("customerComment").value.trim();
      const location = document.getElementById("customerLocation").value.trim();

      if (!name) {
        showToast("Введите ваше имя", "error");
        return;
      }

      if (name.length > 100) {
        showToast("Имя слишком длинное", "error");
        return;
      }

      if (!/^[\p{L}\s'-]+$/u.test(name)) {
        showToast("В имени нельзя цифры и эмодзи", "error");
        return;
      }

      if (!phone) {
        showToast("Введите номер телефона", "error");
        return;
      }

      if (phone.replace(/\D/g, "").length < 9) {
        showToast("Введите корректный номер телефона", "error");
        return;
      }

      if (!delivery && !location) {
        showToast("Выбери точку на карте или укажи адрес в профиле", "error");
        return;
      }

      const total = state.cart.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);
      const payload = { name, phone, username, contactMethod, deliveryTime, delivery, comment, location, total };

      state.checkout = payload;
      saveStorage(STORAGE_KEYS.checkout, state.checkout);

      const orderText = buildOrderText(payload);
      setSubmitOrderState(true);

      try {
        const result = await submitOrderToBackend(payload);

        if (tg) {
          try {
            tg.showAlert?.(`Заказ отправлен${result?.orderId ? ` #${result.orderId}` : ""}. Скоро мы свяжемся с вами.`);
          } catch (error) {
            console.warn("Telegram showAlert failed:", error);
          }
          showToast(result?.orderId ? `Заказ принят #${result.orderId}` : "Заказ принят");
          trackEvent("order_submitted", {
            order_id: result?.orderId || "",
            total,
            items: state.cart.map((item) => ({
              id: item.id,
              name: item.name,
              qty: item.qty,
              variant: item.selectedVariant || "",
            })),
          });
        } else {
          showToast(result?.orderId ? `Заказ принят #${result.orderId}` : "Заказ принят");
          console.log(orderText);
        }

        state.cart = [];
        persistCart();
        renderCart();
        updateCartButton();
        switchView("shop");
      } catch (error) {
        console.warn("Order submission failed:", error);
        showToast(error.message || "Не удалось отправить заказ. Корзина сохранена.", "error");
      } finally {
        setSubmitOrderState(false);
      }
    }

    ["customerName", "customerPhone", "customerLocation", "customerComment"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", persistCheckoutFields);
    });

    ["customerContactMethod", "customerDeliveryTime"].forEach((id) => {
      document.getElementById(id).addEventListener("change", persistCheckoutFields);
    });

    document.getElementById("customerPhone").addEventListener("input", function (e) {
      const formatted = formatPhoneInput(e.target.value);
      e.target.value = formatted;
      persistCheckoutFields();
    });

    document.getElementById("locationPickerClose")?.addEventListener("click", closeLocationPicker);
    document.getElementById("locationPickerCancel")?.addEventListener("click", closeLocationPicker);
    document.getElementById("locationPickerSave")?.addEventListener("click", applyLocationPickerSelection);
    document.getElementById("locationPickerMyLocation")?.addEventListener("click", useCurrentLocationInPicker);
    document.getElementById("locationPickerModal")?.addEventListener("click", (event) => {
      if (event.target?.id === "locationPickerModal") {
        closeLocationPicker();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (document.getElementById("locationPickerModal")?.classList.contains("hidden")) return;
      closeLocationPicker();
    });

