// Cart, checkout validation, and order submission

    let isSubmittingOrder = false;

    function formatCartItemToastLabel(item, variant = item?.selectedVariant || "") {
      if (!item) return "Товар";
      return `${item.name}${variant ? ` (${variant})` : ""}`;
    }

    function addToCart(productId, selectedVariant = "") {
      const product = normalizeProducts(PRODUCTS).find((p) => p.id === productId);
      const cartKey = selectedVariant ? `${productId}::${selectedVariant}` : String(productId);
      const existing = state.cart.find((item) => item.cartKey === cartKey);
      if (!product) return;

      if (existing) {
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
          : `Добавлено в корзину: ${formatCartItemToastLabel(product, selectedVariant)}`,
        "success",
        { replaceKey: `cart:${cartKey}` }
      );
    }

    function increaseQty(cartKey) {
      const item = state.cart.find((i) => (i.cartKey || String(i.id)) === cartKey);
      if (!item) return;
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
        showToast(`${itemLabel} удалён из корзины`, "info", { replaceKey: `cart:${cartKey}` });
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
      showToast(`${formatCartItemToastLabel(item)} удалён из корзины`, "info", { replaceKey: `cart:${cartKey}` });
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

      ["customerName", "customerUsername", "customerDelivery", "customerComment"].forEach((id) => {
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
        showToast("Данные профиля подставлены в заказ");
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

    function requestUserLocation() {
      if (!navigator.geolocation) {
        showToast("Геолокация не поддерживается на этом устройстве. Можно продолжить без неё.", "error");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position.coords.latitude).toFixed(6);
          const lon = Number(position.coords.longitude).toFixed(6);
          const value = `${lat}, ${lon}`;
          document.getElementById("customerLocation").value = value;
          persistCheckoutFields();
          showToast("Локация успешно получена");
        },
        () => {
          showToast("Не удалось получить локацию. Можно продолжить и без неё.", "error");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    function buildYandexMapsLink(location) {
      const [lat, lon] = location.split(",").map(part => part.trim());
      if (!lat || !lon) return location;
      return `https://yandex.uz/maps/?pt=${encodeURIComponent(lon)},${encodeURIComponent(lat)}&z=16&l=map`;
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
        ...state.cart.map((item) => `• ${item.name} × ${item.qty} — ${formatPrice((item.price || 0) * item.qty)}`),
        "",
        `Итого: ${formatPrice(payload.total)}`,
      ];

      return lines.filter(Boolean).join("\n");
    }

    async function submitOrderToBackend(payload, orderText) {
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
          orderText,
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
      const customerDeliveryInput = document.getElementById("customerDelivery");
      const customerCommentInput = document.getElementById("customerComment");
      if (customerNameInput) customerNameInput.value = sanitizeNameInput(customerNameInput.value);
      if (customerUsernameInput) customerUsernameInput.value = sanitizeUsernameInput(customerUsernameInput.value);
      if (customerDeliveryInput) customerDeliveryInput.value = sanitizeLongText(customerDeliveryInput.value, 300);
      if (customerCommentInput) customerCommentInput.value = sanitizeLongText(customerCommentInput.value, 500);

      const name = document.getElementById("customerName").value.trim();
      const phone = sanitizePhone(document.getElementById("customerPhone").value.trim());
      const username = telegramUser?.username ? "@" + telegramUser.username : (document.getElementById("customerUsername").value.trim() || "Не указан");
      const contactMethod = document.getElementById("customerContactMethod").value;
      const deliveryTime = document.getElementById("customerDeliveryTime").value;
      const delivery = document.getElementById("customerDelivery").value.trim();
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

      if (!delivery) {
        showToast("Введите точный адрес или ориентир", "error");
        return;
      }

      const total = state.cart.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);
      const payload = { name, phone, username, contactMethod, deliveryTime, delivery, comment, location, total };

      state.checkout = payload;
      saveStorage(STORAGE_KEYS.checkout, state.checkout);

      const orderText = buildOrderText(payload);
      setSubmitOrderState(true);

      try {
        const result = await submitOrderToBackend(payload, orderText);

        if (tg) {
          try {
            tg.sendData(orderText);
          } catch (error) {
            console.warn("Telegram sendData failed:", error);
          }
          try {
            tg.showAlert?.(`Заказ отправлен${result?.orderId ? ` #${result.orderId}` : ""}. Скоро мы свяжемся с вами.`);
          } catch (error) {
            console.warn("Telegram showAlert failed:", error);
          }
          showToast(result?.orderId ? `Заказ отправлен #${result.orderId}` : "Заказ отправлен");
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
          showToast(result?.orderId ? `Заказ отправлен #${result.orderId}` : "Заказ отправлен");
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

    ["customerName", "customerPhone", "customerDelivery", "customerLocation", "customerComment"].forEach((id) => {
      document.getElementById(id).addEventListener("input", persistCheckoutFields);
    });

    ["customerContactMethod", "customerDeliveryTime"].forEach((id) => {
      document.getElementById(id).addEventListener("change", persistCheckoutFields);
    });

    document.getElementById("customerPhone").addEventListener("input", function (e) {
      const formatted = formatPhoneInput(e.target.value);
      e.target.value = formatted;
      persistCheckoutFields();
    });

