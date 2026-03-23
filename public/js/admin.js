    const DEFAULT_ADMIN_SECTION = "orders";
    const ADMIN_SECTIONS = new Set(["overview", "products", "categories", "orders", "customers", "banners", "music"]);

    function normalizeAdminSection(sectionKey) {
      return ADMIN_SECTIONS.has(sectionKey) ? sectionKey : DEFAULT_ADMIN_SECTION;
    }

    function getHashAdminSection() {
      const hashValue = String(window.location.hash || "").replace(/^#\/?/, "").trim().toLowerCase();
      return ADMIN_SECTIONS.has(hashValue) ? hashValue : "";
    }

    function syncAdminSectionHash(sectionKey, { replace = false } = {}) {
      const normalizedSection = normalizeAdminSection(sectionKey);
      const nextHash = `#${normalizedSection}`;
      if (window.location.hash === nextHash) return;

      if (replace) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
        return;
      }

      window.location.hash = normalizedSection;
    }

    function getInitialAdminSection() {
      const hashSection = getHashAdminSection();
      if (hashSection) return hashSection;

      const savedSection = localStorage.getItem("techgear_admin_section");
      return normalizeAdminSection(savedSection);
    }

    const state = {
      token: localStorage.getItem("techgear_admin_token") || "",
      catalog: { categories: [], products: [] },
      orders: [],
      customers: [],
      banners: [],
      settings: {
        music: {
          enabled: false,
          tracks: [],
          volume: 1
        }
      },
      runtime: null,
      editingId: null,
      editingBannerId: null,
      uploadedImages: [],
      orderSearch: "",
      orderStatusFilter: "all",
      orderDateFilter: "all",
      orderAssigneeFilter: "all",
      orderCustomerKeyFilter: "",
      orderCustomerLabelFilter: "",
      customerSearch: "",
      activeSection: getInitialAdminSection(),
      productDraftSnapshot: null,
      bannerDraftSnapshot: null
    };

    const ORDER_NOTE_TEMPLATES = [
      { key: "call-later", label: "Позвонить позже", text: "Позвонить клиенту позже." },
      { key: "need-address", label: "Уточнить адрес", text: "Уточнить адрес доставки." },
      { key: "need-variant", label: "Уточнить вариант", text: "Уточнить цвет или вариант товара." },
      { key: "out-of-stock", label: "Нет в наличии", text: "Сообщить клиенту, что товара нет в наличии." },
      { key: "waiting-confirmation", label: "Ждём ответ", text: "Ожидаем подтверждение заказа от клиента." }
    ];
    const PRODUCT_OPTION_GROUP_PREFIX = "__tg_option_groups__=";
    const DISPLAY_TIME_ZONE = "Asia/Tashkent";

    async function api(path, options = {}) {
      const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
      }

      const response = await fetch(path, { ...options, headers });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      return data;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function formatPrice(value) {
      if (!value) return "Цена по запросу";
      return new Intl.NumberFormat("ru-RU").format(value) + " сум";
    }

    function formatAmount(value) {
      return `${new Intl.NumberFormat("ru-RU").format(Number(value) || 0)} сум`;
    }

    function formatDateTime(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: DISPLAY_TIME_ZONE
      }).format(date);
    }

    function parseLocationCoordinates(value) {
      const match = String(value || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
      if (!match) return null;

      const lat = Number(match[1]);
      const lon = Number(match[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

      return { lat, lon };
    }

    function buildCustomerLocationLink(location) {
      const coords = parseLocationCoordinates(location);
      if (!coords) return "";
      return `https://yandex.com/maps/?pt=${coords.lon},${coords.lat}&z=17&l=map`;
    }

    function getCustomerAddressLabel(customer = {}) {
      const delivery = String(customer.delivery || "").trim();
      if (delivery) return delivery;
      return buildCustomerLocationLink(customer.location) ? "Точка на карте выбрана" : "Адрес не указан";
    }

    function getDiscountPercent(product) {
      const oldPrice = Number(product?.oldPrice) || 0;
      const price = Number(product?.price) || 0;
      if (!oldPrice || !price || oldPrice <= price) return 0;
      return Math.round(((oldPrice - price) / oldPrice) * 100);
    }

    function normalizeAdminOptionList(value) {
      const source = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/\r?\n|,/) : []);
      return [...new Set(
        source
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )].slice(0, 16);
    }

    function parseProductOptionGroups(variants = []) {
      const parsed = { colors: [], models: [], variants: [] };

      (Array.isArray(variants) ? variants : []).forEach((item) => {
        const value = String(item || "").trim();
        if (!value) return;

        if (value.startsWith(PRODUCT_OPTION_GROUP_PREFIX)) {
          try {
            const payload = JSON.parse(value.slice(PRODUCT_OPTION_GROUP_PREFIX.length));
            parsed.colors = normalizeAdminOptionList(payload?.colors);
            parsed.models = normalizeAdminOptionList(payload?.models);
            return;
          } catch (error) {}
        }

        parsed.variants.push(value);
      });

      return parsed;
    }

    function buildProductVariantsPayload({ colors = [], models = [], variants = [] } = {}) {
      const payload = {};
      const normalizedColors = normalizeAdminOptionList(colors);
      const normalizedModels = normalizeAdminOptionList(models);
      const normalizedVariants = normalizeAdminOptionList(variants);

      if (normalizedColors.length) {
        payload.colors = normalizedColors;
      }

      if (normalizedModels.length) {
        payload.models = normalizedModels;
      }

      const encoded = Object.keys(payload).length
        ? [`${PRODUCT_OPTION_GROUP_PREFIX}${JSON.stringify(payload)}`]
        : [];

      return [...encoded, ...normalizedVariants];
    }

    function setText(id, value) {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    }

    function showMessage(id, value, isError = false) {
      const node = document.getElementById(id);
      if (!node) return;
      node.textContent = value;
      node.style.color = isError ? "var(--danger)" : "var(--muted)";
    }

    function showToast(message, tone = "success") {
      const stack = document.getElementById("toastStack");
      const text = String(message || "").trim();
      if (!stack || !text) return;

      const toast = document.createElement("div");
      toast.className = `toast${tone === "error" ? " error" : tone === "warning" ? " warning" : ""}`;
      toast.textContent = text;
      stack.appendChild(toast);

      while (stack.children.length > 4) {
        stack.firstElementChild?.remove();
      }

      window.setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-6px)";
        toast.style.transition = "opacity 0.18s ease, transform 0.18s ease";
        window.setTimeout(() => toast.remove(), 180);
      }, 2800);
    }

    function showActionResult(id, value, isError = false, tone = isError ? "error" : "success") {
      showMessage(id, value, isError);
      showToast(value, tone);
    }

    function getDefaultAdminSettings() {
      return {
        music: {
          enabled: false,
          tracks: [],
          volume: 1
        }
      };
    }

    function normalizeAdminTrackList(value) {
      const source = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/\r?\n|,/) : []);
      return [...new Set(
        source
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )].slice(0, 8);
    }

    function normalizeAdminSettings(settings = {}) {
      const fallback = getDefaultAdminSettings();
      const music = settings?.music || fallback.music;
      const tracks = normalizeAdminTrackList(music?.tracks);
      const parsedVolume = Number(music?.volume);
      const volume = Number.isFinite(parsedVolume)
        ? Math.min(1, Math.max(0, parsedVolume))
        : fallback.music.volume;

      return {
        music: {
          enabled: music?.enabled !== false && tracks.length > 0,
          tracks,
          volume
        }
      };
    }

    function getMusicPayload() {
      const tracks = normalizeAdminTrackList(document.getElementById("musicTracks")?.value || "");
      const volumeValue = Number(document.getElementById("musicVolume")?.value);
      const volume = Number.isFinite(volumeValue)
        ? Math.min(1, Math.max(0, volumeValue / 100))
        : 1;

      return {
        music: {
          enabled: document.getElementById("musicEnabled")?.value === "true",
          tracks,
          volume
        }
      };
    }

    function renderMusicPreview() {
      const wrapper = document.getElementById("musicPreview");
      const player = document.getElementById("musicPreviewAudio");
      if (!wrapper || !player) return;

      const tracks = normalizeAdminTrackList(document.getElementById("musicTracks")?.value || "");
      const firstTrack = tracks[0] || "";

      if (!firstTrack) {
        wrapper.classList.add("hidden");
        player.pause();
        player.removeAttribute("src");
        delete player.dataset.src;
        player.load();
        return;
      }

      wrapper.classList.remove("hidden");
      if (player.dataset.src !== firstTrack) {
        player.dataset.src = firstTrack;
        player.src = firstTrack;
        player.load();
      }
    }

    function fillMusicForm(settings = state.settings) {
      state.settings = normalizeAdminSettings(settings || getDefaultAdminSettings());
      document.getElementById("musicEnabled").value = String(state.settings.music.enabled !== false);
      document.getElementById("musicVolume").value = String(Math.round((Number(state.settings.music.volume) || 0) * 100));
      document.getElementById("musicTracks").value = state.settings.music.tracks.join("\n");
      document.getElementById("musicUpload").value = "";
      showMessage("musicMessage", "");
      showMessage("musicUploadMessage", "");
      renderMusicPreview();
    }

    async function loadRuntimeDiagnostics() {
      try {
        const response = await fetch("/api/health", {
          method: "GET",
          headers: {
            "Accept": "application/json"
          },
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("health_request_failed");
        }

        state.runtime = await response.json();
      } catch (error) {
        state.runtime = null;
      }
    }

    function getRuntimeSummary(runtime = state.runtime) {
      if (!runtime) {
        return null;
      }

      const diagnostics = runtime.diagnostics || {};
      const storageMode = diagnostics.storageMode || runtime.storage || "unknown";
      const catalogInfo = diagnostics.catalog || null;
      const settingsInfo = diagnostics.settings || null;
      const bannerInfo = diagnostics.banners || null;
      const uploadInfo = diagnostics.uploads || null;
      const issues = [];
      const chips = [`storage: ${storageMode}`];
      if (runtime.requirePersistentAdminStorage) {
        chips.push("strict-persistence: on");
      }

      if (catalogInfo?.mode) {
        chips.push(`catalog: ${catalogInfo.mode}`);
      }

      if (settingsInfo?.mode) {
        chips.push(`settings: ${settingsInfo.mode}`);
      }

      if (bannerInfo?.mode) {
        chips.push(`banners: ${bannerInfo.mode}`);
      }

      if (uploadInfo?.mode) {
        chips.push(`uploads: ${uploadInfo.mode}`);
      }

      if (storageMode === "local") {
        issues.push("Сейчас сервер работает на local storage: баннеры и картинки лежат в файлах сервера и после нового деплоя могут исчезнуть.");
      }

      if (catalogInfo && catalogInfo.persistent === false) {
        issues.push(`Каталог и товары тоже сохраняются ненадёжно: ${catalogInfo.reason}.`);
      }

      if (settingsInfo && settingsInfo.persistent === false) {
        issues.push(`Настройки Mini App и музыка сохраняются ненадёжно: ${settingsInfo.reason}.`);
      }

      if (bannerInfo && bannerInfo.persistent === false) {
        issues.push(`Баннеры сохраняются ненадёжно: ${bannerInfo.reason}.`);
      }

      if (uploadInfo && uploadInfo.persistent === false) {
        issues.push(`Загрузка картинок тоже ненадёжна: ${uploadInfo.reason}.`);
      }

      if (!issues.length) {
        return {
          safe: true,
          title: "Постоянное хранение включено",
          text: "Баннеры и картинки сейчас сохраняются в постоянное хранилище, поэтому не должны исчезать после нового деплоя.",
          chips
        };
      }

      return {
        safe: false,
        title: "Есть риск потери баннеров после деплоя",
        text: issues.join(" "),
        chips
      };
    }

    function renderRuntimeNotice() {
      const notice = document.getElementById("storageNotice");
      if (!notice) return;

      const summary = getRuntimeSummary();
      if (!summary) {
        notice.classList.add("hidden");
        notice.classList.remove("is-safe");
        notice.innerHTML = "";
        return;
      }

      notice.classList.remove("hidden");
      notice.classList.toggle("is-safe", summary.safe);
      notice.innerHTML = `
        <strong>${escapeHtml(summary.title)}</strong>
        <p>${escapeHtml(summary.text)}</p>
        <div class="runtime-meta">
          ${summary.chips.map((chip) => `<span class="runtime-chip">${escapeHtml(chip)}</span>`).join("")}
        </div>
      `;
    }

    function getUploadPersistenceWarning(result, label = "Файл") {
      if (!result) {
        return "";
      }

      if (result.persistent === false || (result.storage && result.storage !== "supabase")) {
        return result.warning || `${label} сохранён локально на сервере и может исчезнуть после нового деплоя.`;
      }

      return "";
    }

    function getOrderCustomerKey(order = {}) {
      return buildCustomerKey({
        ...(order.customer || {}),
        telegramId: order.customer?.telegramId || order.telegram?.id
      });
    }

    function applyOrderCustomerFilter(customer = {}) {
      const key = customer.key || buildCustomerKey(customer);
      if (!key) return;

      state.orderCustomerKeyFilter = key;
      state.orderCustomerLabelFilter = customer.name || customer.phone || customer.username || "клиент";
      setActiveSection("orders", { scrollIntoView: false });
      renderOrders();
      document.getElementById("ordersList")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function clearOrderCustomerFilter() {
      if (!state.orderCustomerKeyFilter) return;
      state.orderCustomerKeyFilter = "";
      state.orderCustomerLabelFilter = "";
      renderOrders();
    }

    function getOrderManagerAssignee(order = {}) {
      return String(order.requestMeta?.adminAssignee || "").trim();
    }

    function getOrderNoteTemplate(templateKey) {
      return ORDER_NOTE_TEMPLATES.find((template) => template.key === templateKey) || null;
    }

    function applyOrderNoteTemplate(noteInput, templateText) {
      if (!noteInput || !templateText) {
        return false;
      }

      const nextLine = String(templateText).trim();
      if (!nextLine) {
        return false;
      }

      const existingLines = String(noteInput.value || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (!existingLines.includes(nextLine)) {
        existingLines.push(nextLine);
        noteInput.value = existingLines.join("\n");
      }

      noteInput.focus();
      noteInput.setSelectionRange(noteInput.value.length, noteInput.value.length);
      return true;
    }

    function getDayStart(date = new Date()) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function matchesOrderDateFilter(order = {}) {
      if (state.orderDateFilter === "all") {
        return true;
      }

      const createdAt = new Date(order.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      const todayStart = getDayStart();

      if (state.orderDateFilter === "today") {
        return createdAt >= todayStart;
      }

      if (state.orderDateFilter === "yesterday") {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        return createdAt >= yesterdayStart && createdAt < todayStart;
      }

      if (state.orderDateFilter === "7d") {
        const start = new Date(todayStart);
        start.setDate(start.getDate() - 6);
        return createdAt >= start;
      }

      if (state.orderDateFilter === "30d") {
        const start = new Date(todayStart);
        start.setDate(start.getDate() - 29);
        return createdAt >= start;
      }

      return true;
    }

    function syncOrderDateFilterButtons() {
      document.querySelectorAll("[data-order-date-filter]").forEach((button) => {
        const isActive = button.dataset.orderDateFilter === state.orderDateFilter;
        button.classList.toggle("btn-primary", isActive);
        button.classList.toggle("btn-secondary", !isActive);
      });
    }

    function renderOrderSummary(orders = []) {
      const summary = document.getElementById("orderSummaryBadges");
      if (!summary) return;

      const totalOrders = orders.length;
      const totalAmount = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      const newOrders = orders.filter((order) => order.status === "new").length;
      const unassignedOrders = orders.filter((order) => !getOrderManagerAssignee(order)).length;

      summary.innerHTML = [
        `<span class="badge">Заказов: ${totalOrders}</span>`,
        `<span class="badge">Сумма: ${escapeHtml(formatAmount(totalAmount))}</span>`,
        `<span class="badge">Новых: ${newOrders}</span>`,
        `<span class="badge">Без ответственного: ${unassignedOrders}</span>`
      ].join("");
    }

    function syncOrderAssigneeFilterOptions() {
      const select = document.getElementById("orderAssigneeFilter");
      if (!select) return;

      const assignees = [...new Set(state.orders.map((order) => getOrderManagerAssignee(order)).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, "ru"));

      if (state.orderAssigneeFilter !== "all" &&
          state.orderAssigneeFilter !== "unassigned" &&
          !assignees.includes(state.orderAssigneeFilter)) {
        state.orderAssigneeFilter = "all";
      }

      select.innerHTML = [
        '<option value="all">Все</option>',
        '<option value="unassigned">Без ответственного</option>',
        ...assignees.map((assignee) => `<option value="${escapeHtml(assignee)}">${escapeHtml(assignee)}</option>`)
      ].join("");
      select.value = state.orderAssigneeFilter;
    }

    function getOrderNotificationMessage(notification) {
      if (!notification || notification.sent) return "";
      if (notification.reason === "missing_chat_id") {
        return "Статус обновлён, но у клиента нет Telegram ID для уведомления.";
      }
      if (notification.error) {
        return `Статус обновлён, но уведомление Telegram не отправилось: ${notification.error}`;
      }
      return "";
    }

    function getProductPayload() {
      const images = document.getElementById("productImages").value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      const colors = normalizeAdminOptionList(document.getElementById("productColors").value);
      const models = normalizeAdminOptionList(document.getElementById("productModels").value);
      const variants = normalizeAdminOptionList(document.getElementById("productVariants").value);

      return {
        name: document.getElementById("productName").value.trim(),
        category: document.getElementById("productCategory").value,
        price: Number(document.getElementById("productPrice").value) || 0,
        oldPrice: Number(document.getElementById("productOldPrice").value) || 0,
        sortOrder: Number(document.getElementById("productSortOrder").value) || 1,
        stock: document.getElementById("productStock").value.trim(),
        badge: "",
        desc: document.getElementById("productDesc").value.trim(),
        variants: buildProductVariantsPayload({ colors, models, variants }),
        images,
        image: images[0] || "",
        isVisible: document.getElementById("productVisible").value === "true",
        isSoon: document.getElementById("productSoon").value === "true"
      };
    }

    function getProductDraftSnapshot() {
      return JSON.stringify({
        editingId: Number(state.editingId) || 0,
        payload: getProductPayload()
      });
    }

    function syncProductDraftSnapshot() {
      state.productDraftSnapshot = getProductDraftSnapshot();
    }

    function hasUnsavedProductChanges() {
      return state.productDraftSnapshot !== null && getProductDraftSnapshot() !== state.productDraftSnapshot;
    }

    async function uploadSelectedImages() {
      const input = document.getElementById("productImageUpload");
      const files = Array.from(input.files || []);

      if (!files.length) {
        showActionResult("uploadMessage", "Сначала выбери один или несколько файлов", true);
        return;
      }

      const uploadedPaths = [];
      let fallbackUploadCount = 0;
      showMessage("uploadMessage", "Загружаю фото...");

      try {
        for (const file of files) {
          const result = await api(`/api/admin/uploads?filename=${encodeURIComponent(file.name)}`, {
            method: "POST",
            headers: {
              "Content-Type": file.type || "application/octet-stream"
            },
            body: file
          });
          uploadedPaths.push(result.path);
          if (getUploadPersistenceWarning(result, "Файл")) {
            fallbackUploadCount += 1;
          }
        }

        const textarea = document.getElementById("productImages");
        const existing = textarea.value
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean);
        const merged = [...new Set([...existing, ...uploadedPaths])];
        textarea.value = merged.join("\n");
        state.uploadedImages = merged;
        renderUploadedImages(merged);
        input.value = "";
        if (fallbackUploadCount > 0) {
          showActionResult("uploadMessage", `Загружено файлов: ${uploadedPaths.length}. ${fallbackUploadCount} из них сохранены локально на сервере и могут исчезнуть после деплоя.`, false, "warning");
        } else {
          showActionResult("uploadMessage", `Загружено файлов: ${uploadedPaths.length}`);
        }
      } catch (error) {
        showActionResult("uploadMessage", error.message, true);
      }
    }

    function renderUploadedImages(images) {
      const list = document.getElementById("uploadedImagesList");
      list.innerHTML = (images || []).map((imagePath) => `<div class="upload-chip">${escapeHtml(imagePath)}</div>`).join("");
    }

    function getBannerPayload() {
      return {
        title: document.getElementById("bannerTitle").value.trim(),
        kicker: document.getElementById("bannerKicker").value.trim(),
        image: document.getElementById("bannerImage").value.trim(),
        cta: document.getElementById("bannerCta").value.trim(),
        secondary: document.getElementById("bannerSecondary").value.trim(),
        actionType: document.getElementById("bannerActionType").value,
        actionValue: document.getElementById("bannerActionValue").value.trim(),
        secondaryActionType: document.getElementById("bannerSecondaryActionType").value,
        secondaryActionValue: document.getElementById("bannerSecondaryActionValue").value.trim(),
        sortOrder: Number(document.getElementById("bannerSortOrder").value) || 1,
        isActive: document.getElementById("bannerActive").value === "true"
      };
    }

    function getBannerDraftSnapshot() {
      return JSON.stringify({
        editingBannerId: Number(state.editingBannerId) || 0,
        payload: getBannerPayload()
      });
    }

    function syncBannerDraftSnapshot() {
      state.bannerDraftSnapshot = getBannerDraftSnapshot();
    }

    function hasUnsavedBannerChanges() {
      return state.bannerDraftSnapshot !== null && getBannerDraftSnapshot() !== state.bannerDraftSnapshot;
    }

    function confirmDiscardAdminDraft(kind, actionText) {
      const subject = kind === "product" ? "в форме товара" : "в форме баннера";
      return window.confirm(`Есть несохранённые изменения ${subject}. ${actionText}?`);
    }

    function confirmProductDraftDiscard(actionText) {
      if (!hasUnsavedProductChanges()) return true;
      return confirmDiscardAdminDraft("product", actionText);
    }

    function confirmBannerDraftDiscard(actionText) {
      if (!hasUnsavedBannerChanges()) return true;
      return confirmDiscardAdminDraft("banner", actionText);
    }

    function hasAnyUnsavedAdminDrafts() {
      return hasUnsavedProductChanges() || hasUnsavedBannerChanges();
    }

    function confirmCurrentAdminSectionLeave(actionText) {
      if (state.activeSection === "products") {
        return confirmProductDraftDiscard(actionText);
      }

      if (state.activeSection === "banners") {
        return confirmBannerDraftDiscard(actionText);
      }

      return true;
    }

    function fillBannerForm(banner = null) {
      state.editingBannerId = banner ? banner.id : null;
      document.getElementById("bannerTitle").value = banner?.title || "";
      document.getElementById("bannerKicker").value = banner?.kicker || "";
      document.getElementById("bannerImage").value = banner?.image || "";
      document.getElementById("bannerImageUpload").value = "";
      document.getElementById("bannerCta").value = banner?.cta || "";
      document.getElementById("bannerSecondary").value = banner?.secondary || "";
      document.getElementById("bannerActionType").value = banner?.actionType || "reset";
      document.getElementById("bannerActionValue").value = banner?.actionValue || "";
      document.getElementById("bannerSecondaryActionType").value = banner?.secondaryActionType || "";
      document.getElementById("bannerSecondaryActionValue").value = banner?.secondaryActionValue || "";
      document.getElementById("bannerSortOrder").value = banner?.sortOrder ?? "";
      document.getElementById("bannerActive").value = String(banner?.isActive !== false);
      showMessage("bannerUploadMessage", "");
      renderBannerPreview();
      syncBannerDraftSnapshot();
      showMessage("bannerMessage", banner ? `Редактируется баннер #${banner.id}` : "Форма очищена для нового баннера");
    }

    function renderBannerPreview() {
      const preview = document.getElementById("bannerPreview");
      const title = document.getElementById("bannerTitle").value.trim() || "Превью баннера";
      const kicker = document.getElementById("bannerKicker").value.trim() || "Баннер";
      const image = document.getElementById("bannerImage").value.trim();
      document.getElementById("bannerPreviewTitle").textContent = title;
      document.getElementById("bannerPreviewKicker").textContent = kicker;

      const imageMarkup = image
        ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />`
        : "";

      preview.innerHTML = `${imageMarkup}<div class="banner-preview-copy"><span id="bannerPreviewKicker">${escapeHtml(kicker)}</span><strong id="bannerPreviewTitle">${escapeHtml(title)}</strong></div>`;
    }

    async function uploadBannerImage() {
      const input = document.getElementById("bannerImageUpload");
      const file = Array.from(input.files || [])[0];

      if (!file) {
        showActionResult("bannerUploadMessage", "Сначала выбери файл", true);
        return;
      }

      showMessage("bannerUploadMessage", "Загружаю картинку...");
      try {
        const result = await api(`/api/admin/uploads?filename=${encodeURIComponent(file.name)}`, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream"
          },
          body: file
        });
        document.getElementById("bannerImage").value = result.path;
        input.value = "";
        renderBannerPreview();
        const warning = getUploadPersistenceWarning(result, "Картинка");
        if (warning) {
          showActionResult("bannerUploadMessage", warning, false, "warning");
        } else {
          showActionResult("bannerUploadMessage", "Картинка загружена");
        }
      } catch (error) {
        showActionResult("bannerUploadMessage", error.message, true);
      }
    }

    async function uploadMusicTrack() {
      const input = document.getElementById("musicUpload");
      const file = Array.from(input.files || [])[0];

      if (!file) {
        showActionResult("musicUploadMessage", "Сначала выбери MP3-файл", true);
        return;
      }

      showMessage("musicUploadMessage", "Загружаю MP3...");

      try {
        const result = await api(`/api/admin/uploads?filename=${encodeURIComponent(file.name)}`, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "audio/mpeg"
          },
          body: file
        });

        const textarea = document.getElementById("musicTracks");
        const existing = normalizeAdminTrackList(textarea.value);
        const tracks = [...new Set([...existing, result.path])];
        textarea.value = tracks.join("\n");
        input.value = "";
        renderMusicPreview();

        const warning = getUploadPersistenceWarning(result, "MP3");
        if (warning) {
          showActionResult("musicUploadMessage", warning, false, "warning");
        } else {
          showActionResult("musicUploadMessage", "MP3 загружен");
        }
      } catch (error) {
        showActionResult("musicUploadMessage", error.message, true);
      }
    }

    async function saveMusicSettings() {
      const payload = getMusicPayload();

      try {
        const response = await api("/api/admin/settings", {
          method: "PUT",
          body: JSON.stringify(payload)
        });

        state.settings = normalizeAdminSettings(response.settings || payload);
        await loadRuntimeDiagnostics();
        renderRuntimeNotice();
        fillMusicForm(state.settings);
        showActionResult("musicMessage", "Музыка обновлена");
      } catch (error) {
        showActionResult("musicMessage", error.message, true);
      }
    }

    function renderBanners() {
      const list = document.getElementById("bannerList");
      if (!state.banners.length) {
        list.innerHTML = '<div class="hint">Пока баннеров нет.</div>';
        return;
      }

      list.innerHTML = [...state.banners]
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || (a.id || 0) - (b.id || 0))
        .map((banner) => `
          <article class="product-card banner-list-card">
            <div class="banner-list-media">
              ${banner.image ? `<img src="${escapeHtml(banner.image)}" alt="${escapeHtml(banner.title)}" />` : ""}
            </div>
            <div class="banner-card-copy">
              <div>
                <h3>${escapeHtml(banner.title)}</h3>
                <div class="meta">${escapeHtml(banner.kicker || "Без kicker")} · sort ${banner.sortOrder || 1}</div>
              </div>
              <div class="badge-row">
                <span class="badge">${banner.isActive !== false ? "Активен" : "Скрыт"}</span>
                <span class="badge">${escapeHtml(banner.actionType || "reset")}</span>
                ${banner.secondaryActionType ? `<span class="badge">${escapeHtml(banner.secondaryActionType)}</span>` : ""}
              </div>
              <div class="muted">${escapeHtml(banner.cta || "Без кнопки")} / ${escapeHtml(banner.secondary || "Без второй кнопки")}</div>
              <div class="muted">${escapeHtml(banner.image || "Без картинки")}</div>
              <div class="product-actions">
                <button class="btn btn-secondary btn-small" type="button" data-edit-banner="${banner.id}">Редактировать</button>
                <button class="btn btn-danger btn-small" type="button" data-delete-banner="${banner.id}">Удалить</button>
              </div>
            </div>
          </article>
        `).join("");

      list.querySelectorAll("[data-edit-banner]").forEach((button) => {
        button.addEventListener("click", () => {
          if (!confirmBannerDraftDiscard("Открыть другой баннер и потерять их")) return;
          const banner = state.banners.find((item) => item.id === Number(button.dataset.editBanner));
          fillBannerForm(banner);
        });
      });

      list.querySelectorAll("[data-delete-banner]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            const response = await api(`/api/admin/banners/${button.dataset.deleteBanner}`, { method: "DELETE" });
            state.banners = response.banners || [];
            renderBanners();
            if (state.editingBannerId === Number(button.dataset.deleteBanner)) {
              fillBannerForm(null);
            }
            showActionResult("bannerMessage", "Баннер удалён");
          } catch (error) {
            showActionResult("bannerMessage", error.message, true);
          }
        });
      });
    }

    function fillProductForm(product = null) {
      const optionGroups = parseProductOptionGroups(product?.variants);
      state.editingId = product ? product.id : null;
      document.getElementById("productName").value = product?.name || "";
      document.getElementById("productCategory").value = product?.category || state.catalog.categories.find((item) => item.key !== "all")?.key || "all";
      document.getElementById("productPrice").value = product?.price ?? "";
      document.getElementById("productOldPrice").value = product?.oldPrice ?? "";
      document.getElementById("productSortOrder").value = product?.sortOrder ?? "";
      document.getElementById("productStock").value = product?.stock || "";
      document.getElementById("productDesc").value = product?.desc || "";
      document.getElementById("productColors").value = optionGroups.colors.join("\n");
      document.getElementById("productModels").value = optionGroups.models.join("\n");
      document.getElementById("productVariants").value = optionGroups.variants.join("\n");
      document.getElementById("productImages").value = Array.isArray(product?.images) ? product.images.join("\n") : "";
      document.getElementById("productImageUpload").value = "";
      document.getElementById("productVisible").value = String(product?.isVisible !== false);
      document.getElementById("productSoon").value = String(Boolean(product?.isSoon));
      state.uploadedImages = Array.isArray(product?.images) ? product.images : [];
      renderUploadedImages(state.uploadedImages);
      showMessage("uploadMessage", "");
      syncProductDraftSnapshot();
      showMessage("productMessage", product ? `Редактируется товар #${product.id}` : "Форма очищена для нового товара");
    }

    function renderCategoryOptions() {
      const select = document.getElementById("productCategory");
      select.innerHTML = state.catalog.categories
        .filter((item) => item.key !== "all")
        .map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`)
        .join("");
    }

    function renderStats() {
      setText("statProducts", state.catalog.products.length);
      setText("statCategories", state.catalog.categories.filter((item) => item.key !== "all").length);
      setText("statOrders", state.orders.filter((item) => item.status === "new").length);
    }

    function renderCategories() {
      const list = document.getElementById("categoryList");
      list.innerHTML = state.catalog.categories.map((category) => {
        const removeButton = category.key === "all"
          ? ""
          : `<button class="btn btn-danger btn-small" type="button" data-delete-category="${escapeHtml(category.key)}">Удалить</button>`;

        return `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(category.label)}</strong><br />
              <small>${escapeHtml(category.key)}</small>
            </div>
            ${removeButton}
          </div>
        `;
      }).join("");

      list.querySelectorAll("[data-delete-category]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            state.catalog = await api(`/api/admin/categories/${encodeURIComponent(button.dataset.deleteCategory)}`, { method: "DELETE" });
            renderAll();
            showActionResult("categoryMessage", "Категория удалена");
          } catch (error) {
            showActionResult("categoryMessage", error.message, true);
          }
        });
      });
    }

    function renderProducts() {
      const list = document.getElementById("productList");
      const products = [...state.catalog.products].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      list.innerHTML = products.map((product) => `
        <article class="product-card">
          <h3>${escapeHtml(product.name)}</h3>
          <div class="meta">${escapeHtml(product.stock || "Без статуса")} · ${escapeHtml(product.category)} · ${formatPrice(product.price)}${product.oldPrice > product.price ? ` · <s>${formatPrice(product.oldPrice)}</s> · -${getDiscountPercent(product)}%` : ""}</div>
          <div class="badge-row">
            <span class="badge">ID ${product.id}</span>
            <span class="badge">${product.isVisible !== false ? "Виден" : "Скрыт"}</span>
            <span class="badge">${product.isSoon ? "Под заказ" : "В наличии / обычный"}</span>
            ${product.oldPrice > product.price ? `<span class="badge">Скидка ${getDiscountPercent(product)}%</span>` : ""}
          </div>
          <div class="muted">${escapeHtml(product.desc || "Без описания")}</div>
          <div class="product-actions">
            <button class="btn btn-secondary btn-small" type="button" data-edit-product="${product.id}">Редактировать</button>
            <button class="btn btn-danger btn-small" type="button" data-delete-product="${product.id}">Удалить</button>
          </div>
        </article>
      `).join("");

      list.querySelectorAll("[data-edit-product]").forEach((button) => {
        button.addEventListener("click", () => {
          if (!confirmProductDraftDiscard("Открыть другой товар и потерять их")) return;
          const product = state.catalog.products.find((item) => item.id === Number(button.dataset.editProduct));
          fillProductForm(product);
        });
      });

      list.querySelectorAll("[data-delete-product]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            state.catalog = await api(`/api/admin/products/${button.dataset.deleteProduct}`, { method: "DELETE" });
            renderAll();
            if (state.editingId === Number(button.dataset.deleteProduct)) {
              fillProductForm(null);
            }
            showActionResult("productMessage", "Товар удалён");
          } catch (error) {
            showActionResult("productMessage", error.message, true);
          }
        });
      });
    }

    function renderOrders() {
      const list = document.getElementById("ordersList");
      const customerFilterNotice = document.getElementById("orderCustomerFilterNotice");
      const clearCustomerFilterBtn = document.getElementById("clearOrderCustomerFilterBtn");
      const orderActionMessage = document.getElementById("orderActionMessage");
      const searchValue = state.orderSearch.trim().toLowerCase();

      if (orderActionMessage && !orderActionMessage.textContent) {
        orderActionMessage.style.color = "var(--muted)";
      }

      syncOrderDateFilterButtons();
      syncOrderAssigneeFilterOptions();

      if (customerFilterNotice) {
        customerFilterNotice.textContent = state.orderCustomerKeyFilter
          ? `Фильтр по клиенту: ${state.orderCustomerLabelFilter}`
          : "";
      }

      if (clearCustomerFilterBtn) {
        clearCustomerFilterBtn.classList.toggle("hidden", !state.orderCustomerKeyFilter);
      }

      const filteredOrders = state.orders.filter((order) => {
        const matchesDate = matchesOrderDateFilter(order);
        if (!matchesDate) return false;
        const matchesStatus = state.orderStatusFilter === "all" || order.status === state.orderStatusFilter;
        if (!matchesStatus) return false;
        const orderAssignee = getOrderManagerAssignee(order);
        const matchesAssignee = state.orderAssigneeFilter === "all"
          || (state.orderAssigneeFilter === "unassigned" ? !orderAssignee : orderAssignee === state.orderAssigneeFilter);
        if (!matchesAssignee) return false;
        const matchesCustomer = !state.orderCustomerKeyFilter || getOrderCustomerKey(order) === state.orderCustomerKeyFilter;
        if (!matchesCustomer) return false;
        if (!searchValue) return true;

        const haystack = [
          order.customer?.name,
          order.customer?.phone,
          order.customer?.username,
          order.customer?.delivery,
          order.customer?.location,
          order.customer?.telegramId,
          order.requestMeta?.adminAssignee,
          order.requestMeta?.adminNote
        ].filter(Boolean).join(" ").toLowerCase();

        return haystack.includes(searchValue);
      });

      renderOrderSummary(filteredOrders);

      if (!state.orders.length) {
        list.innerHTML = '<div class="hint">Пока заказов нет.</div>';
        return;
      }

      if (!filteredOrders.length) {
        list.innerHTML = state.orderCustomerKeyFilter
          ? '<div class="hint">По выбранному клиенту заказы не найдены.</div>'
          : '<div class="hint">По выбранным фильтрам заказы не найдены.</div>';
        return;
      }

      list.innerHTML = filteredOrders.map((order) => {
        const username = String(order.customer?.username || "").replace(/^@/, "");
        const telegramLink = username ? `https://t.me/${encodeURIComponent(username)}` : "";
        const phoneLink = order.customer?.phone ? `tel:${String(order.customer.phone).replace(/[^\d+]/g, "")}` : "";
        const locationLink = buildCustomerLocationLink(order.customer?.location);
        const addressLabel = getCustomerAddressLabel(order.customer);
        const managerAssignee = getOrderManagerAssignee(order);
        const assigneeUpdatedAt = formatDateTime(order.requestMeta?.adminAssigneeUpdatedAt);
        const managerNote = String(order.requestMeta?.adminNote || "");
        const noteUpdatedAt = formatDateTime(order.requestMeta?.adminNoteUpdatedAt);

        return `
          <article class="order-card">
            <div class="order-top">
              <div>
                <h3>${escapeHtml(order.customer?.name || "Без имени")}</h3>
                <div class="muted">${escapeHtml(order.customer?.phone || "")}</div>
                ${username ? `<div class="muted">@${escapeHtml(username)}</div>` : ""}
              </div>
              <span class="status ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
            </div>
            <div class="badge-row">
              <span class="badge">${escapeHtml(formatDateTime(order.createdAt))}</span>
              <span class="badge">${formatPrice(order.total)}</span>
              <span class="badge">${escapeHtml(managerAssignee || "Без ответственного")}</span>
            </div>
            <div class="muted">${escapeHtml(addressLabel)}</div>
            <div class="muted stack-top-gap">${(order.items || []).map((item) => `${escapeHtml(item.name)} x${item.qty}${item.variant ? ` (${escapeHtml(item.variant)})` : ""}`).join("<br />")}</div>
            <label class="stack-top-gap">
              Ответственный
              <input type="text" maxlength="80" data-order-assignee-input="${order.id}" placeholder="Например: Азиз" value="${escapeHtml(managerAssignee)}" />
            </label>
            ${assigneeUpdatedAt ? `<div class="muted">Назначен: ${escapeHtml(assigneeUpdatedAt)}</div>` : ""}
            <label class="stack-top-gap">
              Заметка менеджера
              <textarea rows="3" maxlength="1000" data-order-note-input="${order.id}" placeholder="Например: позвонить после 18:00, уточнить цвет, предупредить о сроке">${escapeHtml(managerNote)}</textarea>
            </label>
            <div class="template-actions">
              ${ORDER_NOTE_TEMPLATES.map((template) => `
                <button class="btn btn-secondary btn-small" type="button" data-order-template="${order.id}:${template.key}">${escapeHtml(template.label)}</button>
              `).join("")}
            </div>
            ${noteUpdatedAt ? `<div class="muted">Обновлено: ${escapeHtml(noteUpdatedAt)}</div>` : ""}
            <div class="product-actions">
              ${telegramLink ? `<a class="btn btn-secondary btn-small" href="${telegramLink}" target="_blank" rel="noreferrer">Telegram</a>` : ""}
              ${locationLink ? `<a class="btn btn-secondary btn-small" href="${locationLink}" target="_blank" rel="noreferrer">Карта</a>` : ""}
              <button class="btn btn-primary btn-small" type="button" data-save-note="${order.id}">Сохранить CRM</button>
              ${phoneLink ? `<a class="btn btn-secondary btn-small" href="${phoneLink}">Позвонить</a>` : ""}
              <button class="btn btn-secondary btn-small" type="button" data-status="${order.id}:processing">В работу</button>
              <button class="btn btn-secondary btn-small" type="button" data-status="${order.id}:done">Готово</button>
              <button class="btn btn-danger btn-small" type="button" data-status="${order.id}:cancelled">Отменить</button>
            </div>
          </article>
        `;
      }).join("");

      list.querySelectorAll("[data-status]").forEach((button) => {
        button.addEventListener("click", async () => {
          const [orderId, status] = button.dataset.status.split(":");
          try {
            const response = await api(`/api/admin/orders/${orderId}`, {
              method: "PATCH",
              body: JSON.stringify({ status })
            });
            await loadAdminData();
            showActionResult("orderActionMessage", "Статус обновлён");
            const notificationMessage = getOrderNotificationMessage(response.notification);
            if (notificationMessage) {
              showToast(notificationMessage, "warning");
            }
          } catch (error) {
            showActionResult("orderActionMessage", error.message, true);
          }
        });
      });

      list.querySelectorAll("[data-save-note]").forEach((button) => {
        button.addEventListener("click", async () => {
          const orderId = button.dataset.saveNote;
          const noteInput = list.querySelector(`[data-order-note-input="${orderId}"]`);
          const assigneeInput = list.querySelector(`[data-order-assignee-input="${orderId}"]`);
          const managerNote = noteInput ? noteInput.value : "";
          const managerAssignee = assigneeInput ? assigneeInput.value : "";
          const initialText = button.textContent;

          button.disabled = true;
          button.textContent = "Сохраняю...";

          try {
            await api(`/api/admin/orders/${orderId}`, {
              method: "PATCH",
              body: JSON.stringify({ managerNote, managerAssignee })
            });
            await loadAdminData();
            showActionResult(
              "orderActionMessage",
              managerAssignee.trim() || managerNote.trim()
                ? "CRM сохранено"
                : "CRM очищено"
            );
          } catch (error) {
            showActionResult("orderActionMessage", error.message, true);
          } finally {
            button.disabled = false;
            button.textContent = initialText;
          }
        });
      });

      list.querySelectorAll("[data-order-template]").forEach((button) => {
        button.addEventListener("click", () => {
          const [orderId, templateKey] = String(button.dataset.orderTemplate || "").split(":");
          const noteInput = list.querySelector(`[data-order-note-input="${orderId}"]`);
          const template = getOrderNoteTemplate(templateKey);
          const applied = applyOrderNoteTemplate(noteInput, template?.text);

          if (!applied) {
            showActionResult("orderActionMessage", "Не удалось подставить шаблон", true);
            return;
          }

          showActionResult("orderActionMessage", `Шаблон "${template.label}" добавлен, сохраните CRM`);
        });
      });
    }

    function buildCustomerKey(customer = {}) {
      const telegramId = String(customer.telegramId || customer.telegram?.id || "").trim();
      const phone = String(customer.phone || "").trim();
      const username = String(customer.username || "").replace(/^@/, "").trim().toLowerCase();
      const name = String(customer.name || "").trim().toLowerCase();
      const delivery = String(customer.delivery || "").trim().toLowerCase();

      if (telegramId) return `tg:${telegramId}`;
      if (phone) return `phone:${phone.replace(/[^\d+]/g, "")}`;
      if (username) return `user:${username}`;
      if (name || delivery) return `fallback:${name}|${delivery}`;
      return "";
    }

    function getCustomers() {
      const customers = new Map();

      for (const profile of state.customers) {
        const key = buildCustomerKey(profile);
        if (!key) continue;
        customers.set(key, {
          key,
          name: String(profile.name || "").trim() || "\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438",
          phone: String(profile.phone || "").trim(),
          username: String(profile.username || "").replace(/^@/, "").trim(),
          delivery: String(profile.delivery || "").trim(),
          location: String(profile.location || "").trim(),
          comment: String(profile.comment || "").trim(),
          telegramId: String(profile.telegramId || "").trim(),
          ordersCount: 0,
          itemsCount: 0,
          spent: 0,
          lastOrderAt: profile.updatedAt || profile.createdAt || "",
          statuses: new Set()
        });
      }

      for (const order of state.orders) {
        const customer = order.customer || {};
        const key = buildCustomerKey({
          ...customer,
          telegramId: customer.telegramId || order.telegram?.id
        });
        if (!key) continue;

        const itemsCount = Array.isArray(order.items)
          ? order.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
          : 0;

        if (!customers.has(key)) {
          customers.set(key, {
            key,
            name: String(customer.name || "").trim() || "\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438",
            phone: String(customer.phone || "").trim(),
            username: String(customer.username || "").replace(/^@/, "").trim(),
            delivery: String(customer.delivery || "").trim(),
            location: String(customer.location || "").trim(),
            comment: String(customer.comment || "").trim(),
            telegramId: String(customer.telegramId || order.telegram?.id || "").trim(),
            ordersCount: 0,
            itemsCount: 0,
            spent: 0,
            lastOrderAt: order.createdAt,
            statuses: new Set()
          });
        }

        const entry = customers.get(key);
        entry.name = entry.name === "\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438" && customer.name ? String(customer.name).trim() : entry.name;
        entry.phone = entry.phone || String(customer.phone || "").trim();
        entry.username = entry.username || String(customer.username || "").replace(/^@/, "").trim();
        entry.delivery = entry.delivery || String(customer.delivery || "").trim();
        entry.location = entry.location || String(customer.location || "").trim();
        entry.comment = entry.comment || String(customer.comment || "").trim();
        entry.telegramId = entry.telegramId || String(customer.telegramId || order.telegram?.id || "").trim();
        entry.ordersCount += 1;
        entry.itemsCount += itemsCount;
        entry.spent += Number(order.total) || 0;
        entry.statuses.add(order.status || "new");

        if (!entry.lastOrderAt || new Date(order.createdAt).getTime() > new Date(entry.lastOrderAt).getTime()) {
          entry.lastOrderAt = order.createdAt;
        }
      }

      return [...customers.values()]
        .map((customer) => ({ ...customer, statuses: [...customer.statuses] }))
        .sort((a, b) => new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime());
    }

    function renderCustomers() {
      const list = document.getElementById("customersList");
      const summary = document.getElementById("customerSummary");
      const searchValue = state.customerSearch.trim().toLowerCase();
      const customers = getCustomers();
      const filteredCustomers = customers.filter((customer) => {
        if (!searchValue) return true;
        const haystack = [
          customer.name,
          customer.phone,
          customer.username,
          customer.delivery,
          customer.location,
          customer.comment
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(searchValue);
      });

      if (summary) {
        const totalSpent = filteredCustomers.reduce((sum, customer) => sum + customer.spent, 0);
        summary.value = `Клиентов: ${filteredCustomers.length} • Заказов: ${filteredCustomers.reduce((sum, customer) => sum + customer.ordersCount, 0)} • Сумма: ${formatPrice(totalSpent)}`;
      }

      if (!customers.length) {
        list.innerHTML = '<div class="hint">Пока нет клиентов. Они появятся после первых заказов.</div>';
        return;
      }

      if (!filteredCustomers.length) {
        list.innerHTML = '<div class="hint">По выбранному запросу клиенты не найдены.</div>';
        return;
      }

      list.innerHTML = filteredCustomers.map((customer) => {
        const telegramLink = customer.username ? `https://t.me/${encodeURIComponent(customer.username)}` : "";
        const phoneLink = customer.phone ? `tel:${String(customer.phone).replace(/[^\d+]/g, "")}` : "";
        const locationLink = buildCustomerLocationLink(customer.location);
        const addressLabel = getCustomerAddressLabel(customer);
        const lastSeenLabel = customer.lastOrderAt
          ? new Date(customer.lastOrderAt).toLocaleString("ru-RU")
          : "Без заказов";
        const statuses = customer.statuses.length
          ? customer.statuses.map((status) => `<span class="badge">${escapeHtml(status)}</span>`).join("")
          : '<span class="badge">без статуса</span>';

        return `
          <article class="order-card">
            <div class="order-top">
              <div>
                <h3>${escapeHtml(customer.name)}</h3>
                <div class="muted">${escapeHtml(customer.phone || "Телефон не указан")}</div>
                ${customer.username ? `<div class="muted">@${escapeHtml(customer.username)}</div>` : ""}
              </div>
              <span class="status done">${customer.ordersCount} заказов</span>
            </div>
            <div class="badge-row">
              <span class="badge">Товаров: ${customer.itemsCount}</span>
              <span class="badge">${formatPrice(customer.spent)}</span>
              <span class="badge">${escapeHtml(lastSeenLabel)}</span>
            </div>
            <div class="muted">${escapeHtml(addressLabel)}</div>
            ${customer.comment ? `<div class="muted stack-top-gap">Комментарий: ${escapeHtml(customer.comment)}</div>` : ""}
            <div class="badge-row">${statuses}</div>
            <div class="product-actions">
              <button class="btn btn-secondary btn-small" type="button" data-customer-orders="${escapeHtml(customer.key)}">Заказы клиента</button>
              ${locationLink ? `<a class="btn btn-secondary btn-small" href="${locationLink}" target="_blank" rel="noreferrer">Карта</a>` : ""}
              ${telegramLink ? `<a class="btn btn-secondary btn-small" href="${telegramLink}" target="_blank" rel="noreferrer">Telegram</a>` : ""}
              ${phoneLink ? `<a class="btn btn-secondary btn-small" href="${phoneLink}">Позвонить</a>` : ""}
            </div>
          </article>
        `;
      }).join("");

      list.querySelectorAll("[data-customer-orders]").forEach((button) => {
        button.addEventListener("click", () => {
          const customer = customers.find((item) => item.key === button.dataset.customerOrders);
          if (!customer) return;
          applyOrderCustomerFilter(customer);
        });
      });
    }

    function getAdminSectionNavItems() {
      return [
        { key: "overview", label: "Сводка", count: null },
        { key: "products", label: "Товары", count: state.catalog.products.length },
        { key: "categories", label: "Категории", count: state.catalog.categories.filter((item) => item.key !== "all").length },
        { key: "orders", label: "Заказы", count: state.orders.length },
        { key: "customers", label: "Клиенты", count: getCustomers().length },
        { key: "banners", label: "Баннеры", count: state.banners.length },
        { key: "music", label: "Музыка", count: state.settings.music.tracks.length }
      ];
    }

    function renderAdminSectionNav() {
      const items = new Map(getAdminSectionNavItems().map((item) => [item.key, item]));

      document.querySelectorAll("[data-admin-section-target]").forEach((button) => {
        const key = button.dataset.adminSectionTarget || "";
        const item = items.get(key);
        if (!item) return;

        const countMarkup = Number.isFinite(item.count)
          ? `<span class="admin-section-count">${escapeHtml(String(item.count))}</span>`
          : "";

        button.innerHTML = `<span class="admin-section-label">${escapeHtml(item.label)}</span>${countMarkup}`;
      });
    }

    function renderAdminSections() {
      const activeSection = normalizeAdminSection(state.activeSection);

      document.querySelectorAll("[data-admin-section]").forEach((element) => {
        element.classList.toggle("section-hidden", element.dataset.adminSection !== activeSection);
      });

      document.querySelectorAll("[data-admin-section-target]").forEach((button) => {
        const isActive = button.dataset.adminSectionTarget === activeSection;
        button.classList.toggle("is-active", isActive);
        button.classList.toggle("btn-primary", isActive);
        button.classList.toggle("btn-secondary", !isActive);
        button.setAttribute("aria-current", isActive ? "page" : "false");
      });

      document.querySelectorAll("#appView .grid").forEach((grid) => {
        const visibleChildren = [...grid.children].filter((child) => !child.classList.contains("hidden") && !child.classList.contains("section-hidden"));
        if (!grid.dataset.adminSection) {
          grid.classList.toggle("section-hidden", visibleChildren.length === 0);
        }
        grid.classList.toggle("is-single-panel", visibleChildren.length <= 1);
      });
    }

    function setActiveSection(sectionKey, options = {}) {
      const nextSection = normalizeAdminSection(sectionKey);
      const { scrollIntoView = true, updateHash = true, replaceHash = false } = options;

      if (nextSection !== state.activeSection && !confirmCurrentAdminSectionLeave("Перейти в другой раздел и потерять их")) {
        return false;
      }

      state.activeSection = nextSection;
      localStorage.setItem("techgear_admin_section", nextSection);
      renderAdminSections();

      if (updateHash) {
        syncAdminSectionHash(nextSection, { replace: replaceHash });
      }

      if (!scrollIntoView) return true;
      document.querySelector(`[data-admin-section="${nextSection}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }

    function renderAll() {
      renderRuntimeNotice();
      renderCategoryOptions();
      renderStats();
      renderCategories();
      renderProducts();
      renderOrders();
      renderCustomers();
      renderBanners();
      if (!state.editingId) {
        fillProductForm(null);
      }
      if (!state.editingBannerId) {
        fillBannerForm(null);
      }
      fillMusicForm(state.settings);
      renderAdminSectionNav();
      renderAdminSections();
      syncAdminSectionHash(state.activeSection, { replace: true });
    }

    async function loadAdminData() {
      const [catalog, ordersResponse, customersResponse, bannersResponse, settingsResponse] = await Promise.all([
        api("/api/admin/catalog"),
        api("/api/admin/orders"),
        api("/api/admin/customers"),
        api("/api/admin/banners"),
        api("/api/admin/settings")
      ]);

      await loadRuntimeDiagnostics();

      state.catalog = catalog;
      state.orders = ordersResponse.orders || [];
      state.customers = customersResponse.customers || [];
      state.banners = bannersResponse.banners || [];
      state.settings = normalizeAdminSettings(settingsResponse.settings || catalog.settings || getDefaultAdminSettings());
      renderAll();
    }

    async function login() {
      const password = document.getElementById("passwordInput").value.trim();
      try {
        const result = await api("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ password })
        });
        state.token = result.token;
        localStorage.setItem("techgear_admin_token", result.token);
        document.getElementById("loginView").classList.add("hidden");
        document.getElementById("appView").classList.remove("hidden");
        await loadAdminData();
        showToast("Вход выполнен");
      } catch (error) {
        showActionResult("loginMessage", error.message, true);
        if (error.message.includes("ADMIN_PASSWORD")) {
          document.getElementById("passwordInput").disabled = true;
          document.getElementById("loginBtn").disabled = true;
        }
      }
    }

    async function saveProduct() {
      const payload = getProductPayload();
      try {
        state.catalog = state.editingId
          ? await api(`/api/admin/products/${state.editingId}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });

        renderAll();
        showActionResult("productMessage", state.editingId ? "Товар обновлён" : "Товар создан");
        if (!state.editingId) {
          fillProductForm(state.catalog.products[0]);
        } else {
          syncProductDraftSnapshot();
        }
      } catch (error) {
        showActionResult("productMessage", error.message, true);
      }
    }

    async function addCategory() {
      const key = document.getElementById("categoryKey").value.trim();
      const label = document.getElementById("categoryLabel").value.trim();
      try {
        state.catalog = await api("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify({ key, label })
        });
        document.getElementById("categoryKey").value = "";
        document.getElementById("categoryLabel").value = "";
        renderAll();
        showActionResult("categoryMessage", "Категория добавлена");
      } catch (error) {
        showActionResult("categoryMessage", error.message, true);
      }
    }

    async function saveBanner() {
      const payload = getBannerPayload();
      try {
        const response = state.editingBannerId
          ? await api(`/api/admin/banners/${state.editingBannerId}`, { method: "PUT", body: JSON.stringify(payload) })
          : await api("/api/admin/banners", { method: "POST", body: JSON.stringify(payload) });

        state.banners = response.banners || [];
        renderBanners();
        showActionResult("bannerMessage", state.editingBannerId ? "Баннер обновлён" : "Баннер создан");
        if (!state.editingBannerId) {
          fillBannerForm(state.banners[0] || null);
        } else {
          syncBannerDraftSnapshot();
        }
      } catch (error) {
        showActionResult("bannerMessage", error.message, true);
      }
    }

    async function refreshAdminData() {
      if (!confirmCurrentAdminSectionLeave("Обновить данные и потерять их")) return;

      const button = document.getElementById("refreshBtn");
      const initialText = button?.textContent || "";

      if (button) {
        button.disabled = true;
        button.textContent = "Обновляю...";
      }

      try {
        await loadAdminData();
        showToast("Данные обновлены");
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = initialText;
        }
      }
    }

    function logout() {
      if (!confirmCurrentAdminSectionLeave("Выйти и потерять их")) return;

      state.token = "";
      localStorage.removeItem("techgear_admin_token");
      document.getElementById("appView").classList.add("hidden");
      document.getElementById("loginView").classList.remove("hidden");
    }

    document.getElementById("loginBtn").addEventListener("click", login);
    document.getElementById("passwordInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });
    document.getElementById("refreshBtn").addEventListener("click", refreshAdminData);
    document.getElementById("logoutBtn").addEventListener("click", logout);
    window.addEventListener("beforeunload", (event) => {
      if (!hasAnyUnsavedAdminDrafts()) return;
      event.preventDefault();
      event.returnValue = "";
    });
    window.addEventListener("hashchange", () => {
      const hashSection = getHashAdminSection();
      if (!hashSection || hashSection === state.activeSection) return;
      const applied = setActiveSection(hashSection, { scrollIntoView: false, updateHash: false });
      if (!applied) {
        syncAdminSectionHash(state.activeSection, { replace: true });
      }
    });
    document.querySelectorAll("[data-admin-section-target]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveSection(button.dataset.adminSectionTarget || DEFAULT_ADMIN_SECTION);
      });
    });
    document.getElementById("orderSearchInput").addEventListener("input", (event) => {
      state.orderSearch = event.target.value;
      renderOrders();
    });
    document.getElementById("orderStatusFilter").addEventListener("change", (event) => {
      state.orderStatusFilter = event.target.value;
      renderOrders();
    });
    document.querySelectorAll("[data-order-date-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.orderDateFilter = button.dataset.orderDateFilter || "all";
        renderOrders();
      });
    });
    document.getElementById("orderAssigneeFilter")?.addEventListener("change", (event) => {
      state.orderAssigneeFilter = event.target.value;
      renderOrders();
    });
    document.getElementById("clearOrderCustomerFilterBtn")?.addEventListener("click", clearOrderCustomerFilter);
    document.getElementById("customerSearchInput").addEventListener("input", (event) => {
      state.customerSearch = event.target.value;
      renderCustomers();
    });
    document.getElementById("saveProductBtn").addEventListener("click", saveProduct);
    document.getElementById("newProductBtn").addEventListener("click", () => {
      if (!confirmProductDraftDiscard("Открыть новую форму и потерять их")) return;
      fillProductForm(null);
    });
    document.getElementById("uploadImagesBtn").addEventListener("click", uploadSelectedImages);
    document.getElementById("addCategoryBtn").addEventListener("click", addCategory);
    document.getElementById("saveBannerBtn").addEventListener("click", saveBanner);
    document.getElementById("newBannerBtn").addEventListener("click", () => {
      if (!confirmBannerDraftDiscard("Открыть новую форму и потерять их")) return;
      fillBannerForm(null);
    });
    document.getElementById("uploadBannerImageBtn").addEventListener("click", uploadBannerImage);
    ["bannerTitle", "bannerKicker", "bannerImage"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderBannerPreview);
    });
    document.getElementById("saveMusicBtn").addEventListener("click", saveMusicSettings);
    document.getElementById("uploadMusicBtn").addEventListener("click", uploadMusicTrack);
    document.getElementById("musicTracks").addEventListener("input", renderMusicPreview);

    if (state.token) {
      document.getElementById("loginView").classList.add("hidden");
      document.getElementById("appView").classList.remove("hidden");
      loadAdminData().catch(() => logout());
    }
  
