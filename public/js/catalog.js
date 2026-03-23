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
            image: banner.image || "",
            cta: banner.cta || banner.ctaLabel || "Открыть",
            secondary: banner.secondary || banner.secondaryLabel || "",
            action: mapAction(banner.actionType, banner.actionValue),
            secondaryAction: mapAction(banner.secondaryActionType, banner.secondaryActionValue),
          };
        })
        .filter((slide) => slide.image && slide.title);

      return adminSlides;
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

    function getProductPageSize() {
      return PRODUCTS_PER_PAGE;
    }

    function resetProductPage() {
      state.productPage = 1;
    }

    function getProductPageCount(totalItems) {
      return Math.max(1, Math.ceil(totalItems / getProductPageSize()));
    }

    function syncProductPage(totalItems) {
      const totalPages = getProductPageCount(totalItems);
      const nextPage = Math.min(Math.max(Number(state.productPage) || 1, 1), totalPages);
      state.productPage = nextPage;
      return totalPages;
    }

    function goToProductPage(productId) {
      const filtered = getFilteredProducts();
      const productIndex = filtered.findIndex((product) => Number(product.id) === Number(productId));
      if (productIndex === -1) {
        resetProductPage();
        return false;
      }

      state.productPage = Math.floor(productIndex / getProductPageSize()) + 1;
      return true;
    }

    function scrollToProductList() {
      const list = document.getElementById("productList");
      if (!list) return;
      list.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function buildProductPaginationItems(totalPages, currentPage) {
      if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
      }

      const items = [1];
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      if (startPage > 2) {
        items.push("ellipsis-start");
      }

      for (let page = startPage; page <= endPage; page += 1) {
        items.push(page);
      }

      if (endPage < totalPages - 1) {
        items.push("ellipsis-end");
      }

      items.push(totalPages);
      return items;
    }

    function renderProductPagination(paginationState) {
      const pagination = document.getElementById("productPagination");
      if (!pagination) return;

      if (!paginationState || paginationState.totalPages <= 1) {
        pagination.hidden = true;
        pagination.innerHTML = "";
        return;
      }

      const { totalItems, totalPages, currentPage, startIndex, endIndex } = paginationState;
      const pageItems = buildProductPaginationItems(totalPages, currentPage);

      pagination.hidden = false;
      pagination.innerHTML = `
        <div class="pagination-summary">${startIndex + 1}-${endIndex} \u0438\u0437 ${totalItems}</div>
        <div class="pagination-controls" aria-label="\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u044b \u0442\u043e\u0432\u0430\u0440\u043e\u0432">
          <button
            class="pagination-btn pagination-nav"
            type="button"
            data-page="${currentPage - 1}"
            ${currentPage === 1 ? "disabled" : ""}
            aria-label="\u041f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0430\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430"
          >\u2039</button>
          <div class="pagination-pages">
            ${pageItems.map((item) => {
              if (typeof item !== "number") {
                return '<span class="pagination-ellipsis" aria-hidden="true">...</span>';
              }

              return `
                <button
                  class="pagination-btn${item === currentPage ? " active" : ""}"
                  type="button"
                  data-page="${item}"
                  ${item === currentPage ? 'aria-current="page"' : ""}
                >${item}</button>
              `;
            }).join("")}
          </div>
          <button
            class="pagination-btn pagination-nav"
            type="button"
            data-page="${currentPage + 1}"
            ${currentPage === totalPages ? "disabled" : ""}
            aria-label="\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430"
          >\u203a</button>
        </div>
      `;

      pagination.querySelectorAll("[data-page]").forEach((button) => {
        button.addEventListener("click", () => {
          const nextPage = Number(button.dataset.page);
          if (!Number.isFinite(nextPage) || nextPage === state.productPage) {
            return;
          }

          state.productPage = nextPage;
          renderProducts();
          requestAnimationFrame(scrollToProductList);
        });
      });
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

      if (action.type === "product" && action.productId) {
        goToProductPage(action.productId);
      } else {
        resetProductPage();
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
      if (!promoState.slides.length) {
        shell.classList.add("hidden");
        track.innerHTML = "";
        dotsWrap.innerHTML = "";
        if (prevBtn) prevBtn.hidden = true;
        if (nextBtn) nextBtn.hidden = true;
        stopPromoAutoplay();
        return;
      }

      shell.classList.remove("hidden");
      promoState.index = Math.min(promoState.index, Math.max(promoState.slides.length - 1, 0));
      if (prevBtn) prevBtn.hidden = promoState.slides.length < 2;
      if (nextBtn) nextBtn.hidden = promoState.slides.length < 2;
      dotsWrap.hidden = promoState.slides.length < 2;

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
        const searchableVariants = product.variantOptions?.searchableValues || product.variants || [];
        const bySearch = !query || [product.name, product.desc, ...searchableVariants].join(" ").toLowerCase().includes(query);
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
      if (!list) return;
      const filtered = getFilteredProducts();
      const totalPages = syncProductPage(filtered.length);
      const currentPage = state.productPage;
      const pageSize = getProductPageSize();
      const startIndex = (currentPage - 1) * pageSize;
      const pageItems = filtered.slice(startIndex, startIndex + pageSize);
      const endIndex = startIndex + pageItems.length;
      list.innerHTML = "";

      if (!filtered.length) {
        renderProductPagination(null);
        list.innerHTML = '<div class="empty-text">Ничего не найдено.</div>';
        return;
      }

      pageItems.forEach((product) => {
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

          const variantOptions = product.variantOptions || parseProductVariantOptions(product.variants);
          const variants = Array.isArray(variantOptions.variants) ? variantOptions.variants : [];
          const colors = Array.isArray(variantOptions.colors) ? variantOptions.colors : [];
          const models = Array.isArray(variantOptions.models) ? variantOptions.models : [];
          const buildVariantSelect = (kind, label, values) => values.length
            ? `
              <label class="variant-picker">
                <span class="variant-picker-label">${label}</span>
                <select class="variant-select" data-variant-kind="${kind}" data-product-id="${product.id}">
                  ${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}
                </select>
              </label>
            `
            : "";
          const variantSelectHtml = (models.length || colors.length || variants.length > 1)
            ? `
              <div class="variant-picker-stack">
                ${buildVariantSelect("model", "Модель", models)}
                ${buildVariantSelect("color", "Цвет", colors)}
                ${variants.length > 1 ? buildVariantSelect("variant", "Вариант", variants) : ""}
              </div>
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
            const selectedVariant = formatSelectedVariant({
              model: card.querySelector('[data-variant-kind="model"]')?.value || models[0] || "",
              color: card.querySelector('[data-variant-kind="color"]')?.value || colors[0] || "",
              variant: card.querySelector('[data-variant-kind="variant"]')?.value || (variants.length === 1 ? variants[0] : "")
            });
            addToCart(product.id, selectedVariant);
          };

          initCardCarousel(card);
          list.appendChild(card);
        } catch (error) {
          console.error("Failed to render product card", product, error);
        }
      });

      renderProductPagination({
        totalItems: filtered.length,
        totalPages,
        currentPage,
        startIndex,
        endIndex,
      });

      if (!list.children.length) {
        renderProductPagination(null);
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
          goToProductPage(product.id);
          renderCategories();
          renderProducts();
          switchView("shop");
          focusPromoProduct(product.id);
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
