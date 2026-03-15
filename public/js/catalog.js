// Catalog, promo banner, favorites, and lightbox UI

function buildPromoSlides() {
      const adminSlides = (Array.isArray(PROMO_BANNERS) ? PROMO_BANNERS : [])
        .filter((banner) => banner && banner.isActive !== false)
        .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))
        .map((banner, index) => {
          const mapAction = (type, value) => {
            if (!type) return null;
            if (type === "link") return value ? { type: "link", href: value } : null;
            if (type === "category") return { type: "category", category: value || "all", sort: "manual" };
            if (type === "product") return { type: "product", productId: Number(value), sort: "manual" };
            return { type: "reset" };
          };

          return {
            id: `banner-${banner.id || index}`,
            kicker: banner.kicker || "TechGear",
            title: banner.title || "Новая подборка",
            text: "",
            chips: [],
            image: banner.image || "images.img/lolo.png",
            cta: banner.ctaLabel || "Открыть",
            secondary: banner.secondaryLabel || "",
            action: mapAction(banner.actionType, banner.actionValue),
            secondaryAction: mapAction(banner.secondaryActionType, banner.secondaryActionValue),
          };
        })
        .filter((slide) => slide.image && slide.title);

      if (adminSlides.length) {
        return adminSlides;
      }

      const catalog = normalizeProducts(PRODUCTS);
      const hotProduct = catalog.find((item) => item.badge === "hot" && item.images?.length) || catalog.find((item) => item.badge === "hot");
      const newProduct = catalog.find((item) => item.badge === "new" && item.images?.length) || catalog.find((item) => item.badge === "new");
      const setupPick = catalog.find((item) => item.category === "decor" && item.images?.length)
        || catalog.find((item) => item.category === "headphones" && item.images?.length)
        || catalog.find((item) => item.images?.length);

      const uniqueSlides = [];
      const addSlide = (slide) => {
        if (!slide || uniqueSlides.some((item) => item.id === slide.id)) return;
        uniqueSlides.push(slide);
      };

      addSlide(hotProduct && {
        id: `hot-${hotProduct.id}`,
        kicker: "Хит продаж",
        title: hotProduct.name,
        text: "",
        chips: ["Хиты", formatPrice(hotProduct.price), hotProduct.stock || "В наличии"],
        image: hotProduct.images?.[0] || "",
        cta: "Смотреть",
        secondary: "",
        action: {
          type: "product",
          productId: hotProduct.id,
          category: hotProduct.category || "all",
          sort: "manual",
        },
      });

      addSlide(newProduct && {
        id: `new-${newProduct.id}`,
        kicker: "Новая поставка",
        title: "Новинки в каталоге",
        text: "",
        chips: ["Новинки", newProduct.stock || "Скоро", newProduct.variants?.length ? `${newProduct.variants.length} вариантов` : "Свежий ассортимент"],
        image: newProduct.images?.[0] || "",
        cta: "Новинки",
        secondary: "",
        action: {
          type: "product",
          productId: newProduct.id,
          category: newProduct.category || "all",
          sort: "newest",
        },
      });

      addSlide(setupPick && {
        id: `pick-${setupPick.id}`,
        kicker: "Подборка TechGear",
        title: "Аксессуары для сетапа",
        text: "",
        chips: ["Подборка", "Декор", "Сетап"],
        image: setupPick.images?.[0] || "",
        cta: "Подборка",
        secondary: "",
        action: {
          type: "category",
          category: setupPick.category || "decor",
          sort: "manual",
        },
      });

      if (!uniqueSlides.length) {
        uniqueSlides.push({
          id: "fallback",
          kicker: "TechGear",
          title: "Новинки, хиты и акции",
          text: "",
          chips: ["Mini App", "Каталог", "Telegram"],
          image: "images.img/lolo.png",
          cta: "Каталог",
          secondary: "",
          action: { type: "reset" },
        });
      }

      return uniqueSlides;
    }

    function setPromoIndex(nextIndex) {
      const track = document.getElementById("promoTrack");
      const dots = document.querySelectorAll(".promo-dot");
      if (!track || !promoState.slides.length) return;

      promoState.index = (nextIndex + promoState.slides.length) % promoState.slides.length;
      track.style.transform = `translateX(-${promoState.index * 100}%)`;
      dots.forEach((dot, index) => {
        dot.classList.toggle("active", index === promoState.index);
      });
    }

    function stopPromoAutoplay() {
      if (promoState.timerId) {
        clearInterval(promoState.timerId);
        promoState.timerId = null;
      }
    }

    function startPromoAutoplay() {
      stopPromoAutoplay();
      if (promoState.slides.length < 2) return;
      promoState.timerId = setInterval(() => {
        setPromoIndex(promoState.index + 1);
      }, 4600);
    }

    function focusPromoProduct(productId) {
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-product-id="${productId}"]`);
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    function applyPromoAction(action) {
      if (!action) return;

      if (action.type === "link" && action.href) {
        window.open(action.href, "_blank", "noopener,noreferrer");
        return;
      }

      state.search = "";
      state.availability = "all";

      if (action.type === "reset") {
        state.activeCategory = "all";
        state.sort = "manual";
      }

      if (action.type === "category") {
        state.activeCategory = action.category || "all";
        state.sort = action.sort || "manual";
      }

      if (action.type === "product") {
        state.activeCategory = action.category || "all";
        state.sort = action.sort || "manual";
      }

      setToolbarState();
      renderCategories();
      renderProducts();
      switchView("shop");

      if (action.type === "product" && action.productId) {
        focusPromoProduct(action.productId);
      }
    }

    function renderPromoBanner() {
      const shell = document.getElementById("promoBanner");
      const track = document.getElementById("promoTrack");
      const dotsWrap = document.getElementById("promoDots");
      const prevBtn = document.getElementById("promoPrev");
      const nextBtn = document.getElementById("promoNext");
      if (!shell || !track || !dotsWrap) return;

      promoState.slides = buildPromoSlides();
      promoState.index = Math.min(promoState.index, Math.max(promoState.slides.length - 1, 0));

      track.innerHTML = promoState.slides.map((slide) => {
        const imageHtml = slide.image
          ? `<img src="${escapeHtml(slide.image)}" alt="${escapeHtml(slide.title)}" loading="lazy" onerror="if(this.dataset.fallbackApplied)return;this.dataset.fallbackApplied='1';this.src=window.__TG_IMAGE_FALLBACK__;">`
          : `<div class="promo-fallback">TG</div>`;

        return `
          <article class="promo-slide${slide.action ? " is-clickable" : ""}" data-promo-slide="${escapeHtml(slide.id)}" aria-label="${escapeHtml(slide.title)}">
            <div class="promo-visual">${imageHtml}</div>
          </article>
        `;
      }).join("");

      dotsWrap.innerHTML = promoState.slides.map((slide, index) => (
        `<button class="promo-dot${index === promoState.index ? " active" : ""}" type="button" data-promo-dot="${index}" aria-label="${escapeHtml(slide.kicker)}"></button>`
      )).join("");

      track.querySelectorAll("[data-promo-slide]").forEach((slideNode) => {
        slideNode.addEventListener("click", () => {
          if (promoState.suppressClick) {
            promoState.suppressClick = false;
            return;
          }
          const slide = promoState.slides.find((item) => item.id === slideNode.dataset.promoSlide);
          applyPromoAction(slide?.action);
        });
      });

      dotsWrap.querySelectorAll("[data-promo-dot]").forEach((dot) => {
        dot.addEventListener("click", () => {
          setPromoIndex(Number(dot.dataset.promoDot || 0));
          startPromoAutoplay();
        });
      });

      if (prevBtn) prevBtn.onclick = () => {
        setPromoIndex(promoState.index - 1);
        startPromoAutoplay();
      };

      if (nextBtn) nextBtn.onclick = () => {
        setPromoIndex(promoState.index + 1);
        startPromoAutoplay();
      };

      if (!shell.dataset.swipeBound) {
        shell.dataset.swipeBound = "1";

        shell.addEventListener("touchstart", (e) => {
          stopPromoAutoplay();
          promoState.touchStartX = e.touches[0].clientX;
          promoState.touchMoved = false;
        }, { passive: true });

        shell.addEventListener("touchmove", (e) => {
          if (Math.abs(e.touches[0].clientX - promoState.touchStartX) > 8) {
            promoState.touchMoved = true;
          }
        }, { passive: true });

        shell.addEventListener("touchend", (e) => {
          const deltaX = e.changedTouches[0].clientX - promoState.touchStartX;
          if (Math.abs(deltaX) > 40) {
            promoState.suppressClick = true;
            setPromoIndex(promoState.index + (deltaX < 0 ? 1 : -1));
          }
          startPromoAutoplay();
        }, { passive: true });
      }

      setPromoIndex(promoState.index);
      startPromoAutoplay();
    }

    function getFilteredProducts() {
      const query = state.search.trim().toLowerCase();
      const filtered = normalizeProducts(PRODUCTS).filter((product) => {
        const byCategory = state.activeCategory === "all" || product.category === state.activeCategory;
        const bySearch = !query || [product.name, product.desc, ...(product.variants || [])].join(" ").toLowerCase().includes(query);
        const byAvailability = state.availability === "all"
          || (state.availability === "available" && !product.isSoon)
          || (state.availability === "soon" && product.isSoon);
        return byCategory && bySearch && byAvailability;
      });

      const sorted = [...filtered];
      sorted.sort((a, b) => {
        if (state.sort === "price-asc") return (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER);
        if (state.sort === "price-desc") return (b.price || 0) - (a.price || 0);
        if (state.sort === "name") return a.name.localeCompare(b.name, "ru");
        if (state.sort === "newest") {
          const score = (item) => item.badge === "new" ? 0 : item.badge === "hot" ? 1 : item.isSoon ? 2 : 3;
          const diff = score(a) - score(b);
          return diff || a.sortOrder - b.sortOrder;
        }
        return a.sortOrder - b.sortOrder;
      });

      return sorted;
    }

    function renderProducts() {
      const list = document.getElementById("productList");
      const filtered = getFilteredProducts();
      list.innerHTML = "";

      if (!filtered.length) {
        list.innerHTML = '<div class="empty-text">Ничего не найдено.</div>';
        return;
      }

      filtered.forEach((product) => {
        try {
          const card = document.createElement("div");
          card.className = "card";
          card.dataset.productId = String(product.id);
          const images = Array.isArray(product.images) ? product.images : [];
          const mediaHtml = images.length > 1
            ? `
              <div class="product-media zoomable" data-carousel>
                <div class="product-track">
                  ${images.map((src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)}" class="product-image" loading="lazy" onerror="if(this.dataset.fallbackApplied)return;this.dataset.fallbackApplied='1';this.src=window.__TG_IMAGE_FALLBACK__;">`).join("")}
                </div>
                <button class="carousel-btn prev" type="button" aria-label="Предыдущее фото">‹</button>
                <button class="carousel-btn next" type="button" aria-label="Следующее фото">›</button>
                <div class="carousel-dots">
                  ${images.map((_, index) => `<button class="carousel-dot${index === 0 ? " active" : ""}" type="button" data-index="${index}" aria-label="Фото ${index + 1}"></button>`).join("")}
                </div>
              </div>
            `
            : (images[0] ? `<div class="product-media zoomable" data-single-image="${escapeHtml(images[0])}"><img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" class="product-image" loading="lazy" onerror="if(this.dataset.fallbackApplied)return;this.dataset.fallbackApplied='1';this.src=window.__TG_IMAGE_FALLBACK__;"></div>` : "");

          const variants = Array.isArray(product.variants) ? product.variants : [];
          const variantsHtml = variants.length
            ? `<div class="variants">${variants.map((v) => `<span class="variant">${escapeHtml(v)}</span>`).join("")}</div>`
            : "";
          const variantSelectHtml = variants.length > 1
            ? `
              <select class="variant-select" data-product-id="${product.id}">
                ${variants.map((variant) => `<option value="${escapeHtml(variant)}">${escapeHtml(variant)}</option>`).join("")}
              </select>
            `
            : "";
          const favoriteActive = isFavorite(product.id);
          const cardDescription = getCardDescription(product);

          card.innerHTML = `
            ${mediaHtml}
            <div class="card-content">
              <h3>${escapeHtml(product.name)}</h3>
              ${cardDescription ? `<div class="desc">${escapeHtml(cardDescription)}</div>` : ""}
              <div class="stock">${escapeHtml(product.stock)}</div>
              ${variantsHtml}
              ${variantSelectHtml}
              <div class="meta-row">
                ${renderProductPrice(product)}
                <div class="card-actions-row">
                  <button class="favorite-btn${favoriteActive ? " active" : ""}" type="button" aria-label="${favoriteActive ? "Убрать из избранного" : "Добавить в избранное"}">${favoriteActive ? "❤" : "♡"}</button>
                  <button class="btn btn-primary" type="button">${product.isSoon ? "Предзаказ" : "В корзину"}</button>
                </div>
              </div>
            </div>
          `;

          card.querySelector(".favorite-btn").onclick = () => toggleFavorite(product.id);
          card.querySelector(".btn-primary").onclick = () => {
            const select = card.querySelector(".variant-select");
            const selectedVariant = select?.value || variants[0] || "";
            addToCart(product.id, selectedVariant);
          };

          initCardCarousel(card);
          list.appendChild(card);
        } catch (error) {
          console.error("Failed to render product card", product, error);
        }
      });

      if (!list.children.length) {
        list.innerHTML = '<div class="empty-text">Не удалось отрисовать товары. Обновите Mini App.</div>';
      }
    }

    function renderFavorites() {
      const list = document.getElementById("favoriteList");
      if (!list) return;

      const favorites = getFavoriteProducts();
      list.innerHTML = "";

      if (!favorites.length) {
        list.innerHTML = '<div class="empty-text">Пока пусто. Добавляй понравившиеся товары в избранное прямо из каталога.</div>';
        return;
      }

      favorites.forEach((product) => {
        const card = document.createElement("div");
        card.className = "card";
        const images = product.images || [];
        const imageSrc = images[0] ? escapeHtml(images[0]) : "";
        const cardDescription = getCardDescription(product);

        card.innerHTML = `
          ${imageSrc ? `<div class="product-media zoomable" data-single-image="${imageSrc}"><img src="${imageSrc}" alt="${escapeHtml(product.name)}" class="product-image" loading="lazy" onerror="if(this.dataset.fallbackApplied)return;this.dataset.fallbackApplied='1';this.src=window.__TG_IMAGE_FALLBACK__;"></div>` : ""}
          <div class="card-content">
            <h3>${escapeHtml(product.name)}</h3>
            ${cardDescription ? `<div class="desc">${escapeHtml(cardDescription)}</div>` : ""}
            <div class="stock">${escapeHtml(product.stock)}</div>
            <div class="meta-row">
              ${renderProductPrice(product)}
              <div class="card-actions-row">
                <button class="favorite-btn active" type="button" aria-label="Убрать из избранного">❤</button>
                <button class="btn btn-primary" type="button">Открыть</button>
              </div>
            </div>
          </div>
        `;

        const media = card.querySelector("[data-single-image]");
        media?.addEventListener("click", () => openLightbox([media.dataset.singleImage], 0));
        card.querySelector(".favorite-btn").onclick = () => toggleFavorite(product.id);
        card.querySelector(".btn-primary").onclick = () => {
          state.activeCategory = product.category || "all";
          renderCategories();
          renderProducts();
          switchView("shop");
          showToast(`Открыт товар: ${product.name}`);
        };

        list.appendChild(card);
      });
    }

    function initCardCarousel(card) {
      const carousel = card.querySelector("[data-carousel]");
      const singleMedia = card.querySelector("[data-single-image]");

      if (singleMedia) {
        singleMedia.addEventListener("click", () => openLightbox([singleMedia.dataset.singleImage], 0));
      }

      if (!carousel) return;

      const track = carousel.querySelector(".product-track");
      const slides = carousel.querySelectorAll(".product-image");
      const dots = carousel.querySelectorAll(".carousel-dot");
      const prevBtn = carousel.querySelector(".carousel-btn.prev");
      const nextBtn = carousel.querySelector(".carousel-btn.next");
      const imageSources = Array.from(slides).map((img) => img.getAttribute("src"));
      let currentIndex = 0;
      let autoplayId = null;
      let startX = 0;
      let moved = false;

      const updateCarousel = (index) => {
        const total = slides.length;
        currentIndex = (index + total) % total;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        dots.forEach((dot, dotIndex) => {
          dot.classList.toggle("active", dotIndex === currentIndex);
        });
      };

      const startAutoplay = () => {
        stopAutoplay();
        if (slides.length < 2) return;
        autoplayId = setInterval(() => updateCarousel(currentIndex + 1), 3200);
      };

      const stopAutoplay = () => {
        if (autoplayId) {
          clearInterval(autoplayId);
          autoplayId = null;
        }
      };

      prevBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        updateCarousel(currentIndex - 1);
        startAutoplay();
      });
      nextBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        updateCarousel(currentIndex + 1);
        startAutoplay();
      });
      dots.forEach((dot, index) => {
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          updateCarousel(index);
          startAutoplay();
        });
      });

      carousel.addEventListener("mouseenter", stopAutoplay);
      carousel.addEventListener("mouseleave", startAutoplay);

      carousel.addEventListener("touchstart", (e) => {
        stopAutoplay();
        startX = e.touches[0].clientX;
        moved = false;
      }, { passive: true });

      carousel.addEventListener("touchmove", (e) => {
        if (Math.abs(e.touches[0].clientX - startX) > 8) {
          moved = true;
        }
      }, { passive: true });

      carousel.addEventListener("touchend", (e) => {
        const endX = e.changedTouches[0].clientX;
        const deltaX = endX - startX;
        if (Math.abs(deltaX) > 40) {
          updateCarousel(currentIndex + (deltaX < 0 ? 1 : -1));
        } else if (!moved) {
          openLightbox(imageSources, currentIndex);
        }
        startAutoplay();
      });

      carousel.addEventListener("click", (e) => {
        if (e.target.closest(".carousel-btn") || e.target.closest(".carousel-dot")) return;
        openLightbox(imageSources, currentIndex);
      });

      startAutoplay();
    }

    function renderLightbox() {
      const image = document.getElementById("lightboxImage");
      const dots = document.getElementById("lightboxDots");
      if (!image || !dots || !lightboxState.images.length) return;

      image.src = lightboxState.images[lightboxState.index];
      dots.innerHTML = lightboxState.images.map((_, index) =>
        `<button class="carousel-dot${index === lightboxState.index ? " active" : ""}" type="button" data-lightbox-index="${index}" aria-label="Фото ${index + 1}"></button>`
      ).join("");

      dots.querySelectorAll("[data-lightbox-index]").forEach((dot) => {
        dot.addEventListener("click", () => {
          lightboxState.index = Number(dot.dataset.lightboxIndex) || 0;
          renderLightbox();
        });
      });
    }

    function openLightbox(images, startIndex = 0) {
      const lightbox = document.getElementById("imageLightbox");
      if (!lightbox || !images.length) return;

      lightboxState.images = images;
      lightboxState.index = startIndex;
      renderLightbox();
      lightbox.classList.remove("hidden");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
      const lightbox = document.getElementById("imageLightbox");
      if (!lightbox) return;
      lightbox.classList.add("hidden");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function moveLightbox(step) {
      if (!lightboxState.images.length) return;
      const total = lightboxState.images.length;
      lightboxState.index = (lightboxState.index + step + total) % total;
      renderLightbox();
    }
