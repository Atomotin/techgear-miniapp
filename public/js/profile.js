// Profile, navigation state, event bindings, and app bootstrap

function ensureProfileNavigation() {
      const nav = document.querySelector(".bottom-nav-inner");
      if (!nav) return;

      const shopLabel = nav.querySelector("#shopBtn .nav-label");
      const favoritesLabel = nav.querySelector("#favoritesBtn .nav-label");
      const cartLabel = nav.querySelector("#cartBtn .nav-label");
      if (shopLabel) shopLabel.textContent = "Магазин";
      if (favoritesLabel) favoritesLabel.textContent = `Избранное (${state.favorites.length})`;
      if (cartLabel) cartLabel.textContent = `Корзина (${state.cart.reduce((sum, item) => sum + item.qty, 0)})`;

      const contactLink = nav.querySelector(".contact-btn");
      if (contactLink) contactLink.style.display = "none";

      let profileBtn = document.getElementById("profileBtn");
      if (!profileBtn) {
        profileBtn = document.createElement("button");
        profileBtn.id = "profileBtn";
        profileBtn.type = "button";
        profileBtn.innerHTML = '<span class="nav-icon">👤</span><span class="nav-label">Профиль</span>';
        profileBtn.addEventListener("click", () => switchView("profile"));
        nav.appendChild(profileBtn);
      }
    }

    function renderProfile() {
      const profileView = document.getElementById("profileView");
      if (!profileView) return;

      const avatar = document.getElementById("profileAvatar");
      const completion = document.getElementById("profileCompletion");
      const cartCount = document.getElementById("profileCartCount");
      const favoritesCount = document.getElementById("profileFavoritesCount");

      const source = (state.profile.name || state.profile.username || "TG").replace(/^@/, "").trim();
      if (avatar) avatar.textContent = (source.slice(0, 2) || "TG").toUpperCase();

      const fields = [
        state.profile.name,
        state.profile.phone,
        state.profile.username,
        state.profile.delivery,
        state.profile.comment,
      ];
      const filled = fields.filter((value) => String(value || "").trim()).length;
      const percent = Math.round((filled / fields.length) * 100);

      if (completion) completion.textContent = `${percent}%`;
      if (cartCount) cartCount.textContent = String(state.cart.reduce((sum, item) => sum + item.qty, 0));
      if (favoritesCount) favoritesCount.textContent = String(state.favorites.length);

      const profileMap = {
        profileName: state.profile.name || "",
        profilePhone: state.profile.phone || "",
        profileUsername: state.profile.username || "",
        profileDelivery: state.profile.delivery || "",
        profileComment: state.profile.comment || "",
      };

      Object.entries(profileMap).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element && document.activeElement !== element) {
          element.value = value;
        }
      });
      updateProfileOnboardingState();
    }

    function persistProfileFields() {
      const profilePhone = document.getElementById("profilePhone");
      if (profilePhone) {
        profilePhone.value = formatPhoneInput(profilePhone.value);
      }

      const profileName = document.getElementById("profileName");
      const profileUsername = document.getElementById("profileUsername");
      const profileDelivery = document.getElementById("profileDelivery");
      const profileComment = document.getElementById("profileComment");
      if (profileName) profileName.value = sanitizeNameInput(profileName.value);
      if (profileUsername) profileUsername.value = sanitizeUsernameInput(profileUsername.value);
      if (profileDelivery) profileDelivery.value = sanitizeLongText(profileDelivery.value, 300);
      if (profileComment) profileComment.value = sanitizeLongText(profileComment.value, 500);

      state.profile = {
        name: document.getElementById("profileName")?.value.trim() || "",
        phone: document.getElementById("profilePhone")?.value.trim() || "",
        username: document.getElementById("profileUsername")?.value.trim() || "",
        delivery: document.getElementById("profileDelivery")?.value.trim() || "",
        comment: document.getElementById("profileComment")?.value.trim() || "",
      };

      saveStorage(STORAGE_KEYS.profile, state.profile);
      renderProfile();
    }

    function applyProfileToCheckout() {
      state.checkout = {
        ...state.checkout,
        name: state.profile.name || "",
        phone: state.profile.phone || "",
        username: state.profile.username || "",
        delivery: state.profile.delivery || "",
        comment: state.profile.comment || "",
      };
      saveStorage(STORAGE_KEYS.checkout, state.checkout);
      fillCheckoutFields();
    }

    function readServerProfileField(customer = {}, key, fallback = "") {
      if (!Object.prototype.hasOwnProperty.call(customer, key)) {
        return fallback;
      }

      return String(customer[key] || "").trim();
    }

    function syncProfileFromServer(customer = {}) {
      state.profile = {
        name: readServerProfileField(customer, "name", state.profile.name || ""),
        phone: readServerProfileField(customer, "phone", state.profile.phone || ""),
        username: readServerProfileField(customer, "username", state.profile.username || ""),
        delivery: readServerProfileField(customer, "delivery", state.profile.delivery || ""),
        comment: readServerProfileField(customer, "comment", state.profile.comment || ""),
      };
      saveStorage(STORAGE_KEYS.profile, state.profile);
      renderProfile();
    }

    async function saveProfileToServer() {
      if (!state.profile.name) {
        throw new Error("Введите имя");
      }

      if (!/^[\p{L}\s'-]+$/u.test(state.profile.name)) {
        throw new Error("В имени нельзя цифры и эмодзи");
      }

      const telegramUser = getTelegramUser();
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...state.profile,
          telegramId: telegramUser?.id ? String(telegramUser.id) : ""
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Не удалось сохранить профиль");
      }

      if (data.customer) {
        syncProfileFromServer(data.customer);
        applyProfileToCheckout();
      }
    }

    async function loadProfileFromServer() {
      const telegramUser = getTelegramUser();
      const query = new URLSearchParams();
      if (telegramUser?.id) query.set("telegramId", String(telegramUser.id));
      if (state.profile.phone) query.set("phone", state.profile.phone);
      if (state.profile.username) query.set("username", state.profile.username);
      if (!query.toString()) return;

      try {
        const response = await fetch(`/api/profile?${query.toString()}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.customer) return;

        syncProfileFromServer(data.customer);
      } catch (error) {
        console.warn("Profile sync failed:", error);
      }
    }

    function isRegisteredProfile() {
      return Boolean(String(state.profile.name || "").trim() && String(state.profile.phone || "").trim());
    }

    function updateProfileOnboardingState() {
      const notice = document.getElementById("profileOnboardingNotice");
      const fillCheckoutBtn = document.getElementById("fillCheckoutBtn");
      const registered = isRegisteredProfile();

      if (notice) {
        notice.style.display = registered ? "none" : "block";
      }

      if (fillCheckoutBtn) {
        fillCheckoutBtn.style.display = "inline-flex";
        fillCheckoutBtn.textContent = registered ? "Заполнить заказ" : "Сохранить и подставить в заказ";
      }

      const profileBtn = document.getElementById("profileBtn");
      if (profileBtn) {
        profileBtn.style.opacity = "1";
        profileBtn.style.pointerEvents = "auto";
      }
    }

    function updateCartButton() {
      const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
      const cartBtnLabel = document.querySelector("#cartBtn .nav-label");
      if (cartBtnLabel) {
        cartBtnLabel.textContent = `Корзина (${totalItems})`;
      }
      renderProfile();
    }

    function updateFavoritesButton() {
      const favoriteBtnLabel = document.querySelector("#favoritesBtn .nav-label");
      if (favoriteBtnLabel) {
        favoriteBtnLabel.textContent = `Избранное (${state.favorites.length})`;
      }
      renderProfile();
    }

    function switchView(view) {
      const shopView = document.getElementById("shopView");
      const cartView = document.getElementById("cartView");
      const favoritesView = document.getElementById("favoritesView");
      const profileView = document.getElementById("profileView");
      const shopBtn = document.getElementById("shopBtn");
      const cartBtn = document.getElementById("cartBtn");
      const favoritesBtn = document.getElementById("favoritesBtn");
      const profileBtn = document.getElementById("profileBtn");

      [shopView, cartView, favoritesView, profileView].forEach((node) => node?.classList.add("hidden"));
      [shopBtn, cartBtn, favoritesBtn, profileBtn].forEach((node) => node?.classList.remove("active"));

      if (view === "favorites") {
        favoritesView?.classList.remove("hidden");
        favoritesBtn?.classList.add("active");
        renderFavorites();
      } else if (view === "cart") {
        cartView?.classList.remove("hidden");
        cartBtn?.classList.add("active");
      } else if (view === "profile") {
        profileView?.classList.remove("hidden");
        profileBtn?.classList.add("active");
        renderProfile();
      } else {
        shopView?.classList.remove("hidden");
        shopBtn?.classList.add("active");
      }

      state.activeView = view;
      saveStorage(STORAGE_KEYS.activeView, view);
    }

    const originalSubmitOrder = submitOrder;
    submitOrder = function gatedSubmitOrderOnly() {
      if (!requireRegisteredProfile("Чтобы оформить заказ, сначала заполните профиль")) return;
      return originalSubmitOrder();
    }

    document.getElementById("searchInput").addEventListener("input", function (e) {
      state.search = e.target.value;
      state.productPage = 1;
      renderProducts();
    });

    document.getElementById("availabilityFilter").addEventListener("change", function (e) {
      state.availability = e.target.value;
      state.productPage = 1;
      renderProducts();
    });

    document.getElementById("sortSelect").addEventListener("change", function (e) {
      state.sort = e.target.value;
      state.productPage = 1;
      renderProducts();
    });

    document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
    document.getElementById("lightboxPrev").addEventListener("click", () => moveLightbox(-1));
    document.getElementById("lightboxNext").addEventListener("click", () => moveLightbox(1));
    document.getElementById("imageLightbox").addEventListener("click", function (e) {
      if (e.target.id === "imageLightbox") {
        closeLightbox();
      }
    });

    document.getElementById("imageLightbox").addEventListener("touchstart", function (e) {
      lightboxState.touchStartX = e.touches[0].clientX;
    }, { passive: true });

    document.getElementById("imageLightbox").addEventListener("touchend", function (e) {
      const deltaX = e.changedTouches[0].clientX - lightboxState.touchStartX;
      if (Math.abs(deltaX) > 40) {
        moveLightbox(deltaX < 0 ? 1 : -1);
      }
    });

    document.addEventListener("keydown", function (e) {
      const lightbox = document.getElementById("imageLightbox");
      if (lightbox.classList.contains("hidden")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") moveLightbox(-1);
      if (e.key === "ArrowRight") moveLightbox(1);
    });

    async function bootstrapApp() {
      const catalogTask = loadCatalogFromApi().then(() => {
        setToolbarState();
        renderPromoBanner();
        renderCategories();
        renderProducts();
        renderFavorites();
      });

      if (!state.profile.name && !state.profile.phone && !state.profile.username && !state.profile.delivery) {
        state.profile = {
          name: state.checkout.name || "",
          phone: state.checkout.phone || "",
          username: state.checkout.username || "",
          delivery: state.checkout.delivery || "",
          comment: state.checkout.comment || "",
        };
        saveStorage(STORAGE_KEYS.profile, state.profile);
      }

      const profileTask = loadProfileFromServer().then(() => {
        applyProfileToCheckout();
        fillCheckoutFields();
        renderProfile();
        updateProfileOnboardingState();
        renderCart();
      });

      ensureProfileNavigation();
      bindProfileControls();
      applyProfileToCheckout();
      fillCheckoutFields();
      renderProfile();
      updateProfileOnboardingState();
      setToolbarState();
      renderPromoBanner();
      renderCategories();
      renderProducts();
      renderFavorites();
      renderCart();
      updateCartButton();
      updateFavoritesButton();
      switchView(state.activeView || "shop");
      trackMiniAppOpen();

      void catalogTask;
      void profileTask;
    }

    bootstrapApp()
      .then(() => hideAppSplash())
      .catch((error) => {
        console.error("Bootstrap failed:", error);
        hideAppSplash({ immediate: true });
        showToast("Не удалось загрузить все данные", "error");
      });
  

