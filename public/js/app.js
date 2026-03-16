// Core app state, shared helpers, analytics, and catalog bootstrap

const tg = window.Telegram?.WebApp || null;
    
    // Музыка
    let audioElement = null;
    let isPlaying = false;
    const AUDIO_ENABLED = true;
    
    function initAudio() {
      if (!AUDIO_ENABLED) return;
      audioElement = document.getElementById('bgm');
      if (!audioElement) return;
      if (tg && tg.MainButton) {
        try {
          tg.MainButton.hide();
        } catch (error) {}
      }
      
      // Несколько источников на случай, если один не загрузится
      const urls = [
        // 'songs/SQWOZ BAB - TOKYO (zaycev.net).mp3',
        'songs/asrorrrrrga1.mp3',
        // 'https://files.freemusicarchive.org/storage/files/000/000/001/chosic-com-Glance_Back_Lofi_Background_Music_7565.mp3'
      ];
      
      audioElement.src = urls[0];
      audioElement.loop = true;
      audioElement.volume = 1.0;
      
      audioElement.addEventListener('play', () => {
        isPlaying = true;
        updateBtn();
      });
      audioElement.addEventListener('pause', () => {
        isPlaying = false;
        updateBtn();
      });
      let currentIndex = 0;
      audioElement.addEventListener('error', (e) => {
        console.error('Ошибка загрузки музыки для', audioElement.src, e);
        // Попробовать следующий URL
        currentIndex += 1;
        if (currentIndex < urls.length) {
          audioElement.src = urls[currentIndex];
          console.log('Пробуем источник', audioElement.src);
          audioElement.load();
          audioElement.play().catch(err => console.warn('Автозапуск после ошибки заблокирован:', err));
        } else {
          console.warn('Все источники не загрузились');
        }
      });
      
      // Автозапуск при загрузке
      const autoplay = () => {
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            isPlaying = true;
            updateBtn();
            console.log('Музыка успешно запущена');
          }).catch((err) => {
            console.warn('Попытка запуска заблокирована:', err.name);
            // Попробовать снова через 1 секунду
            setTimeout(autoplay, 1000);
          });
        }
      };
      
        // Запустить сразу и при клике/тапе
      console.log('Попытка автозапуска музыки');
      autoplay();
      document.addEventListener('click', autoplay, { once: true });
      document.addEventListener('touchstart', autoplay, { once: true });

      // overlay prompt click hides and triggers
      const prompt = document.getElementById('musicPrompt');
      function promptHide() {
        if (prompt) prompt.style.display = 'none';
      }
      if (prompt) {
        prompt.addEventListener('click', () => {
          autoplay();
          promptHide();
        });
      }
    }
    
    function toggleMute() {
      if (!AUDIO_ENABLED) return;
      if (!audioElement) {
        initAudio();
      }
      
      if (audioElement.paused) {
        audioElement.play().then(() => {
          isPlaying = true;
          updateBtn();
        }).catch(err => console.warn('Ошибка play:', err));
      } else {
        audioElement.pause();
        isPlaying = false;
        updateBtn();
      }
    }
    
    function updateBtn() {
      const btn = document.getElementById('muteBtn');
      if (!btn) return;
      const icon = btn.querySelector(".nav-icon");
      if (icon) {
        icon.textContent = isPlaying ? '⏸️' : '▶️';
      }
    }
    
    // Инициализация после загрузки страницы
    window.addEventListener('DOMContentLoaded', initAudio);
    const STORAGE_KEYS = {
      cart: "techgear_cart_v1",
      favorites: "techgear_favorites_v1",
      checkout: "techgear_checkout_v1",
      activeView: "techgear_active_view_v1",
      profile: "techgear_profile_v1",
    };

    const CONFIG = {
      requireLocation: true,
      analyticsWebhookUrl: "https://script.google.com/macros/s/AKfycbwHfhqIfh7p1AEGuEDuBg2LeqgQcFS14Mtw9KfpSYAq3JyWINXA41rIp5yGmULwFFxS/exec",
      analyticsEnabled: true,
    };
    const IMAGE_FALLBACK_SRC = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#161122"/>
            <stop offset="100%" stop-color="#2f1247"/>
          </linearGradient>
        </defs>
        <rect width="640" height="640" rx="48" fill="url(#bg)"/>
        <g fill="none" stroke="#c6ff33" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">
          <rect x="142" y="176" width="356" height="242" rx="26"/>
          <path d="M208 418v40c0 12 10 22 22 22h180c12 0 22-10 22-22v-40"/>
          <path d="M210 232h0"/>
          <path d="M274 232h156"/>
          <path d="M214 364l72-74 66 58 74-92 62 56"/>
        </g>
        <text x="320" y="538" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="700">TechGear</text>
      </svg>
    `);
    window.__TG_IMAGE_FALLBACK__ = IMAGE_FALLBACK_SRC;

    if (tg) {
      tg.ready();
      tg.expand();
      try {
        tg.setHeaderColor("#0b0b0d");
        tg.setBackgroundColor("#0b0b0d");
      } catch (e) {}
    }

    let PRODUCTS = Array.isArray(window.TECHGEAR_PRODUCTS) ? window.TECHGEAR_PRODUCTS : [];
    let CATEGORIES = Array.isArray(window.TECHGEAR_CATEGORIES) ? window.TECHGEAR_CATEGORIES : [];
    let PROMO_BANNERS = Array.isArray(window.TECHGEAR_BANNERS) ? window.TECHGEAR_BANNERS : [];

    let state = {
      activeCategory: "all",
      search: "",
      availability: "all",
      sort: "manual",
      cart: loadStorage(STORAGE_KEYS.cart, []),
      favorites: loadStorage(STORAGE_KEYS.favorites, []),
      profile: loadStorage(STORAGE_KEYS.profile, {
        name: "",
        phone: "",
        username: "",
        delivery: "",
        comment: "",
      }),
      checkout: loadStorage(STORAGE_KEYS.checkout, {
        name: "",
        phone: "",
        username: "",
        delivery: "",
        location: "",
        contactMethod: "telegram",
        deliveryTime: "asap",
        comment: "",
      }),
      activeView: loadStorage(STORAGE_KEYS.activeView, "shop"),
    };

    let toastTimerId = null;
    let lightboxState = {
      images: [],
      index: 0,
      touchStartX: 0,
    };

    let promoState = {
      slides: [],
      index: 0,
      timerId: null,
      touchStartX: 0,
      touchMoved: false,
      suppressClick: false,
    };

    function getSessionId() {
      const key = "techgear_session_id_v1";
      let sessionId = sessionStorage.getItem(key);
      if (!sessionId) {
        sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem(key, sessionId);
      }
      return sessionId;
    }

    function loadStorage(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch (e) {
        return fallback;
      }
    }

    function saveStorage(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    }

    function escapeHtml(text) {
      return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function normalizeString(value) {
      return String(value ?? "").replace(/\s+/g, " ").trim();
    }

    function formatPrice(value) {
      if (!value) return "Цена по запросу";
      return new Intl.NumberFormat("ru-RU").format(value) + " сум";
    }

    function getDiscountPercent(product) {
      const oldPrice = Number(product?.oldPrice) || 0;
      const price = Number(product?.price) || 0;
      if (!oldPrice || !price || oldPrice <= price) return 0;
      return Math.round(((oldPrice - price) / oldPrice) * 100);
    }

    function renderProductPrice(product) {
      const discount = getDiscountPercent(product);
      const hasDiscount = discount > 0;
      return `
        <div class="price-stack">
          <div class="price-line">
            <div class="price price-current">${formatPrice(product.price)}</div>
            ${hasDiscount ? `<span class="discount-badge">-${discount}%</span>` : ""}
          </div>
          ${hasDiscount ? `<div class="price-old">${formatPrice(product.oldPrice)}</div>` : ""}
        </div>
      `;
    }

    function normalizeProducts(products) {
      if (!Array.isArray(products)) return [];
      return products
        .filter((product) => product && product.isVisible !== false)
        .map((product, index) => {
          const images = [...new Set(
            [product.image, ...(Array.isArray(product.images) ? product.images : [])]
              .map((image) => normalizeString(image))
              .filter(Boolean)
          )];

          return {
            ...product,
            image: images[0] || normalizeString(product.image),
            oldPrice: Number(product.oldPrice) > Number(product.price || 0) ? Number(product.oldPrice) : 0,
            sortOrder: Number.isFinite(product.sortOrder) ? product.sortOrder : index + 1,
            variants: Array.isArray(product.variants) ? product.variants : [],
            images,
            isSoon: typeof product.isSoon === "boolean"
              ? product.isSoon
              : /скоро|под заказ/i.test(product.stock || ""),
          };
        });
    }

    function getTelegramUser() {
      return tg?.initDataUnsafe?.user || null;
    }

    function getPlatformLabel() {
      if (tg?.platform) return tg.platform;
      const ua = navigator.userAgent || "";
      if (/iphone|ipad|ios/i.test(ua)) return "ios_browser";
      if (/android/i.test(ua)) return "android_browser";
      if (/windows|macintosh|linux/i.test(ua)) return "desktop_browser";
      return "unknown";
    }

    function getTelegramDiagnostics() {
      const user = getTelegramUser();
      return {
        has_tg_object: !!tg,
        has_init_data: !!tg?.initData,
        has_init_data_unsafe: !!tg?.initDataUnsafe,
        has_telegram_user: !!user,
        has_username: !!user?.username,
        start_param: tg?.initDataUnsafe?.start_param || "",
        query_id: tg?.initDataUnsafe?.query_id || "",
        chat_type: tg?.initDataUnsafe?.chat_type || "",
        chat_instance: tg?.initDataUnsafe?.chat_instance || "",
        init_data_length: tg?.initData?.length || 0,
        url: window.location.href,
        referrer: document.referrer || "",
        user_agent: navigator.userAgent || "",
      };
    }

    function getAnalyticsPayload(eventName, extra = {}) {
      const user = getTelegramUser();
      const fullName = [user?.first_name || "", user?.last_name || ""].filter(Boolean).join(" ").trim();
      return {
        event: eventName,
        session_id: getSessionId(),
        opened_at: new Date().toISOString(),
        user_id: user?.id || "",
        username: user?.username || "",
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        language_code: user?.language_code || "",
        platform: getPlatformLabel(),
        extra: {
          ...getTelegramDiagnostics(),
          full_name: fullName,
          ...extra,
        },
      };
    }

    async function trackEvent(eventName, extra = {}) {
      if (!CONFIG.analyticsEnabled || !CONFIG.analyticsWebhookUrl) return;

      try {
        await fetch(CONFIG.analyticsWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          mode: "no-cors",
          body: JSON.stringify(getAnalyticsPayload(eventName, extra)),
          keepalive: true,
        });
      } catch (error) {
        console.warn("Analytics error:", error);
      }
    }

    function trackMiniAppOpen() {
      const key = "techgear_open_tracked_v1";
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      trackEvent("mini_app_open", {
        active_view: state.activeView || "shop",
      });
    }

    async function loadCatalogFromApi() {
      const hasBootstrapCatalog = Array.isArray(PRODUCTS) && PRODUCTS.length > 0
        && Array.isArray(CATEGORIES) && CATEGORIES.length > 0;

      if (hasBootstrapCatalog) {
        return;
      }

      try {
        const response = await fetch("/api/catalog/public", {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("catalog_request_failed");
        }

        const data = await response.json();
        if (Array.isArray(data.products) && data.products.length) {
          PRODUCTS = data.products;
        }
        if (Array.isArray(data.categories) && data.categories.length) {
          CATEGORIES = data.categories;
        }
        if (Array.isArray(data.banners) && data.banners.length) {
          PROMO_BANNERS = data.banners;
        }
      } catch (error) {
        console.warn("Catalog API unavailable, fallback to local data");
      }
    }

    function hydrateCheckoutFromTelegram() {
      const user = getTelegramUser();
      const nameInput = document.getElementById("customerName");
      const usernameInput = document.getElementById("customerUsername");

      if (!user) return false;

      if (user.first_name && !state.checkout.name) {
        state.checkout.name = user.first_name;
      }

      if (user.first_name && !state.profile.name) {
        state.profile.name = user.first_name;
      }

      if (user.username) {
        state.checkout.username = "@" + user.username;
        state.profile.username = "@" + user.username;
      }

      if (nameInput && state.checkout.name) {
        nameInput.value = state.checkout.name;
      }

      if (usernameInput) {
        usernameInput.value = state.checkout.username || "";
      }

      saveStorage(STORAGE_KEYS.checkout, state.checkout);
      saveStorage(STORAGE_KEYS.profile, state.profile);
      renderProfile();
      return !!user.username;
    }

    function waitForTelegramUser(attempt = 0) {
      const success = hydrateCheckoutFromTelegram();
      if (success) return;
      if (attempt < 10) {
        setTimeout(() => waitForTelegramUser(attempt + 1), 500);
      }
    }

    function persistCheckoutFields() {
      const customerName = document.getElementById("customerName");
      const customerUsername = document.getElementById("customerUsername");
      const customerDelivery = document.getElementById("customerDelivery");
      const customerComment = document.getElementById("customerComment");
      if (customerName) customerName.value = sanitizeNameInput(customerName.value);
      if (customerUsername) customerUsername.value = sanitizeUsernameInput(customerUsername.value);
      if (customerDelivery) customerDelivery.value = sanitizeLongText(customerDelivery.value, 300);
      if (customerComment) customerComment.value = sanitizeLongText(customerComment.value, 500);

      state.checkout = {
        name: document.getElementById("customerName")?.value.trim() || state.checkout.name || "",
        phone: document.getElementById("customerPhone")?.value.trim() || state.checkout.phone || "",
        username: document.getElementById("customerUsername")?.value.trim() || state.checkout.username || "",
        delivery: document.getElementById("customerDelivery")?.value.trim() || state.checkout.delivery || "",
        location: document.getElementById("customerLocation")?.value.trim() || state.checkout.location || "",
        contactMethod: document.getElementById("customerContactMethod")?.value || state.checkout.contactMethod || "telegram",
        deliveryTime: document.getElementById("customerDeliveryTime")?.value || state.checkout.deliveryTime || "asap",
        comment: document.getElementById("customerComment")?.value.trim() || state.checkout.comment || "",
      };
      saveStorage(STORAGE_KEYS.checkout, state.checkout);
    }

    function fillCheckoutFields() {
      document.getElementById("customerName").value = state.checkout.name || "";
      document.getElementById("customerPhone").value = state.checkout.phone || "";
      document.getElementById("customerUsername").value = state.checkout.username || "";
      document.getElementById("customerDelivery").value = state.checkout.delivery || "";
      document.getElementById("customerLocation").value = state.checkout.location || "";
      document.getElementById("customerContactMethod").value = state.checkout.contactMethod || "telegram";
      document.getElementById("customerDeliveryTime").value = state.checkout.deliveryTime || "asap";
      document.getElementById("customerComment").value = state.checkout.comment || "";
      waitForTelegramUser();
    }

    function fillProfileFields() {
      const mapping = {
        profileName: state.profile.name || "",
        profilePhone: state.profile.phone || "",
        profileUsername: state.profile.username || "",
        profileDelivery: state.profile.delivery || "",
        profileComment: state.profile.comment || "",
      };

      Object.entries(mapping).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
      });

      const avatar = document.getElementById("profileAvatar");
      if (avatar) {
        const source = (state.profile.name || state.profile.username || "TG").replace(/^@/, "").trim();
        avatar.textContent = source.slice(0, 2).toUpperCase();
      }
    }

    function requireRegisteredProfile(message = "Сначала заполни профиль") {
      if (isRegisteredProfile()) return true;
      switchView("profile");
      showToast(message, "error");
      return false;
    }

    function showToast(message, type = "success") {
      const stack = document.getElementById("toastStack");
      if (!stack) return;

      if (toastTimerId) {
        clearTimeout(toastTimerId);
      }

      stack.innerHTML = "";
      const toast = document.createElement("div");
      toast.className = "toast" + (type === "error" ? " error" : "");
      toast.textContent = message;
      stack.appendChild(toast);

      toastTimerId = setTimeout(() => {
        toast.remove();
      }, 2600);
    }

    function getCardDescription(product) {
      const description = normalizeString(product?.desc);
      if (!description) return "";
      return description.length > 84 ? `${description.slice(0, 81).trimEnd()}...` : description;
    }

    function isFavorite(productId) {
      return state.favorites.includes(String(productId));
    }

    function getFavoriteProducts() {
      const favoriteIds = new Set(state.favorites.map(String));
      return normalizeProducts(PRODUCTS).filter((product) => favoriteIds.has(String(product.id)));
    }

    function toggleFavorite(productId) {
      const key = String(productId);
      if (isFavorite(key)) {
        state.favorites = state.favorites.filter((id) => String(id) !== key);
        showToast("Товар убран из избранного");
      } else {
        state.favorites = [...state.favorites, key];
        showToast("Товар добавлен в избранное");
      }

      saveStorage(STORAGE_KEYS.favorites, state.favorites);
      renderProducts();
      renderFavorites();
      updateFavoritesButton();
    }

    function renderCategories() {
      const wrap = document.getElementById("categories");
      wrap.innerHTML = "";

      CATEGORIES.forEach((cat) => {
        const btn = document.createElement("button");
        btn.className = "chip" + (cat.key === state.activeCategory ? " active" : "");
        btn.textContent = cat.label;
        btn.onclick = () => {
          state.activeCategory = cat.key;
          renderCategories();
          renderProducts();
        };
        wrap.appendChild(btn);
      });
    }

    function setToolbarState() {
      const searchInput = document.getElementById("searchInput");
      const availabilityFilter = document.getElementById("availabilityFilter");
      const sortSelect = document.getElementById("sortSelect");

      if (searchInput) searchInput.value = state.search;
      if (availabilityFilter) availabilityFilter.value = state.availability;
      if (sortSelect) sortSelect.value = state.sort;
    }

