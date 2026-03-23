// Core app state, shared helpers, analytics, and catalog bootstrap

const tg = window.Telegram?.WebApp || null;
    
    // Music is configured only through admin-managed settings.
    let audioElement = null;
    let isPlaying = false;

    window.addEventListener("DOMContentLoaded", initAudio);
    const STORAGE_KEYS = {
      cart: "techgear_cart_v1",
      favorites: "techgear_favorites_v1",
      checkout: "techgear_checkout_v1",
      activeView: "techgear_active_view_v1",
      profile: "techgear_profile_v1",
    };

    const CONFIG = {
      requireLocation: false,
      analyticsWebhookUrl: "https://script.google.com/macros/s/AKfycbwHfhqIfh7p1AEGuEDuBg2LeqgQcFS14Mtw9KfpSYAq3JyWINXA41rIp5yGmULwFFxS/exec",
      analyticsEnabled: true,
    };
    const PRODUCT_OPTION_GROUP_PREFIX = "__tg_option_groups__=";
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

    const DEFAULT_APP_SETTINGS = Object.freeze({
      music: {
        enabled: false,
        tracks: [],
        volume: 1
      }
    });

    let audioInitialized = false;
    let audioPromptBound = false;
    let audioTrackIndex = 0;
    let audioSettingsLoaded = false;
    let appSettings = normalizeClientAppSettings(DEFAULT_APP_SETTINGS);

    function normalizeMusicTrackList(value) {
      const source = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/\r?\n|,/) : []);
      return [...new Set(
        source
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )].slice(0, 8);
    }

    function normalizeClientMusicSettings(settings = {}) {
      const tracks = normalizeMusicTrackList(settings?.tracks);
      const parsedVolume = Number(settings?.volume);
      const volume = Number.isFinite(parsedVolume)
        ? Math.min(1, Math.max(0, parsedVolume))
        : 1;

      return {
        enabled: settings?.enabled !== false && tracks.length > 0,
        tracks,
        volume
      };
    }

    function normalizeClientAppSettings(settings = {}) {
      return {
        music: normalizeClientMusicSettings(settings?.music || {})
      };
    }

    function getMusicPrompt() {
      return document.getElementById("musicPrompt");
    }

    function getMuteButton() {
      return document.getElementById("muteBtn");
    }

    function hideMusicUi() {
      const prompt = getMusicPrompt();
      const button = getMuteButton();
      if (prompt) prompt.style.display = "none";
      if (button) button.style.display = "none";
    }

    function showMusicUi() {
      const prompt = getMusicPrompt();
      const button = getMuteButton();
      if (button) button.style.display = "";
      if (prompt) {
        prompt.style.display = isPlaying ? "none" : "";
      }
    }

    function setAudioSource(track) {
      if (!audioElement) return;

      const nextTrack = String(track || "").trim();
      if (!nextTrack) {
        if (audioElement.getAttribute("src")) {
          audioElement.pause();
          audioElement.removeAttribute("src");
          delete audioElement.dataset.trackSrc;
          audioElement.load();
        }
        return;
      }

      if (audioElement.dataset.trackSrc === nextTrack) {
        return;
      }

      audioElement.dataset.trackSrc = nextTrack;
      audioElement.src = nextTrack;
      audioElement.load();
    }

    function syncMusicUi() {
      const music = appSettings.music;
      if (!music.enabled || !music.tracks.length) {
        hideMusicUi();
        isPlaying = false;
        syncAudioButtonState();
        return;
      }

      showMusicUi();
      if (audioElement) {
        audioElement.loop = true;
        audioElement.volume = music.volume;
      }
      syncAudioButtonState();
    }

    function tryPlayAudio() {
      const music = appSettings.music;
      if (!audioElement || !audioSettingsLoaded || !music.enabled || !music.tracks.length) {
        return Promise.resolve();
      }

      setAudioSource(music.tracks[audioTrackIndex] || music.tracks[0]);
      const playPromise = audioElement.play();
      if (playPromise && typeof playPromise.then === "function") {
        return playPromise
          .then(() => {
            isPlaying = true;
            syncAudioButtonState();
            const prompt = getMusicPrompt();
            if (prompt) prompt.style.display = "none";
          })
          .catch((error) => {
            isPlaying = false;
            syncAudioButtonState();
            showMusicUi();
            console.warn("Music autoplay blocked:", error?.name || error);
          });
      }

      isPlaying = !audioElement.paused;
      syncAudioButtonState();
      return Promise.resolve();
    }

    function handleAudioError(error) {
      const music = appSettings.music;
      console.error("Music load error for", audioElement?.src || "", error);
      audioTrackIndex += 1;

      if (audioTrackIndex < music.tracks.length) {
        setAudioSource(music.tracks[audioTrackIndex]);
        tryPlayAudio();
        return;
      }

      console.warn("All configured music sources failed to load");
    }

    function applyMusicSettings(settings = {}, options = {}) {
      const { autoplay = false } = options;
      appSettings = normalizeClientAppSettings(settings);
      audioSettingsLoaded = true;
      audioTrackIndex = 0;

      if (!audioInitialized) {
        return;
      }

      const music = appSettings.music;
      syncMusicUi();

      if (!audioElement) {
        return;
      }

      if (!music.enabled || !music.tracks.length) {
        audioElement.pause();
        setAudioSource("");
        return;
      }

      const shouldResume = autoplay || !audioElement.paused;
      setAudioSource(music.tracks[0]);
      if (shouldResume) {
        tryPlayAudio();
      }
    }

    function initAudio() {
      if (audioInitialized) {
        syncMusicUi();
        return;
      }

      audioElement = document.getElementById("bgm");
      if (!audioElement) return;

      audioInitialized = true;

      if (tg && tg.MainButton) {
        try {
          tg.MainButton.hide();
        } catch (error) {}
      }

      audioElement.addEventListener("play", () => {
        isPlaying = true;
        syncAudioButtonState();
        const prompt = getMusicPrompt();
        if (prompt) prompt.style.display = "none";
      });

      audioElement.addEventListener("pause", () => {
        isPlaying = false;
        syncAudioButtonState();
        if (appSettings.music.enabled && appSettings.music.tracks.length) {
          showMusicUi();
        }
      });

      audioElement.addEventListener("error", handleAudioError);

      const prompt = getMusicPrompt();
      if (prompt && !audioPromptBound) {
        prompt.addEventListener("click", () => {
          tryPlayAudio();
          prompt.style.display = "none";
        });
        audioPromptBound = true;
      }

      const autoplay = () => {
        tryPlayAudio();
      };

      document.addEventListener("click", autoplay, { once: true });
      document.addEventListener("touchstart", autoplay, { once: true });

      syncMusicUi();
      if (audioSettingsLoaded) {
        tryPlayAudio();
      }
    }

    function toggleMute() {
      if (!audioInitialized) {
        initAudio();
      }

      const music = appSettings.music;
      if (!audioElement || !audioSettingsLoaded || !music.enabled || !music.tracks.length) {
        return;
      }

      if (audioElement.paused) {
        tryPlayAudio().catch((error) => console.warn("Music play error:", error));
        return;
      }

      audioElement.pause();
      isPlaying = false;
      syncAudioButtonState();
    }

    function syncAudioButtonState() {
      const btn = getMuteButton();
      if (!btn) return;

      const music = appSettings.music;
      const canPlay = music.enabled && music.tracks.length > 0;
      btn.style.display = canPlay ? "" : "none";
      btn.disabled = !canPlay;
      btn.setAttribute("aria-pressed", isPlaying ? "true" : "false");

      const icon = btn.querySelector(".nav-icon");
      const label = btn.querySelector(".nav-label");
      if (icon) {
        icon.textContent = isPlaying ? "⏸️" : "▶️";
      }

      if (label) {
        label.textContent = isPlaying ? "Музыка: вкл" : "Музыка";
      }

      btn.classList.toggle("active", isPlaying);
    }

    if (tg) {
      tg.ready();
      tg.expand();
      try {
        tg.setHeaderColor("#0b0b0d");
        tg.setBackgroundColor("#0b0b0d");
      } catch (e) {}
    }

    const BOOTSTRAP_PRODUCTS = Array.isArray(window.TECHGEAR_PRODUCTS) ? window.TECHGEAR_PRODUCTS : [];
    const BOOTSTRAP_CATEGORIES = Array.isArray(window.TECHGEAR_CATEGORIES) ? window.TECHGEAR_CATEGORIES : [];
    const BOOTSTRAP_BANNERS = Array.isArray(window.TECHGEAR_BANNERS) ? window.TECHGEAR_BANNERS : [];
    const BOOTSTRAP_SETTINGS = normalizeClientAppSettings(window.TECHGEAR_SETTINGS || DEFAULT_APP_SETTINGS);

    appSettings = BOOTSTRAP_SETTINGS;

    let PRODUCTS = [];
    let CATEGORIES = [];
    let PROMO_BANNERS = [];
    const PRODUCTS_PER_PAGE = 8;
    let catalogLoading = true;

    let state = {
      activeCategory: "all",
      search: "",
      availability: "all",
      sort: "manual",
      productPage: 1,
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

    let toastIdCounter = 0;
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

    const splashState = {
      shownAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
      minVisibleMs: 1100,
      hideTimerId: null,
      hidden: false,
    };

    function getSplashNow() {
      return typeof performance !== "undefined" ? performance.now() : Date.now();
    }

    function hideAppSplash(options = {}) {
      const { immediate = false } = options;
      if (splashState.hidden) return Promise.resolve();

      const splash = document.getElementById("appSplash");
      if (!splash) {
        document.body?.classList.remove("is-booting");
        splashState.hidden = true;
        return Promise.resolve();
      }

      if (splashState.hideTimerId) {
        clearTimeout(splashState.hideTimerId);
        splashState.hideTimerId = null;
      }

      const elapsed = getSplashNow() - splashState.shownAt;
      const waitMs = immediate ? 0 : Math.max(0, splashState.minVisibleMs - elapsed);

      return new Promise((resolve) => {
        const finishHide = () => {
          if (splashState.hidden) {
            resolve();
            return;
          }

          splash.classList.add("is-hiding");
          document.body?.classList.remove("is-booting");

          window.setTimeout(() => {
            splash.classList.add("is-hidden");
            splash.setAttribute("aria-hidden", "true");
            splashState.hidden = true;
            resolve();
          }, 480);
        };

        if (waitMs === 0) {
          finishHide();
          return;
        }

        splashState.hideTimerId = window.setTimeout(finishHide, waitMs);
      });
    }

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

    function normalizeVariantOptionList(value) {
      const source = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/\r?\n|,/) : []);
      return [...new Set(
        source
          .map((item) => normalizeString(item))
          .filter(Boolean)
      )].slice(0, 16);
    }

    function parseProductVariantOptions(variants = []) {
      const parsed = {
        colors: [],
        models: [],
        variants: []
      };

      (Array.isArray(variants) ? variants : []).forEach((item) => {
        const value = normalizeString(item);
        if (!value) return;

        if (value.startsWith(PRODUCT_OPTION_GROUP_PREFIX)) {
          try {
            const payload = JSON.parse(value.slice(PRODUCT_OPTION_GROUP_PREFIX.length));
            parsed.colors = normalizeVariantOptionList(payload?.colors);
            parsed.models = normalizeVariantOptionList(payload?.models);
            return;
          } catch (error) {}
        }

        parsed.variants.push(value);
      });

      parsed.searchableValues = [...parsed.colors, ...parsed.models, ...parsed.variants];
      return parsed;
    }

    function sanitizeLocationInput(value) {
      return String(value || "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 120);
    }

    function formatSelectedVariant(parts = {}) {
      return [parts.color, parts.model, parts.variant]
        .map((item) => normalizeString(item))
        .filter(Boolean)
        .join(" • ");
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
          const variantOptions = parseProductVariantOptions(product.variants);

          return {
            ...product,
            image: images[0] || normalizeString(product.image),
            oldPrice: Number(product.oldPrice) > Number(product.price || 0) ? Number(product.oldPrice) : 0,
            sortOrder: Number.isFinite(product.sortOrder) ? product.sortOrder : index + 1,
            variants: variantOptions.variants,
            variantOptions,
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
      catalogLoading = true;
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
        PRODUCTS = Array.isArray(data.products) ? data.products : BOOTSTRAP_PRODUCTS;
        CATEGORIES = Array.isArray(data.categories) ? data.categories : BOOTSTRAP_CATEGORIES;
        PROMO_BANNERS = Array.isArray(data.banners) ? data.banners : BOOTSTRAP_BANNERS;
        applyMusicSettings(data.settings || BOOTSTRAP_SETTINGS, { autoplay: true });
      } catch (error) {
        PRODUCTS = BOOTSTRAP_PRODUCTS;
        CATEGORIES = BOOTSTRAP_CATEGORIES;
        PROMO_BANNERS = BOOTSTRAP_BANNERS;
        applyMusicSettings(BOOTSTRAP_SETTINGS, { autoplay: true });
        console.warn("Catalog API unavailable, fallback to local data");
      } finally {
        catalogLoading = false;
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
      return true;
    }

    function waitForTelegramUser(attempt = 0) {
      const hydrated = hydrateCheckoutFromTelegram();
      if (hydrated) return;
      if (attempt < 10) {
        setTimeout(() => waitForTelegramUser(attempt + 1), 500);
      }
    }

    function persistCheckoutFields() {
      const customerName = document.getElementById("customerName");
      const customerPhone = document.getElementById("customerPhone");
      const customerUsername = document.getElementById("customerUsername");
      const customerLocation = document.getElementById("customerLocation");
      const customerContactMethod = document.getElementById("customerContactMethod");
      const customerDeliveryTime = document.getElementById("customerDeliveryTime");
      const customerComment = document.getElementById("customerComment");
      const profileDelivery = String(state.profile?.delivery || "").trim();
      if (customerName) customerName.value = sanitizeNameInput(customerName.value);
      if (customerUsername) customerUsername.value = sanitizeUsernameInput(customerUsername.value);
      if (customerLocation) customerLocation.value = sanitizeLocationInput(customerLocation.value);
      if (customerComment) customerComment.value = sanitizeLongText(customerComment.value, 500);

      state.checkout = {
        name: customerName ? customerName.value.trim() : (state.checkout.name || ""),
        phone: customerPhone ? customerPhone.value.trim() : (state.checkout.phone || ""),
        username: customerUsername ? customerUsername.value.trim() : (state.checkout.username || ""),
        delivery: profileDelivery,
        location: customerLocation ? customerLocation.value.trim() : (state.checkout.location || ""),
        contactMethod: customerContactMethod ? customerContactMethod.value : (state.checkout.contactMethod || "telegram"),
        deliveryTime: customerDeliveryTime ? customerDeliveryTime.value : (state.checkout.deliveryTime || "asap"),
        comment: customerComment ? customerComment.value.trim() : (state.checkout.comment || ""),
      };
      saveStorage(STORAGE_KEYS.checkout, state.checkout);
      renderLocationPreview();
    }

    function renderLocationPreview() {
      const preview = document.getElementById("customerLocationPreview");
      if (!preview) return;

      const title = preview.querySelector(".location-preview-title");
      const note = preview.querySelector(".location-preview-note");
      const hasLocation = Boolean(String(state.checkout.location || "").trim());

      preview.classList.toggle("is-ready", hasLocation);

      if (title) {
        title.textContent = hasLocation ? "Локация добавлена" : "Локация не выбрана";
      }

      if (note) {
        note.textContent = hasLocation
          ? "Можно открыть карту и выбрать другое место"
          : "Можно добавить точку на карте в один тап";
      }
    }

    function fillCheckoutFields() {
      const normalizedDelivery = String(state.profile?.delivery || "").trim();
      if (state.checkout.delivery !== normalizedDelivery) {
        state.checkout.delivery = normalizedDelivery;
        saveStorage(STORAGE_KEYS.checkout, state.checkout);
      }

      document.getElementById("customerName").value = state.checkout.name || "";
      document.getElementById("customerPhone").value = state.checkout.phone || "";
      document.getElementById("customerUsername").value = state.checkout.username || "";
      document.getElementById("customerLocation").value = state.checkout.location || "";
      document.getElementById("customerContactMethod").value = state.checkout.contactMethod || "telegram";
      document.getElementById("customerDeliveryTime").value = state.checkout.deliveryTime || "asap";
      document.getElementById("customerComment").value = state.checkout.comment || "";
      renderLocationPreview();
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

    function scheduleToastRemoval(toast, duration) {
      if (!toast) return;
      if (toast.__removeTimer) {
        clearTimeout(toast.__removeTimer);
      }

      toast.__removeTimer = setTimeout(() => {
        toast.classList.add("is-leaving");
        window.setTimeout(() => {
          if (toast.isConnected) {
            toast.remove();
          }
        }, 180);
      }, duration);
    }

    function showToast(message, type = "success", options = {}) {
      const stack = document.getElementById("toastStack");
      const text = String(message || "").trim();
      if (!stack || !text) return;

      const replaceKey = String(options.replaceKey || "").trim();
      const duration = Number(options.duration) || (type === "error" ? 3200 : 2400);
      let toast = replaceKey
        ? [...stack.children].find((node) => node.dataset.toastKey === replaceKey)
        : null;

      if (!toast) {
        toast = document.createElement("div");
        toast.dataset.toastId = `toast-${toastIdCounter++}`;
        if (replaceKey) {
          toast.dataset.toastKey = replaceKey;
        }
        stack.appendChild(toast);
      }

      toast.className = "toast" + (type === "error" ? " error" : type === "info" ? " info" : "");
      toast.textContent = text;
      toast.classList.remove("is-leaving");
      toast.setAttribute("role", type === "error" ? "alert" : "status");

      while (stack.children.length > 3) {
        const oldestToast = stack.firstElementChild;
        if (!oldestToast || oldestToast === toast) break;
        oldestToast.remove();
      }

      scheduleToastRemoval(toast, duration);
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
        showToast("Убрано из избранного");
      } else {
        state.favorites = [...state.favorites, key];
        showToast("Добавлено в избранное");
      }

      saveStorage(STORAGE_KEYS.favorites, state.favorites);
      renderProducts();
      renderFavorites();
      updateFavoritesButton();
    }

    function renderCategorySkeletons(wrap) {
      const widths = [86, 118, 94, 126];
      wrap.innerHTML = widths.map((width) => (
        `<span class="chip chip-skeleton" style="width:${width}px" aria-hidden="true"></span>`
      )).join("");
    }

    function renderCategories() {
      const wrap = document.getElementById("categories");
      if (!wrap) return;
      wrap.innerHTML = "";
      wrap.setAttribute("aria-busy", catalogLoading ? "true" : "false");

      if (catalogLoading) {
        renderCategorySkeletons(wrap);
        return;
      }

      CATEGORIES.forEach((cat) => {
        const btn = document.createElement("button");
        btn.className = "chip" + (cat.key === state.activeCategory ? " active" : "");
        btn.textContent = cat.label;
        btn.onclick = () => {
          state.activeCategory = cat.key;
          state.productPage = 1;
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

      if (searchInput) {
        searchInput.value = state.search;
        searchInput.disabled = catalogLoading;
        searchInput.placeholder = catalogLoading ? "Подключаем каталог..." : "Поиск";
        searchInput.setAttribute("aria-busy", catalogLoading ? "true" : "false");
      }

      if (availabilityFilter) {
        availabilityFilter.value = state.availability;
        availabilityFilter.disabled = catalogLoading;
      }

      if (sortSelect) {
        sortSelect.value = state.sort;
        sortSelect.disabled = catalogLoading;
      }
    }

