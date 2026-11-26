(function () {
  const SERVICE_THEME_FALLBACKS = [
    "doctor",
    "ultrasound",
    "analyses",
    "checkup",
    "xray",
  ];

  const BENEFIT_THEME_FALLBACKS = ["care", "route", "quality"];
  const SECTION_ROUTE_MAP = {
    "#top": "/",
    "#about": "/about",
    "#services": "/services",
    "#prices": "/services#prices",
    "#trust": "/#trust",
    "#faq": "/#faq",
    "#doctors": "/doctors",
    "#benefits": "/about#benefits",
    "#materials": "/about#materials",
    "#gallery": "/about#gallery",
    "#reviews": "/doctors#reviews",
    "#contacts": "/contacts",
    "#documents": "/about#documents",
  };
  let toastStack;
  let revealObserver;
  let metricObserver;
  let globalMotionBound = false;
  let mobileMenuBound = false;
  let reviewSliderCleanup;
  let currentLocale = "ru";
  let currentContent = null;
  let localeToggleBound = false;
  let localeInitialized = false;

  function getI18n() {
    return window.MedsiteI18n || null;
  }

  function normalizeLocale(locale) {
    return String(locale || "").trim() === "kz" ? "kz" : "ru";
  }

  function getCurrentLocale() {
    if (localeInitialized) {
      return normalizeLocale(currentLocale);
    }

    const i18n = getI18n();

    if (i18n && typeof i18n.getLocale === "function") {
      return normalizeLocale(i18n.getLocale());
    }

    return normalizeLocale(currentLocale);
  }

  function translateUiText(value, locale) {
    const i18n = getI18n();
    const activeLocale = normalizeLocale(locale || currentLocale);

    if (i18n && typeof i18n.translateText === "function") {
      return i18n.translateText(value, activeLocale);
    }

    return value;
  }

  function localizeContent(content, locale) {
    const i18n = getI18n();
    const activeLocale = normalizeLocale(locale || currentLocale);

    if (i18n && typeof i18n.localizeValue === "function") {
      return i18n.localizeValue(content, activeLocale);
    }

    return content;
  }

  function syncLocaleToggle() {
    const buttons = document.querySelectorAll(".utility-lang");

    if (!buttons.length) {
      return;
    }

    const isKazakh = currentLocale === "kz";

    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", isKazakh ? "true" : "false");
      button.classList.toggle("is-active", isKazakh);
      button.innerHTML =
        '<span class="utility-lang__option' + (isKazakh ? "" : " is-current") + '">RU</span>' +
        '<span class="utility-lang__option' + (isKazakh ? " is-current" : "") + '">KZ</span>';
      button.setAttribute("aria-label", translateUiText("Переключить язык", currentLocale));
    });
  }

  function bindLocaleToggle() {
    if (localeToggleBound) {
      return;
    }

    const buttons = document.querySelectorAll(".utility-lang");

    if (!buttons.length) {
      return;
    }

    localeToggleBound = true;

    buttons.forEach(function (button) {
      if (button.dataset.localeBound === "true") {
        return;
      }

      button.dataset.localeBound = "true";
      button.addEventListener("click", function () {
        const nextLocale = currentLocale === "kz" ? "ru" : "kz";
        const i18n = getI18n();

        currentLocale = i18n && typeof i18n.setLocale === "function"
          ? normalizeLocale(i18n.setLocale(nextLocale))
          : normalizeLocale(nextLocale);
        localeInitialized = true;

        if (i18n && typeof i18n.applyLocale === "function") {
          i18n.applyLocale(currentLocale);
        }

        renderCurrentPage();
      });
    });

    syncLocaleToggle();
  }

  function renderCurrentPage() {
    if (!currentContent) {
      return;
    }

    currentLocale = getCurrentLocale();

    const i18n = getI18n();
    const localizedContent = localizeContent(currentContent, currentLocale);

    if (i18n && typeof i18n.applyLocale === "function") {
      i18n.applyLocale(currentLocale);
    }

    renderPage(localizedContent);

    if (document.body && document.body.dataset.pageKind === "service-detail") {
      renderServiceDetail(localizedContent);
    }

    if (document.body && document.body.dataset.pageKind === "doctor-detail") {
      renderDoctorDetail(localizedContent);
    }

    updateSeoTags(localizedContent);

    if (i18n && typeof i18n.localizeDom === "function") {
      i18n.localizeDom(document.body, currentLocale);
    }

    syncLocaleToggle();
    bindLeadForm();
    initLiveUi();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeHref(value, fallback) {
    const href = String(value || "").trim();

    if (!href) {
      return fallback;
    }

    if (/^(javascript|vbscript|data):/i.test(href)) {
      return fallback;
    }

    return href;
  }

  function routeSectionHref(value) {
    const href = String(value || "").trim();
    return SECTION_ROUTE_MAP[href] || href;
  }

  function resolveSiteHref(value, fallback) {
    return safeHref(routeSectionHref(value), routeSectionHref(fallback));
  }

  function safeImageSrc(value, fallback) {
    const src = String(value || "").trim();

    if (!src) {
      return fallback || "";
    }

    if (/^(javascript|vbscript):/i.test(src)) {
      return fallback || "";
    }

    if (/^data:/i.test(src) && !/^data:image\//i.test(src)) {
      return fallback || "";
    }

    return src;
  }

  function safeFileHref(value, fallback) {
    const href = String(value || "").trim();

    if (!href) {
      return fallback || "";
    }

    if (/^(javascript|vbscript):/i.test(href)) {
      return fallback || "";
    }

    if (/^data:/i.test(href)) {
      if (
        !/^data:(image\/|application\/pdf|application\/msword|application\/vnd\.ms-|application\/vnd\.openxmlformats-officedocument\.|application\/rtf|text\/plain|text\/csv)/i.test(
          href
        )
      ) {
        return fallback || "";
      }
    }

    return href;
  }

  function getAttachmentBadge(value) {
    const src = String(value || "").trim();

    if (!src) {
      return "FILE";
    }

    const dataMatch = /^data:([^;,]+)(?:;[^,]*)?,/i.exec(src);
    const mimeType = String(dataMatch ? dataMatch[1] : "").toLowerCase().trim();
    const clean = src.split("?")[0].split("#")[0];
    const fileName = clean ? clean.split("/").pop() || "" : "";
    const extension = fileName && fileName.includes(".")
      ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase()
      : "";
    const map = {
      jpg: "IMG",
      jpeg: "IMG",
      png: "IMG",
      webp: "IMG",
      gif: "IMG",
      svg: "IMG",
      avif: "IMG",
      pdf: "PDF",
      doc: "DOC",
      docx: "DOCX",
      xls: "XLS",
      xlsx: "XLSX",
      ppt: "PPT",
      pptx: "PPTX",
      txt: "TXT",
      csv: "CSV",
      rtf: "RTF",
    };

    if (mimeType.startsWith("image/")) {
      return "IMG";
    }

    if (mimeType === "application/pdf") {
      return "PDF";
    }

    if (mimeType === "application/msword") {
      return "DOC";
    }

    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return "DOCX";
    }

    if (mimeType === "application/vnd.ms-excel") {
      return "XLS";
    }

    if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      return "XLSX";
    }

    if (mimeType === "application/vnd.ms-powerpoint") {
      return "PPT";
    }

    if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      return "PPTX";
    }

    if (mimeType === "text/plain") {
      return "TXT";
    }

    if (mimeType === "text/csv") {
      return "CSV";
    }

    if (mimeType === "application/rtf") {
      return "RTF";
    }

    return map[extension] || (extension ? extension.toUpperCase() : "FILE");
  }

  function phoneToHref(phone) {
    const digits = String(phone || "").replace(/[^\d+]/g, "");
    return digits ? "tel:" + digits : "/contacts";
  }

  function emailToHref(email) {
    return email ? "mailto:" + String(email).trim() : "/contacts";
  }

  function normalizeHandle(value) {
    return String(value || "").trim().replace(/^@/, "");
  }

  function telegramToHref(value) {
    const raw = String(value || "").trim();

    if (!raw) {
      return "";
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    const handle = normalizeHandle(raw);
    return handle ? "https://t.me/" + handle : "";
  }

  function telegramToLabel(value) {
    const handle = normalizeHandle(value);
    return handle ? "@" + handle : "Telegram";
  }

  function instagramToHref(value) {
    const raw = String(value || "").trim();

    if (!raw) {
      return "";
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    const handle = normalizeHandle(raw);
    return handle ? "https://instagram.com/" + handle : "";
  }

  function instagramToLabel(value) {
    const handle = normalizeHandle(value);
    return handle ? "@" + handle : "Instagram";
  }

  function whatsappToHref(value) {
    const raw = String(value || "").trim();

    if (!raw) {
      return "";
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    const digits = raw.replace(/[^\d]/g, "");
    return digits ? "https://wa.me/" + digits : "";
  }

  function tiktokToHref(value) {
    const raw = String(value || "").trim();

    if (!raw) {
      return "";
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    const handle = normalizeHandle(raw);
    return handle ? "https://www.tiktok.com/@" + handle : "";
  }

  function tiktokToLabel(value) {
    const handle = normalizeHandle(value);
    return handle ? "@" + handle : "TikTok";
  }

  function getInitials(name) {
    return String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("");
  }

  function slugifySegment(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getServiceSlug(item, index) {
    const explicit = slugifySegment(item && item.slug);
    const theme = resolveServiceTheme(item, index);
    const id = slugifySegment(item && item.id);

    if (explicit) {
      return explicit;
    }

    if (theme && id) {
      return theme + "-" + id;
    }

    if (id) {
      return id;
    }

    return slugifySegment(theme + "-service-" + String(index + 1));
  }

  function getServiceDetailHref(item, index) {
    return "/services/" + getServiceSlug(item, index);
  }

  function getServiceSlugFromLocation() {
    const pathname = window.location.pathname.replace(/\/+$/, "");
    const match = pathname.match(/^\/services\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function findServiceBySlug(items, slug) {
    const target = String(slug || "").trim();

    if (!target) {
      return null;
    }

    for (let index = 0; index < items.length; index += 1) {
      if (getServiceSlug(items[index], index) === target) {
        return {
          item: items[index],
          index: index,
        };
      }
    }

    return null;
  }

  function getDoctorSlug(item, index) {
    const explicit = slugifySegment(item && item.slug);
    const id = slugifySegment(item && item.id);

    if (explicit) {
      return explicit;
    }

    if (id) {
      return id;
    }

    return "doctor-" + String(index + 1);
  }

  function getDoctorDetailHref(item, index) {
    return "/doctors/" + getDoctorSlug(item, index);
  }

  function getDoctorSlugFromLocation() {
    const pathname = window.location.pathname.replace(/\/+$/, "");
    const match = pathname.match(/^\/doctors\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function findDoctorBySlug(items, slug) {
    const target = String(slug || "").trim();

    if (!target) {
      return null;
    }

    for (let index = 0; index < items.length; index += 1) {
      if (getDoctorSlug(items[index], index) === target) {
        return {
          item: items[index],
          index: index,
        };
      }
    }

    return null;
  }

  function setText(id, value) {
    const node = document.getElementById(id);

    if (node) {
      node.textContent = translateUiText(value) || "";
    }
  }

  function setLink(id, href, label) {
    const node = document.getElementById(id);

    if (!node) {
      return;
    }

    const rawHref = String(href || "").trim();
    const rawLabel = label == null ? "" : String(label).trim();
    const isVisible = Boolean(rawHref) && (label === undefined || Boolean(rawLabel));

    node.hidden = !isVisible;

    if (!isVisible) {
      node.removeAttribute("href");
      node.textContent = "";
      return;
    }

    node.setAttribute("href", rawHref);

    if (label !== undefined) {
      node.textContent = translateUiText(rawLabel);
    }
  }

  function setOptionalLink(id, href, label) {
    const node = document.getElementById(id);

    if (!node) {
      return;
    }

    const rawHref = String(href || "").trim();
    const isVisible = Boolean(rawHref);
    node.hidden = !isVisible;

    if (!isVisible) {
      return;
    }

    node.setAttribute("href", resolveSiteHref(rawHref, "/contacts"));

    if (label !== undefined) {
      node.textContent = translateUiText(label);
    }
  }

  function setImage(id, src, fallback) {
    const node = document.getElementById(id);

    if (!node) {
      return;
    }

    node.style.display = "";

    if (node.id === "brandLogo") {
      const fallbackNode = node.nextElementSibling;

      if (fallbackNode && fallbackNode.classList.contains("brand__logo-fallback")) {
        fallbackNode.style.display = "none";
      }

      if (node.parentElement) {
        node.parentElement.classList.remove("brand--fallback");
      }
    }

    node.setAttribute("src", safeImageSrc(src, fallback));
  }

  function applyTemplate(template, replacements, fallback) {
    const source = String(template || "").trim();
    const values = replacements || {};

    if (!source) {
      return fallback || "";
    }

    return source.replace(/\{(\w+)\}/g, function (_, key) {
      if (values[key] === undefined || values[key] === null) {
        return "";
      }

      return String(values[key]);
    });
  }

  function getDefaultSeoPage(pageKey) {
    const pages =
      typeof window !== "undefined" &&
      window.DefaultContent &&
      window.DefaultContent.seo &&
      window.DefaultContent.seo.pages;
    const page = pages ? pages[pageKey] : null;

    return page && typeof page === "object" ? page : null;
  }

  function pickSeoValue(value, fallback) {
    const raw = String(value || "").trim();

    if (raw) {
      return raw;
    }

    return String(fallback || "").trim();
  }

  function getSeoPage(content, pageKey) {
    const pages = content && content.seo && content.seo.pages;
    const page = pages ? pages[pageKey] : null;
    const defaults = getDefaultSeoPage(pageKey) || {};
    const source = page && typeof page === "object" ? page : {};
    const result = {};
    const keys = Object.keys(defaults).concat(Object.keys(source));

    keys.forEach(function (key) {
      result[key] = pickSeoValue(source[key], defaults[key]);
    });

    return Object.keys(result).length ? result : null;
  }

  function setMetaTag(selector, attributes, value) {
    const raw = String(value || "").trim();
    const query = document.querySelector(selector);

    if (!raw) {
      return;
    }

    let node = query;

    if (!node) {
      node = document.createElement("meta");

      Object.keys(attributes || {}).forEach(function (key) {
        node.setAttribute(key, attributes[key]);
      });

      document.head.appendChild(node);
    } else {
      Object.keys(attributes || {}).forEach(function (key) {
        node.setAttribute(key, attributes[key]);
      });
    }

    node.setAttribute("content", raw);
  }

  function applySeoMetaTags(seoData) {
    const data = seoData || {};
    const title = String(data.title || "").trim();
    const description = String(data.description || "").trim();
    const keywords = String(data.keywords || "").trim();
    const themeColor = String(data.themeColor || "#d50000").trim();
    const ogTitle = String(data.ogTitle || title).trim();
    const ogDescription = String(data.ogDescription || description).trim();
    const ogType = String(data.ogType || "website").trim() || "website";
    const ogImage = String(data.ogImage || "").trim();
    const twitterTitle = String(data.twitterTitle || ogTitle || title).trim();
    const twitterDescription = String(data.twitterDescription || ogDescription || description).trim();
    const twitterImage = String(data.twitterImage || ogImage).trim();

    if (title) {
      document.title = title;
    }

    setMetaTag('meta[name="description"]', { name: "description" }, description);
    setMetaTag('meta[name="keywords"]', { name: "keywords" }, keywords);
    setMetaTag('meta[name="theme-color"]', { name: "theme-color" }, themeColor);
    setMetaTag('meta[property="og:title"]', { property: "og:title" }, ogTitle);
    setMetaTag(
      'meta[property="og:description"]',
      { property: "og:description" },
      ogDescription
    );
    setMetaTag('meta[property="og:type"]', { property: "og:type" }, ogType);
    setMetaTag('meta[property="og:image"]', { property: "og:image" }, ogImage);
    setMetaTag('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    setMetaTag('meta[name="twitter:title"]', { name: "twitter:title" }, twitterTitle);
    setMetaTag(
      'meta[name="twitter:description"]',
      { name: "twitter:description" },
      twitterDescription
    );
    setMetaTag('meta[name="twitter:image"]', { name: "twitter:image" }, twitterImage);
  }

  function buildDetailSeoData(content, pageKey, item, fallbackTitle, fallbackDescription) {
    const pageSeo = getSeoPage(content, pageKey) || {};
    const brandName = content && content.brand && content.brand.name ? content.brand.name : "PROMEDCENTRE";
    const image = safeImageSrc(item && item.image, "/assets/og-default.svg") || "/assets/og-default.svg";
    const replacements = {
      name: item && item.name ? item.name : "",
      description: item && item.description ? item.description : "",
      details: item && item.details ? item.details : "",
      specialty: item && item.specialty ? item.specialty : "",
      experience: item && item.experience ? item.experience : "",
      about: item && item.about ? item.about : "",
      brandName: brandName,
    };
    const titleSource = pageSeo.titleTemplate || pageSeo.title;
    const descriptionSource = pageSeo.descriptionTemplate || pageSeo.description;
    const title = applyTemplate(titleSource, replacements, fallbackTitle);
    const description = applyTemplate(descriptionSource, replacements, fallbackDescription);

    return {
      title: title,
      description: description,
      ogTitle: title,
      ogDescription: description,
      ogType: "website",
      ogImage: image,
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: image,
    };
  }

  function ensureToastStack() {
    if (toastStack) {
      return toastStack;
    }

    toastStack = document.createElement("div");
    toastStack.className = "toast-stack";
    document.body.appendChild(toastStack);
    return toastStack;
  }

  function notify(text, type) {
    if (!text) {
      return;
    }

    const stack = ensureToastStack();
    const toast = document.createElement("div");

    toast.className = "toast toast--" + (type || "info");
    toast.textContent = translateUiText(text);
    stack.appendChild(toast);

    window.setTimeout(function () {
      toast.remove();
    }, 4200);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function parseMetricDisplay(value) {
    const source = String(value || "").trim();
    const match = source.match(/-?\d+(?:[.,]\d+)?/);

    if (!match) {
      return null;
    }

    const numberText = match[0];
    const decimals = (numberText.split(/[.,]/)[1] || "").length;

    return {
      source: source,
      prefix: source.slice(0, match.index),
      suffix: source.slice(match.index + numberText.length),
      value: Number(numberText.replace(",", ".")),
      decimals: decimals,
      separator: numberText.indexOf(",") !== -1 ? "," : ".",
    };
  }

  function formatMetricDisplay(meta, value) {
    if (!meta) {
      return "";
    }

    const rounded = meta.decimals
      ? Number(value).toFixed(meta.decimals)
      : String(Math.round(Number(value)));
    const normalized =
      meta.decimals && meta.separator === "," ? rounded.replace(".", ",") : rounded;

    return meta.prefix + normalized + meta.suffix;
  }

  function animateMetric(node) {
    const meta = parseMetricDisplay(node && node.getAttribute("data-metric-value"));

    if (!node || !meta || !Number.isFinite(meta.value)) {
      return;
    }

    const duration = Math.min(1500, Math.max(850, meta.value * 55));
    const startedAt = performance.now();

    node.dataset.metricAnimated = "true";

    function step(timestamp) {
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = formatMetricDisplay(meta, meta.value * eased);

      if (progress < 1) {
        window.requestAnimationFrame(step);
        return;
      }

      node.textContent = meta.source;
    }

    window.requestAnimationFrame(step);
  }

  function updateHeaderState() {
    const header = document.querySelector(".site-header");

    if (!header) {
      return;
    }

    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  function bindMobileMenu() {
    const header = document.querySelector(".site-header");
    const toggle = document.querySelector(".utility-menu-toggle");
    const nav = document.querySelector(".utility-nav");

    if (!header || !toggle || !nav) {
      return;
    }

    let overlay = document.querySelector(".site-menu-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "site-menu-overlay";
      overlay.setAttribute("aria-hidden", "true");
      header.insertAdjacentElement("afterend", overlay);
    }

    if (!nav.id) {
      nav.id = "utilityNav";
    }

    toggle.setAttribute("aria-controls", nav.id);

    function setMenuState(isOpen) {
      header.classList.toggle("is-nav-open", isOpen);
      document.body.classList.toggle("is-mobile-menu-open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    }

    if (mobileMenuBound) {
      setMenuState(false);
      return;
    }

    mobileMenuBound = true;

    toggle.addEventListener("click", function () {
      setMenuState(!header.classList.contains("is-nav-open"));
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setMenuState(false);
      }
    });

    document.addEventListener("click", function (event) {
      if (!header.classList.contains("is-nav-open")) {
        return;
      }

      if (!header.contains(event.target)) {
        setMenuState(false);
      }
    });

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setMenuState(false);
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 760) {
        setMenuState(false);
      }
    });

    setMenuState(false);
  }

  function updateActiveNav() {
    const routeLinks = Array.from(document.querySelectorAll(".utility-nav a[data-nav]"));
    const pageKey = document.body ? String(document.body.dataset.nav || "").trim() : "";

    if (routeLinks.length && pageKey) {
      routeLinks.forEach(function (link) {
        link.classList.toggle("is-active", link.dataset.nav === pageKey);
      });
      return;
    }

    const links = Array.from(document.querySelectorAll(".utility-nav a[href^='#']"));
    const header = document.querySelector(".site-header");
    const offset = (header ? header.offsetHeight : 0) + 18;

    if (!links.length) {
      return;
    }

    let currentId = links[0].getAttribute("href");

    links.forEach(function (link) {
      const href = link.getAttribute("href");
      const section = document.querySelector(href);

      if (section && section.getBoundingClientRect().top <= offset) {
        currentId = href;
      }
    });

    links.forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("href") === currentId);
    });
  }

  function syncHeroScrollOffset() {
    const heroBanner = document.querySelector(".hero-banner");

    if (!heroBanner) {
      return;
    }

    heroBanner.style.setProperty(
      "--hero-scroll-offset",
      Math.max(-24, window.scrollY * -0.06).toFixed(1) + "px"
    );
  }

  function bindGlobalMotion() {
    const heroBanner = document.querySelector(".hero-banner");

    if (globalMotionBound) {
      updateHeaderState();
      updateActiveNav();
      syncHeroScrollOffset();
      return;
    }

    globalMotionBound = true;

    if (heroBanner && !prefersReducedMotion()) {
      heroBanner.addEventListener("pointermove", function (event) {
        if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") {
          return;
        }

        const rect = heroBanner.getBoundingClientRect();

        if (!rect.width || !rect.height) {
          return;
        }

        const ratioX = (event.clientX - rect.left) / rect.width - 0.5;
        const ratioY = (event.clientY - rect.top) / rect.height - 0.5;

        heroBanner.style.setProperty("--hero-shift-x", (ratioX * 18).toFixed(1) + "px");
        heroBanner.style.setProperty("--hero-shift-y", (ratioY * 14).toFixed(1) + "px");
      });

      heroBanner.addEventListener("pointerleave", function () {
        heroBanner.style.setProperty("--hero-shift-x", "0px");
        heroBanner.style.setProperty("--hero-shift-y", "0px");
      });
    }

    let scheduled = false;

    function syncWindowState() {
      scheduled = false;
      updateHeaderState();
      updateActiveNav();
      syncHeroScrollOffset();
    }

    function requestSync() {
      if (scheduled) {
        return;
      }

      scheduled = true;
      window.requestAnimationFrame(syncWindowState);
    }

    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    requestSync();
  }

  function initRevealAnimations() {
    const targets = Array.from(
      document.querySelectorAll(
        ".section-heading, .metric-card, .service-card, .benefit-card, .story-layout, .doctor-card, .reviews-slider, .cta-card"
      )
    );

    if (revealObserver) {
      revealObserver.disconnect();
    }

    targets.forEach(function (node) {
      const siblingIndex = node.parentElement
        ? Array.prototype.indexOf.call(node.parentElement.children, node)
        : 0;

      node.setAttribute("data-reveal", "");
      node.style.setProperty(
        "--reveal-delay",
        Math.min(Math.max(siblingIndex, 0) * 70, 280) + "ms"
      );
      node.classList.remove("is-visible");
    });

    if (prefersReducedMotion()) {
      targets.forEach(function (node) {
        node.classList.add("is-visible");
      });
      return;
    }

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    targets.forEach(function (node) {
      revealObserver.observe(node);
    });
  }

  function initMetricAnimations() {
    const nodes = Array.from(
      document.querySelectorAll(".metric-card strong[data-metric-value]")
    );

    if (metricObserver) {
      metricObserver.disconnect();
    }

    nodes.forEach(function (node) {
      const meta = parseMetricDisplay(node.getAttribute("data-metric-value"));

      node.dataset.metricAnimated = "false";

      if (meta) {
        node.textContent = formatMetricDisplay(meta, 0);
      }
    });

    if (prefersReducedMotion()) {
      nodes.forEach(function (node) {
        node.textContent = node.getAttribute("data-metric-value") || node.textContent;
      });
      return;
    }

    metricObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || entry.target.dataset.metricAnimated === "true") {
            return;
          }

          animateMetric(entry.target);
          metricObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.45,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    nodes.forEach(function (node) {
      metricObserver.observe(node);
    });
  }

  function initReviewSlider() {
    if (typeof reviewSliderCleanup === "function") {
      reviewSliderCleanup();
      reviewSliderCleanup = null;
    }

    const slider = document.querySelector("[data-review-slider]");

    if (!slider) {
      return;
    }

    const track = slider.querySelector(".reviews-slider__track");
    const slides = Array.from(slider.querySelectorAll(".reviews-slider__slide"));
    const prevButton = slider.querySelector("[data-review-prev]");
    const nextButton = slider.querySelector("[data-review-next]");
    const dots = Array.from(slider.querySelectorAll("[data-review-dot]"));

    if (!track || !slides.length) {
      return;
    }

    let activeIndex = 0;
    let intervalId = 0;

    function render() {
      track.style.transform = "translate3d(-" + activeIndex * 100 + "%, 0, 0)";

      slides.forEach(function (slide, index) {
        slide.setAttribute("aria-hidden", index === activeIndex ? "false" : "true");
      });

      dots.forEach(function (dot, index) {
        const isActive = index === activeIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });

      if (prevButton) {
        prevButton.setAttribute(
          "aria-label",
          "Предыдущий отзыв " + (activeIndex + 1) + " из " + slides.length
        );
      }

      if (nextButton) {
        nextButton.setAttribute(
          "aria-label",
          "Следующий отзыв " + (activeIndex + 1) + " из " + slides.length
        );
      }
    }

    function goTo(nextIndex) {
      activeIndex = (nextIndex + slides.length) % slides.length;
      render();
    }

    function stopAutoplay() {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
    }

    function startAutoplay() {
      if (prefersReducedMotion() || slides.length < 2) {
        return;
      }

      stopAutoplay();
      intervalId = window.setInterval(function () {
        goTo(activeIndex + 1);
      }, 5200);
    }

    function handlePrevClick() {
      goTo(activeIndex - 1);
      startAutoplay();
    }

    function handleNextClick() {
      goTo(activeIndex + 1);
      startAutoplay();
    }

    function handleKeydown(event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevClick();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNextClick();
      }
    }

    function handleFocusOut(event) {
      if (event.relatedTarget && slider.contains(event.relatedTarget)) {
        return;
      }

      startAutoplay();
    }

    if (prevButton) {
      prevButton.addEventListener("click", handlePrevClick);
    }

    if (nextButton) {
      nextButton.addEventListener("click", handleNextClick);
    }

    dots.forEach(function (dot, index) {
      dot.addEventListener("click", function () {
        goTo(index);
        startAutoplay();
      });
    });

    slider.addEventListener("mouseenter", stopAutoplay);
    slider.addEventListener("mouseleave", startAutoplay);
    slider.addEventListener("focusin", stopAutoplay);
    slider.addEventListener("focusout", handleFocusOut);
    slider.addEventListener("keydown", handleKeydown);

    render();
    startAutoplay();

    reviewSliderCleanup = function () {
      stopAutoplay();

      if (prevButton) {
        prevButton.removeEventListener("click", handlePrevClick);
      }

      if (nextButton) {
        nextButton.removeEventListener("click", handleNextClick);
      }

      slider.removeEventListener("mouseenter", stopAutoplay);
      slider.removeEventListener("mouseleave", startAutoplay);
      slider.removeEventListener("focusin", stopAutoplay);
      slider.removeEventListener("focusout", handleFocusOut);
      slider.removeEventListener("keydown", handleKeydown);
    };
  }

  function initLiveUi() {
    bindGlobalMotion();
    bindMobileMenu();
    initRevealAnimations();
    initMetricAnimations();
    initReviewSlider();
    updateActiveNav();
  }

  function resolveServiceTheme(item, index) {
    const explicit = String((item && item.theme) || "").trim();
    const source = String(
      (item && (item.name || item.description || item.details)) || ""
    ).toLowerCase();

    if (explicit) {
      return explicit;
    }

    if (source.indexOf("узи") !== -1 || source.indexOf("ultra") !== -1) {
      return "ultrasound";
    }

    if (source.indexOf("анализ") !== -1 || source.indexOf("лаборатор") !== -1) {
      return "analyses";
    }

    if (source.indexOf("чек") !== -1 || source.indexOf("check") !== -1) {
      return "checkup";
    }

    if (source.indexOf("рентген") !== -1 || source.indexOf("xray") !== -1) {
      return "xray";
    }

    if (
      source.indexOf("врач") !== -1 ||
      source.indexOf("прием") !== -1 ||
      source.indexOf("консульта") !== -1
    ) {
      return "doctor";
    }

    return SERVICE_THEME_FALLBACKS[index % SERVICE_THEME_FALLBACKS.length];
  }

  function getServiceThemeOption(value) {
    const target = String(value || "").trim();
    const options =
      currentContent &&
      currentContent.themeOptions &&
      Array.isArray(currentContent.themeOptions.service)
        ? currentContent.themeOptions.service
        : [];

    if (!target || !options.length) {
      return null;
    }

    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];

      if (String(option && option.value ? option.value : "").trim() === target) {
        return option;
      }
    }

    return null;
  }

  function getServiceVisualTheme(item, index) {
    const theme = resolveServiceTheme(item, index);
    const option = getServiceThemeOption(theme);
    const visual = String(option && option.visual ? option.visual : "").trim();

    return visual || theme;
  }

  function resolveBenefitTheme(item, index) {
    const explicit = String((item && item.theme) || "").trim();
    const source = String((item && (item.title || item.description)) || "").toLowerCase();

    if (explicit) {
      return explicit;
    }

    if (
      source.indexOf("сервис") !== -1 ||
      source.indexOf("запис") !== -1 ||
      source.indexOf("коммуника") !== -1
    ) {
      return "care";
    }

    if (
      source.indexOf("маршрут") !== -1 ||
      source.indexOf("лаборатор") !== -1 ||
      source.indexOf("одном месте") !== -1
    ) {
      return "route";
    }

    if (
      source.indexOf("кач") !== -1 ||
      source.indexOf("контроль") !== -1 ||
      source.indexOf("оборуд") !== -1
    ) {
      return "quality";
    }

    return BENEFIT_THEME_FALLBACKS[index % BENEFIT_THEME_FALLBACKS.length];
  }

  function getServiceIllustration(theme, className) {
    const svgClass = className || "service-card__svg";

    switch (theme) {
      case "doctor":
        return `
          <svg viewBox="0 0 320 320" class="${svgClass}" aria-hidden="true">
            <rect x="0" y="0" width="320" height="320" rx="36" fill="#49cdb4"></rect>
            <path d="M56 238c26-58 89-95 161-74 34 10 58 33 80 64v92H0v-46c12-14 33-27 56-36z" fill="#b9ede2"></path>
            <rect x="100" y="112" width="54" height="94" rx="10" fill="#ffffff" transform="rotate(-12 100 112)"></rect>
            <rect x="118" y="96" width="28" height="18" rx="6" fill="#6a4637" transform="rotate(-12 118 96)"></rect>
            <circle cx="205" cy="108" r="28" fill="#ffb180"></circle>
            <path d="M178 109c0-20 13-37 35-37 17 0 30 10 34 28-14-7-33-7-53 9l-16 12v-12z" fill="#37434d"></path>
            <path d="M179 138h56l14 97h-88z" fill="#ffffff"></path>
            <path d="M192 138h30v103h-30z" fill="#d6f0ea"></path>
            <path d="M169 146c-14 10-19 27-16 48l12 73h28l-4-70 10-24z" fill="#ffffff"></path>
            <path d="M239 150c12 11 17 28 16 44l-8 68h-29l2-61-10-28z" fill="#ffffff"></path>
            <rect x="112" y="127" width="28" height="4" rx="2" fill="#ef6b5c" transform="rotate(-12 112 127)"></rect>
            <rect x="110" y="141" width="22" height="4" rx="2" fill="#55757b" transform="rotate(-12 110 141)"></rect>
            <rect x="107" y="154" width="24" height="4" rx="2" fill="#55757b" transform="rotate(-12 107 154)"></rect>
          </svg>`;
      case "ultrasound":
        return `
          <svg viewBox="0 0 320 320" class="${svgClass}" aria-hidden="true">
            <rect x="0" y="0" width="320" height="320" rx="36" fill="#49cdb4"></rect>
            <path d="M18 226c58-66 110-63 167-86 48-20 81-43 135-24v113H0v-3c4 0 10 0 18 0z" fill="#3eb39e"></path>
            <path d="M18 248c50-40 89-47 128-39 41 9 73 31 126 54v57H0v-32c6-14 12-27 18-40z" fill="#2e8f82"></path>
            <rect x="176" y="116" width="82" height="72" rx="6" fill="#ffffff" transform="rotate(24 176 116)"></rect>
            <rect x="189" y="129" width="56" height="46" rx="2" fill="#3b4a54" transform="rotate(24 189 129)"></rect>
            <path d="M215 144c10-8 22-7 28 2 6 10 2 22-8 28-10 8-22 7-28-2-7-9-3-21 8-28z" fill="#ff7a42" transform="rotate(24 215 144)"></path>
            <path d="M89 160c-17 8-30 30-29 47 14 8 29 4 43-10l30-30-21-28-23 21z" fill="#ffffff"></path>
            <path d="M56 189c26 5 46 0 60-16" stroke="#d6ddd7" stroke-width="9" fill="none" stroke-linecap="round"></path>
            <path d="M246 145c23-34 44-50 64-50" stroke="#dfece8" stroke-width="4" fill="none" stroke-linecap="round"></path>
          </svg>`;
      case "analyses":
        return `
          <svg viewBox="0 0 320 320" class="${svgClass}" aria-hidden="true">
            <rect x="0" y="0" width="320" height="320" rx="36" fill="#49cdb4"></rect>
            <path d="M0 254c38-8 74-10 107-5 29 5 54 15 90 26 34 10 67 11 123 5v40H0z" fill="#0e6b64"></path>
            <circle cx="104" cy="126" r="24" fill="#ffb180"></circle>
            <path d="M82 122c10-20 28-30 43-23 11 6 14 17 13 31-11-3-24 2-40 15l-18 16-1-39z" fill="#56423e"></path>
            <path d="M79 150h52l12 70h-77z" fill="#eff3f2"></path>
            <path d="M100 150h19v69h-19z" fill="#d2eadf"></path>
            <path d="M152 180c-3 12-3 22-1 30" stroke="#ffb180" stroke-width="10" stroke-linecap="round"></path>
            <g transform="translate(170 144)">
              <rect x="0" y="18" width="24" height="104" rx="12" fill="#d7eef1"></rect>
              <rect x="34" y="8" width="24" height="114" rx="12" fill="#d7eef1"></rect>
              <rect x="68" y="16" width="24" height="106" rx="12" fill="#d7eef1"></rect>
              <rect x="4" y="18" width="16" height="34" rx="8" fill="#2eaad8"></rect>
              <rect x="38" y="8" width="16" height="34" rx="8" fill="#ef6dc0"></rect>
              <rect x="72" y="16" width="16" height="34" rx="8" fill="#559842"></rect>
            </g>
          </svg>`;
      case "checkup":
        return `
          <svg viewBox="0 0 320 320" class="${svgClass}" aria-hidden="true">
            <rect x="0" y="0" width="320" height="320" rx="36" fill="#49cdb4"></rect>
            <path d="M0 286c32-31 60-56 104-61 52-7 103 9 164 59v36H0z" fill="#b9ede2"></path>
            <rect x="74" y="86" width="110" height="164" rx="10" fill="#ffffff"></rect>
            <rect x="101" y="64" width="56" height="24" rx="8" fill="#5f4034"></rect>
            <rect x="89" y="76" width="80" height="18" rx="8" fill="#6f4d3e"></rect>
            <g fill="#6a7b82">
              <rect x="108" y="116" width="42" height="5" rx="2.5"></rect>
              <rect x="108" y="141" width="44" height="5" rx="2.5"></rect>
              <rect x="108" y="166" width="50" height="5" rx="2.5"></rect>
              <rect x="108" y="191" width="46" height="5" rx="2.5"></rect>
            </g>
            <g stroke="#ef6b5c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <path d="M92 115l5 5 8-10"></path>
              <path d="M92 140l5 5 8-10"></path>
              <path d="M92 165l5 5 8-10"></path>
              <path d="M92 190l5 5 8-10"></path>
            </g>
            <circle cx="224" cy="170" r="18" fill="#ffb180"></circle>
            <path d="M204 191h42l10 56h-59z" fill="#ffffff"></path>
            <path d="M236 190l22 20" stroke="#ffd07f" stroke-width="10" stroke-linecap="round"></path>
          </svg>`;
      case "xray":
        return `
          <svg viewBox="0 0 320 320" class="${svgClass}" aria-hidden="true">
            <rect x="0" y="0" width="320" height="320" rx="36" fill="#49cdb4"></rect>
            <path d="M0 236c58-28 93-53 136-71 62-27 112-18 184 15v140H0z" fill="#bdece0"></path>
            <path d="M50 278h222" stroke="#8cb8b0" stroke-width="10" stroke-linecap="round"></path>
            <rect x="106" y="124" width="110" height="138" rx="10" fill="#264c90"></rect>
            <rect x="115" y="134" width="92" height="118" rx="7" fill="#1a3671"></rect>
            <path d="M161 140v96" stroke="#dfe6ff" stroke-width="6" stroke-linecap="round"></path>
            <path d="M136 160c8-8 16-12 25-12 8 0 17 4 25 12" stroke="#dfe6ff" stroke-width="5" fill="none" stroke-linecap="round"></path>
            <path d="M134 186c9 7 18 11 27 11s18-4 27-11" stroke="#dfe6ff" stroke-width="5" fill="none" stroke-linecap="round"></path>
            <path d="M136 212c8-8 16-12 25-12 8 0 17 4 25 12" stroke="#dfe6ff" stroke-width="5" fill="none" stroke-linecap="round"></path>
            <rect x="225" y="108" width="8" height="160" rx="4" fill="#a5b7ba"></rect>
            <circle cx="86" cy="105" r="21" fill="#ffb180"></circle>
            <path d="M69 132h35l5 34H64z" fill="#ffffff"></path>
          </svg>`;
      case "home":
      default:
        return `
          <svg viewBox="0 0 320 320" class="${svgClass}" aria-hidden="true">
            <rect x="0" y="0" width="320" height="320" rx="36" fill="#49cdb4"></rect>
            <path d="M0 264c48-6 97-3 150 11 48 12 100 16 170 9v36H0z" fill="#1f8e81"></path>
            <circle cx="136" cy="118" r="26" fill="#ffb180"></circle>
            <path d="M115 114c9-19 26-28 42-21 12 5 17 17 16 33-11-6-26-5-42 9l-17 14 1-35z" fill="#91543f"></path>
            <path d="M113 144h52l18 76h-88z" fill="#ffffff"></path>
            <path d="M135 144h24v76h-24z" fill="#def3e9"></path>
            <path d="M91 152c-12 12-15 25-13 43l12 61h27l-2-55 11-25z" fill="#ffffff"></path>
            <rect x="60" y="154" width="70" height="56" rx="18" fill="#d4f0c0" stroke="#9fd79a" stroke-width="6"></rect>
            <rect x="80" y="142" width="24" height="14" rx="6" fill="#9fd79a"></rect>
            <rect x="76" y="171" width="8" height="24" rx="4" fill="#7cc8d5"></rect>
            <rect x="90" y="171" width="8" height="24" rx="4" fill="#e2b774"></rect>
            <rect x="104" y="171" width="8" height="24" rx="4" fill="#63a38a"></rect>
            <g transform="translate(196 160)">
              <rect x="0" y="20" width="94" height="46" rx="20" fill="#f5f7f8"></rect>
              <path d="M18 20c13-20 33-30 59-29h28v25H0v-4c4-4 9-8 18-12z" fill="#d2d8dd"></path>
              <rect x="39" y="-1" width="52" height="18" rx="9" fill="#242424"></rect>
              <circle cx="20" cy="68" r="12" fill="#4a4a4a"></circle>
              <circle cx="77" cy="68" r="12" fill="#4a4a4a"></circle>
            </g>
          </svg>`;
    }
  }

  function getBenefitIllustration(theme) {
    switch (theme) {
      case "care":
        return `
          <svg viewBox="0 0 480 240" class="benefit-card__svg" aria-hidden="true">
            <rect x="0" y="0" width="480" height="240" rx="28" fill="#dbeff2"></rect>
            <rect x="28" y="44" width="220" height="146" rx="18" fill="#f4fafb"></rect>
            <rect x="58" y="76" width="130" height="12" rx="6" fill="#0e6b64"></rect>
            <rect x="58" y="104" width="110" height="10" rx="5" fill="#7b9297"></rect>
            <rect x="58" y="126" width="142" height="10" rx="5" fill="#7b9297"></rect>
            <circle cx="340" cy="98" r="42" fill="#ffb180"></circle>
            <path d="M300 145h86l24 66H274z" fill="#ffffff"></path>
            <path d="M334 145h34v72h-34z" fill="#d6eee8"></path>
            <path d="M274 180c12-16 27-26 47-31" stroke="#d16b57" stroke-width="10" stroke-linecap="round"></path>
          </svg>`;
      case "route":
        return `
          <svg viewBox="0 0 480 240" class="benefit-card__svg" aria-hidden="true">
            <rect x="0" y="0" width="480" height="240" rx="28" fill="#d8f2ec"></rect>
            <rect x="46" y="38" width="114" height="168" rx="18" fill="#ffffff"></rect>
            <rect x="182" y="38" width="114" height="168" rx="18" fill="#ffffff"></rect>
            <rect x="318" y="38" width="114" height="168" rx="18" fill="#ffffff"></rect>
            <circle cx="103" cy="84" r="22" fill="#49cdb4"></circle>
            <circle cx="239" cy="84" r="22" fill="#0e6b64"></circle>
            <circle cx="375" cy="84" r="22" fill="#bc6f48"></circle>
            <path d="M124 84h92" stroke="#8abdb4" stroke-width="8" stroke-linecap="round"></path>
            <path d="M260 84h92" stroke="#8abdb4" stroke-width="8" stroke-linecap="round"></path>
            <path d="M96 144h28l12 18 20-32 18 28" stroke="#5c6c71" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M232 144h28l12 18 20-32 18 28" stroke="#5c6c71" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M368 144h28l12 18 20-32 18 28" stroke="#5c6c71" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>`;
      case "quality":
      default:
        return `
          <svg viewBox="0 0 480 240" class="benefit-card__svg" aria-hidden="true">
            <rect x="0" y="0" width="480" height="240" rx="28" fill="#edf3f4"></rect>
            <rect x="40" y="46" width="400" height="148" rx="24" fill="#ffffff"></rect>
            <rect x="84" y="78" width="110" height="76" rx="14" fill="#d6ebe5"></rect>
            <rect x="206" y="78" width="70" height="76" rx="14" fill="#dce8f0"></rect>
            <rect x="288" y="78" width="110" height="76" rx="14" fill="#efe2d7"></rect>
            <circle cx="139" cy="117" r="18" fill="#0e6b64"></circle>
            <path d="M129 117l8 8 14-18" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="241" cy="117" r="18" fill="#49cdb4"></circle>
            <rect x="314" y="98" width="58" height="38" rx="10" fill="#bc6f48"></rect>
            <path d="M88 170h306" stroke="#cad6d8" stroke-width="8" stroke-linecap="round"></path>
          </svg>`;
    }
  }

  function renderMetrics(items) {
    const container = document.getElementById("metricsGrid");

    if (!container) {
      return;
    }

    container.innerHTML = items
      .map(function (item) {
        return (
          '<article class="metric-card">' +
          '<strong data-metric-value="' +
          escapeHtml(item.value) +
          '">' +
          escapeHtml(item.value) +
          "</strong>" +
          "<span>" +
          escapeHtml(item.label) +
          "</span>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderServices(items, containerId, excludedSlug) {
    const container = document.getElementById(containerId || "servicesGrid");

    if (!container) {
      return;
    }

    container.innerHTML = items
      .map(function (item, index) {
        const slug = getServiceSlug(item, index);

        if (excludedSlug && slug === excludedSlug) {
          return "";
        }

        const theme = getServiceVisualTheme(item, index);
        const detailHref = getServiceDetailHref(item, index);
        const imageSrc = safeImageSrc(item.image, "");
        const mediaClass = imageSrc
          ? "service-card__visual service-card__visual--image"
          : "service-card__visual";
        const mediaHtml = imageSrc
          ? '<img class="service-card__image" src="' +
            escapeHtml(imageSrc) +
            '" alt="' +
            escapeHtml(item.name || "Услуга") +
            '" loading="lazy" />'
          : getServiceIllustration(theme);

        return (
          '<article class="service-card service-card--' +
          theme +
          (imageSrc ? ' service-card--image' : '') +
          '">' +
          '<div class="service-card__title">' +
          "<h3>" +
          escapeHtml(item.name) +
          "</h3>" +
          "</div>" +
          '<div class="' +
          mediaClass +
          '">' +
          mediaHtml +
          "</div>" +
          '<div class="service-card__body">' +
          "<p>" +
          escapeHtml(item.description) +
          "</p>" +
          '<span class="service-card__details">' +
          escapeHtml(item.details) +
          "</span>" +
          '<a class="service-card__link" href="' +
          escapeHtml(detailHref) +
          '">Подробнее</a>' +
          "</div>" +
          "</article>"
        );
      })
      .join("");

  }

  function renderBenefits(items) {
    const container = document.getElementById("benefitsGrid");

    if (!container) {
      return;
    }

    container.innerHTML = items
      .map(function (item, index) {
        const theme = resolveBenefitTheme(item, index);
        const imageSrc = safeImageSrc(item.image, "");
        const mediaClass = imageSrc
          ? "benefit-card__media benefit-card__media--image"
          : "benefit-card__media";
        const mediaHtml = imageSrc
          ? '<img class="benefit-card__image" src="' +
            escapeHtml(imageSrc) +
            '" alt="' +
            escapeHtml(item.title || "Преимущество") +
            '" loading="lazy" />'
          : getBenefitIllustration(theme);

        return (
          '<article class="benefit-card benefit-card--' +
          theme +
          '">' +
          '<div class="' +
          mediaClass +
          '">' +
          mediaHtml +
          "</div>" +
          '<div class="benefit-card__body">' +
          "<h3>" +
          escapeHtml(item.title) +
          "</h3>" +
          "<p>" +
          escapeHtml(item.description) +
          "</p>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderTrust(trust, brand, socials) {
    const section = document.getElementById("trust");
    const cardsContainer = document.getElementById("trustCardsGrid");
    const listContainer = document.getElementById("trustNoteList");

    if (!section || !cardsContainer || !listContainer) {
      return;
    }

    const data = trust || {};
    const cards = Array.isArray(data.cards) ? data.cards : [];
    const note = data.note || {};
    const items = Array.isArray(note.items) ? note.items : [];

    if (!cards.length && !items.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    setText("trustEyebrow", data.eyebrow);
    setText("trustTitle", data.title);
    setText("trustDescription", data.description);
    setText("trustNoteEyebrow", note.eyebrow);
    setText("trustNoteTitle", note.title);
    setText("trustNoteDescription", note.description);
    setText("trustContactLabel", note.contactLabel);
    setText("trustContactHint", note.contactHint);

    cardsContainer.innerHTML = cards
      .map(function (item, index) {
        const order = String(index + 1).padStart(2, "0");
        const detail = String(item.detail || "").trim();
        const title = String(item.title || "").trim();
        const description = String(item.description || "").trim();

        return (
          '<article class="trust-card">' +
          '<span class="trust-card__index">' +
          escapeHtml(order) +
          "</span>" +
          '<h3 class="trust-card__title">' +
          escapeHtml(title) +
          "</h3>" +
          '<p class="trust-card__text">' +
          escapeHtml(description) +
          "</p>" +
          (detail
            ? '<span class="trust-card__detail">' + escapeHtml(detail) + "</span>"
            : "") +
          "</article>"
        );
      })
      .join("");

    listContainer.innerHTML = items
      .map(function (item) {
        const text =
          typeof item === "string"
            ? item
            : item && (item.text || item.label || item.title || item.description || "");

        return String(text || "").trim();
      })
      .filter(Boolean)
      .map(function (text) {
        return "<li>" + escapeHtml(text) + "</li>";
      })
      .join("");

    const phoneHref = phoneToHref(brand && brand.phone);
    const telegramHref = telegramToHref(socials && socials.telegram);

    setLink("trustContactPhone", phoneHref, brand && brand.phone);
    setOptionalLink(
      "trustContactTelegram",
      telegramHref,
      telegramToLabel(socials && socials.telegram)
    );
  }

  function renderFaq(faq) {
    const section = document.getElementById("faq");
    const list = document.getElementById("faqList");

    if (!section || !list) {
      return;
    }

    const data = faq || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const visibleItems = items
      .map(function (item, index) {
        const question = String(
          item && (item.question || item.title || item.label || item.text || "")
        ).trim();
        const answer = String(
          item && (item.answer || item.description || item.details || "")
        ).trim();

        if (!question && !answer) {
          return null;
        }

        return {
          question: question || "Вопрос " + String(index + 1),
          answer: answer || "Информация уточняется.",
        };
      })
      .filter(Boolean);

    if (!visibleItems.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    setText("faqEyebrow", data.eyebrow);
    setText("faqTitle", data.title);
    setText("faqDescription", data.description);

    list.innerHTML = visibleItems
      .map(function (item) {
        const answerHtml = escapeHtml(item.answer).replace(/\n/g, "<br>");

        return (
          '<details class="faq-item">' +
          '<summary class="faq-item__summary">' +
          '<span class="faq-item__question">' +
          escapeHtml(item.question) +
          "</span>" +
          '<span class="faq-item__icon" aria-hidden="true">+</span>' +
          "</summary>" +
          '<div class="faq-item__answer"><p>' +
          answerHtml +
          "</p></div>" +
          "</details>"
        );
      })
      .join("");
  }

  function renderMaterials(materials) {
    const section = document.getElementById("materials");
    const grid = document.getElementById("aboutMaterialsGrid");

    if (!section || !grid) {
      return;
    }

    const data = materials || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const visibleItems = items
      .map(function (item, index) {
        const title = String(item && (item.title || item.label || item.name || "")).trim();
        const description = String(item && (item.description || item.details || "")).trim();
        const fileHref = safeFileHref(item && item.fileUrl, "");
        const imageSrc = safeImageSrc(fileHref || (item && item.fileUrl), "");
        const buttonLabel = String(item && (item.buttonLabel || "")).trim() || "Открыть файл";
        const tag = String(item && (item.tag || "")).trim() || getAttachmentBadge(fileHref || (item && item.fileUrl));

        if (!title && !description && !fileHref && !imageSrc) {
          return null;
        }

        return {
          title: title || "Материал " + String(index + 1),
          description: description,
          fileHref: fileHref,
          imageSrc: imageSrc,
          buttonLabel: buttonLabel,
          tag: tag,
        };
      })
      .filter(Boolean);

    if (!visibleItems.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    setText("aboutPageMaterialsEyebrow", data.eyebrow);
    setText("aboutPageMaterialsTitle", data.title);
    setText("aboutPageMaterialsDescription", data.description);

    grid.innerHTML = visibleItems
      .map(function (item) {
        const descriptionHtml = String(item.description || "").trim()
          ? "<p>" + escapeHtml(item.description).replace(/\n/g, "<br>") + "</p>"
          : "";
        const mediaClass = item.imageSrc
          ? "material-card__media material-card__media--image"
          : "material-card__media";
        const mediaHtml = item.imageSrc
          ? '<img class="material-card__image" src="' +
            escapeHtml(item.imageSrc) +
            '" alt="' +
            escapeHtml(item.title) +
            '" loading="lazy" />'
          : '<div class="material-card__file"><span class="material-card__file-badge">' +
            escapeHtml(item.tag) +
            '</span><span>Файл готов к открытию</span></div>';
        const buttonHtml = item.fileHref
          ? '<a class="btn btn--outline material-card__link" href="' +
            escapeHtml(item.fileHref) +
            '" target="_blank" rel="noreferrer">' +
            escapeHtml(item.buttonLabel) +
            "</a>"
          : "";

        return (
          '<article class="material-card">' +
          '<div class="' +
          mediaClass +
          '">' +
          mediaHtml +
          "</div>" +
          '<div class="material-card__body">' +
          '<span class="material-card__tag">' +
          escapeHtml(item.tag) +
          "</span>" +
          "<h3>" +
          escapeHtml(item.title) +
          "</h3>" +
          descriptionHtml +
          buttonHtml +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderGallery(gallery) {
    const section = document.getElementById("gallery");
    const grid = document.getElementById("aboutGalleryGrid");

    if (!section || !grid) {
      return;
    }

    const data = gallery || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const visibleItems = items
      .map(function (item, index) {
        const title = String(item && (item.title || item.label || item.name || "")).trim();
        const description = String(item && (item.description || item.details || "")).trim();
        const imageSrc = safeImageSrc(item && item.image, "");
        const tag = String(item && (item.tag || "")).trim() || "Фото";

        if (!imageSrc) {
          return null;
        }

        return {
          title: title || "Фото " + String(index + 1),
          description: description,
          imageSrc: imageSrc,
          tag: tag,
        };
      })
      .filter(Boolean);

    if (!visibleItems.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    setText("aboutPageGalleryEyebrow", data.eyebrow);
    setText("aboutPageGalleryTitle", data.title);
    setText("aboutPageGalleryDescription", data.description);

    grid.innerHTML = visibleItems
      .map(function (item) {
        const descriptionHtml = String(item.description || "").trim()
          ? "<p>" + escapeHtml(item.description).replace(/\n/g, "<br>") + "</p>"
          : "";
        const mediaClass = "material-card__media material-card__media--image gallery-card__media gallery-card__media--image";

        return (
          '<article class="material-card gallery-card">' +
          '<div class="' +
          mediaClass +
          '">' +
          '<img class="material-card__image" src="' +
          escapeHtml(item.imageSrc) +
          '" alt="' +
          escapeHtml(item.title) +
          '" loading="lazy" />' +
          "</div>" +
          '<div class="material-card__body">' +
          '<span class="material-card__tag">' +
          escapeHtml(item.tag) +
          "</span>" +
          "<h3>" +
          escapeHtml(item.title) +
          "</h3>" +
          descriptionHtml +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderDocuments(documents) {
    const section = document.getElementById("documents");
    const grid = document.getElementById("aboutDocumentsGrid");

    if (!section || !grid) {
      return;
    }

    const data = documents || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const visibleItems = items
      .map(function (item, index) {
        const title = String(item && (item.title || item.label || item.name || "")).trim();
        const description = String(item && (item.description || item.details || "")).trim();
        const fileHref = safeFileHref(item && item.fileUrl, "");
        const imageSrc = safeImageSrc(fileHref || (item && item.fileUrl), "");
        const buttonLabel = String(item && (item.buttonLabel || "")).trim() || "Открыть документ";
        const tag = String(item && (item.tag || "")).trim() || getAttachmentBadge(fileHref || (item && item.fileUrl));

        if (!title && !description && !fileHref && !imageSrc) {
          return null;
        }

        return {
          title: title || "Документ " + String(index + 1),
          description: description,
          fileHref: fileHref,
          imageSrc: imageSrc,
          buttonLabel: buttonLabel,
          tag: tag,
        };
      })
      .filter(Boolean);

    if (!visibleItems.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    setText("aboutPageDocumentsEyebrow", data.eyebrow);
    setText("aboutPageDocumentsTitle", data.title);
    setText("aboutPageDocumentsDescription", data.description);

    grid.innerHTML = visibleItems
      .map(function (item) {
        const descriptionHtml = String(item.description || "").trim()
          ? "<p>" + escapeHtml(item.description).replace(/\n/g, "<br>") + "</p>"
          : "";
        const mediaClass = item.imageSrc
          ? "material-card__media material-card__media--image"
          : "material-card__media";
        const mediaHtml = item.imageSrc
          ? '<img class="material-card__image" src="' +
            escapeHtml(item.imageSrc) +
            '" alt="' +
            escapeHtml(item.title) +
            '" loading="lazy" />'
          : '<div class="material-card__file"><span class="material-card__file-badge">' +
            escapeHtml(item.tag) +
            '</span><span>Документ готов к открытию</span></div>';
        const buttonHtml = item.fileHref
          ? '<a class="btn btn--outline material-card__link" href="' +
            escapeHtml(item.fileHref) +
            '" target="_blank" rel="noreferrer">' +
            escapeHtml(item.buttonLabel) +
            "</a>"
          : "";

        return (
          '<article class="material-card">' +
          '<div class="' +
          mediaClass +
          '">' +
          mediaHtml +
          "</div>" +
          '<div class="material-card__body">' +
          '<span class="material-card__tag">' +
          escapeHtml(item.tag) +
          "</span>" +
          "<h3>" +
          escapeHtml(item.title) +
          "</h3>" +
          descriptionHtml +
          buttonHtml +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderServicePrices(prices) {
    const section = document.getElementById("prices");
    const grid = document.getElementById("servicesPricesGrid");

    if (!section || !grid) {
      return;
    }

    const data = prices || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const defaultButtonLabel = String(data.buttonLabel || "").trim() || "Записаться";
    const defaultButtonHref = resolveSiteHref(data.buttonLink, "/contacts");
    const visibleItems = items
      .map(function (item, index) {
        const tag = String(item && (item.tag || item.category || item.type || "")).trim() || "Услуга";
        const title = String(item && (item.title || item.name || item.label || "")).trim();
        const price = String(item && (item.price || item.amount || item.value || "")).trim() || "По прайсу";
        const note = String(item && (item.note || item.description || item.details || "")).trim();
        const buttonLabel =
          String(item && (item.buttonLabel || item.ctaLabel || "")).trim() || defaultButtonLabel;
        const buttonHref = resolveSiteHref(item && item.buttonLink, defaultButtonHref);

        if (!title && !price && !note) {
          return null;
        }

        return {
          tag: tag,
          title: title || "Позиция прайса " + String(index + 1),
          price: price,
          note: note,
          buttonLabel: buttonLabel,
          buttonHref: buttonHref,
        };
      })
      .filter(Boolean);

    if (!visibleItems.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    setText("servicesPagePricesEyebrow", data.eyebrow);
    setText("servicesPagePricesTitle", data.title);
    setText("servicesPagePricesDescription", data.description);

    grid.innerHTML = visibleItems
      .map(function (item) {
        const noteHtml = item.note
          ? "<p>" + escapeHtml(item.note).replace(/\n/g, "<br>") + "</p>"
          : "";
        const buttonHtml = item.buttonHref
          ? '<a class="btn btn--outline price-card__link" href="' +
            escapeHtml(item.buttonHref) +
            '">' +
            escapeHtml(item.buttonLabel) +
            "</a>"
          : "";

        return (
          '<article class="price-card">' +
          '<div class="price-card__top">' +
          '<span class="price-card__tag">' +
          escapeHtml(item.tag) +
          "</span>" +
          '<span class="price-card__price">' +
          escapeHtml(item.price) +
          "</span>" +
          "</div>" +
          '<div class="price-card__body">' +
          "<h3>" +
          escapeHtml(item.title) +
          "</h3>" +
          noteHtml +
          "</div>" +
          buttonHtml +
          "</article>"
        );
      })
      .join("");
  }

  function renderDoctors(items, containerId, excludedSlug) {
    const container = document.getElementById(containerId || "doctorsGrid");

    if (!container) {
      return;
    }

    container.innerHTML = items
      .map(function (item, index) {
        const slug = getDoctorSlug(item, index);

        if (excludedSlug && slug === excludedSlug) {
          return "";
        }

        const photoSrc = safeImageSrc(item.image, "");

        return (
          '<article class="doctor-card' + (photoSrc ? " doctor-card--photo" : "") + '">' +
          '<div class="doctor-card__top">' +
          (photoSrc
            ? '<span class="doctor-card__avatar doctor-card__avatar--photo"><img class="doctor-card__photo" src="' +
              escapeHtml(photoSrc) +
              '" alt="' +
              escapeHtml(item.name || "") +
              '" loading="lazy" /></span>'
            : '<span class="doctor-card__avatar">' + escapeHtml(getInitials(item.name)) + "</span>") +
          '<div class="doctor-card__meta">' +
          "<h3>" +
          escapeHtml(item.name) +
          "</h3>" +
          "<p>" +
          escapeHtml(item.specialty) +
          "</p>" +
          '<span>' +
          escapeHtml(item.experience) +
          "</span>" +
          "</div>" +
          "</div>" +
          "<p>" +
          escapeHtml(item.about) +
          "</p>" +
          '<a class="doctor-card__link" href="' +
          escapeHtml(getDoctorDetailHref(item, index)) +
          '">Профиль врача</a>' +
          "</article>"
        );
      })
      .join("");
  }

  function renderReviews(items) {
    const container = document.getElementById("reviewsGrid");

    if (!container) {
      return;
    }

    const slides = items
      .map(function (item) {
        return (
          '<article class="review-card reviews-slider__slide">' +
          "<blockquote>" +
          escapeHtml(item.quote) +
          "</blockquote>" +
          "<footer>" +
          "<h3>" +
          escapeHtml(item.author) +
          "</h3>" +
          '<span class="review-card__role">' +
          escapeHtml(item.role) +
          "</span>" +
          "</footer>" +
          "</article>"
        );
      })
      .join("");

    const controls =
      items.length > 1
        ? '<div class="reviews-slider__controls">' +
          '<div class="reviews-slider__buttons">' +
          '<button class="reviews-slider__button" type="button" data-review-prev>←</button>' +
          '<button class="reviews-slider__button" type="button" data-review-next>→</button>' +
          "</div>" +
          '<div class="reviews-slider__dots" role="tablist" aria-label="Навигация по отзывам">' +
          items
            .map(function (_, index) {
              return (
                '<button class="reviews-slider__dot" type="button" data-review-dot="' +
                index +
                '" aria-label="Отзыв ' +
                (index + 1) +
                '"></button>'
              );
            })
            .join("") +
          "</div>" +
          "</div>"
        : "";

    container.innerHTML =
      '<div class="reviews-slider" data-review-slider tabindex="0">' +
      '<div class="reviews-slider__viewport">' +
      '<div class="reviews-slider__track">' +
      slides +
      "</div>" +
      "</div>" +
      controls +
      "</div>";
  }

  function populateLeadServices(items) {
    const select = document.getElementById("leadService");

    if (!select) {
      return;
    }

    const options = [
      '<option value="">' + escapeHtml(translateUiText("Выберите направление")) + "</option>",
    ]
      .concat(
        items.map(function (item) {
          return (
            '<option value="' +
            escapeHtml(item.name) +
            '">' +
            escapeHtml(item.name) +
            "</option>"
          );
        })
      )
      .join("");

    select.innerHTML = options;
  }

  function populateLeadServicesWithPreferred(items, preferredOption) {
    populateLeadServices(items);

    const select = document.getElementById("leadService");

    if (!select || !preferredOption || !preferredOption.value) {
      return;
    }

    const option = document.createElement("option");
    option.value = preferredOption.value;
    option.textContent = translateUiText(preferredOption.label || preferredOption.value);
    select.insertBefore(option, select.options[1] || null);
    select.value = preferredOption.value;
  }

  function renderServiceDetail(content) {
    const slug = getServiceSlugFromLocation();
    const result = findServiceBySlug(content.services || [], slug);
    const state = document.getElementById("serviceDetailState");
    const page = (content.pages && content.pages.serviceDetail) || {};

    setText("serviceDetailEyebrow", page.hero && page.hero.badge);
    setOptionalLink(
      "serviceDetailPrimaryLink",
      page.hero && page.hero.primaryLink,
      page.hero && page.hero.primaryLabel
    );
    setOptionalLink(
      "serviceDetailSecondaryLink",
      page.hero && page.hero.secondaryLink,
      page.hero && page.hero.secondaryLabel
    );
    setText("serviceDetailMissingBadge", page.notFound && page.notFound.badge);
    setText("serviceDetailMissingTitle", page.notFound && page.notFound.title);
    setText("serviceDetailMissingDescription", page.notFound && page.notFound.description);
    setOptionalLink(
      "serviceDetailMissingPrimaryLink",
      page.notFound && page.notFound.primaryLink,
      page.notFound && page.notFound.primaryLabel
    );
    setOptionalLink(
      "serviceDetailMissingSecondaryLink",
      page.notFound && page.notFound.secondaryLink,
      page.notFound && page.notFound.secondaryLabel
    );
    setText("serviceDetailRouteLabel", page.contactCard && page.contactCard.label);
    setText("serviceDetailRouteText", page.contactCard && page.contactCard.text);
    setText("serviceLeadBadge", page.lead && page.lead.badge);
    setText("serviceRelatedPlain", page.related && page.related.plainLabel);
    setText("serviceRelatedAccent", page.related && page.related.accentLabel);
    setText("serviceRelatedDescription", page.related && page.related.description);

    if (!result) {
      if (state) {
        state.hidden = false;
      }

      applySeoMetaTags({
        title:
          (page.notFound && page.notFound.title) ||
          ((content.brand && content.brand.name) || "PROMEDCENTRE") + " | Услуга",
        description: (page.notFound && page.notFound.description) || "",
        ogTitle:
          (page.notFound && page.notFound.title) ||
          ((content.brand && content.brand.name) || "PROMEDCENTRE") + " | Услуга",
        ogDescription: (page.notFound && page.notFound.description) || "",
        ogType: "website",
        ogImage:
          safeImageSrc(content.hero && content.hero.image, "/assets/og-default.svg") ||
          "/assets/og-default.svg",
        twitterTitle:
          (page.notFound && page.notFound.title) ||
          ((content.brand && content.brand.name) || "PROMEDCENTRE") + " | Услуга",
        twitterDescription: (page.notFound && page.notFound.description) || "",
        twitterImage:
          safeImageSrc(content.hero && content.hero.image, "/assets/og-default.svg") ||
          "/assets/og-default.svg",
      });

      const related = document.getElementById("relatedServicesGrid");

      if (related) {
        renderServices(content.services || [], "relatedServicesGrid");
      }

      return;
    }

    const item = result.item;
    const theme = getServiceVisualTheme(item, result.index);
    const imageSrc = safeImageSrc(item.image, "");
    const mediaHtml = imageSrc
      ? '<img class="service-detail__image" src="' +
        escapeHtml(imageSrc) +
        '" alt="' +
        escapeHtml(item.name || "Услуга") +
        '" loading="lazy" />'
      : getServiceIllustration(theme, "service-detail__svg");

    if (state) {
      state.hidden = true;
    }

    applySeoMetaTags(
      buildDetailSeoData(
        content,
        "serviceDetail",
        item,
        String((content.brand && content.brand.name) || "PROMEDCENTRE") +
          " | " +
          String(item.name || "Услуга"),
        String(item.description || item.details || "Смотрите детали услуги.")
      )
    );
    setText("serviceDetailTitle", item.name);
    setText("serviceDetailDescription", item.description);
    setText("serviceDetailNote", item.details);
    setText("serviceDetailPhone", content.brand.phone);
    setText("serviceDetailHours", content.brand.hours);
    setText("serviceDetailAddress", content.brand.address);
    setText(
      "serviceLeadTitle",
      applyTemplate(
        page.lead && page.lead.titleTemplate,
        {
          name: item.name || "Услуга",
          service: item.name || "Услуга",
        },
        "Запишитесь на направление: " + String(item.name || "Услуга")
      )
    );
    setText(
      "serviceLeadDescription",
      (page.lead && page.lead.description) ||
        "Оставьте заявку, и администратор поможет подобрать удобное время и уточнит подготовку."
    );

    const media = document.getElementById("serviceDetailVisual");

    if (media) {
      media.innerHTML = mediaHtml;
    }

    const select = document.getElementById("leadService");

    if (select) {
      select.value = item.name || "";
    }

    renderServices(content.services || [], "relatedServicesGrid", slug);
  }

  function renderDoctorDetail(content) {
    const slug = getDoctorSlugFromLocation();
    const result = findDoctorBySlug(content.doctors || [], slug);
    const state = document.getElementById("doctorDetailState");
    const page = (content.pages && content.pages.doctorDetail) || {};

    setText("doctorDetailEyebrow", page.hero && page.hero.badge);
    setOptionalLink(
      "doctorDetailPrimaryLink",
      page.hero && page.hero.primaryLink,
      page.hero && page.hero.primaryLabel
    );
    setOptionalLink(
      "doctorDetailSecondaryLink",
      page.hero && page.hero.secondaryLink,
      page.hero && page.hero.secondaryLabel
    );
    setText("doctorDetailMissingBadge", page.notFound && page.notFound.badge);
    setText("doctorDetailMissingTitle", page.notFound && page.notFound.title);
    setText("doctorDetailMissingDescription", page.notFound && page.notFound.description);
    setOptionalLink(
      "doctorDetailMissingPrimaryLink",
      page.notFound && page.notFound.primaryLink,
      page.notFound && page.notFound.primaryLabel
    );
    setOptionalLink(
      "doctorDetailMissingSecondaryLink",
      page.notFound && page.notFound.secondaryLink,
      page.notFound && page.notFound.secondaryLabel
    );
    setText("doctorDetailFormatLabel", page.contactCard && page.contactCard.label);
    setText("doctorDetailFormatText", page.contactCard && page.contactCard.text);
    setText("doctorLeadBadge", page.lead && page.lead.badge);
    setText("doctorRelatedBadge", page.related && page.related.badge);
    setText("doctorRelatedTitle", page.related && page.related.title);
    setText("doctorRelatedDescription", page.related && page.related.description);

    if (!result) {
      if (state) {
        state.hidden = false;
      }

      applySeoMetaTags({
        title:
          (page.notFound && page.notFound.title) ||
          ((content.brand && content.brand.name) || "PROMEDCENTRE") + " | Врач",
        description: (page.notFound && page.notFound.description) || "",
        ogTitle:
          (page.notFound && page.notFound.title) ||
          ((content.brand && content.brand.name) || "PROMEDCENTRE") + " | Врач",
        ogDescription: (page.notFound && page.notFound.description) || "",
        ogType: "website",
        ogImage:
          safeImageSrc(content.hero && content.hero.image, "/assets/og-default.svg") ||
          "/assets/og-default.svg",
        twitterTitle:
          (page.notFound && page.notFound.title) ||
          ((content.brand && content.brand.name) || "PROMEDCENTRE") + " | Врач",
        twitterDescription: (page.notFound && page.notFound.description) || "",
        twitterImage:
          safeImageSrc(content.hero && content.hero.image, "/assets/og-default.svg") ||
          "/assets/og-default.svg",
      });

      renderDoctors(content.doctors || [], "relatedDoctorsGrid");
      return;
    }

    const item = result.item;
    const imageSrc = safeImageSrc(item.image, "");
    const mediaHtml = imageSrc
      ? '<img class="doctor-detail__image" src="' +
        escapeHtml(imageSrc) +
        '" alt="' +
        escapeHtml(item.name || "Врач") +
        '" loading="lazy" />'
      : '<div class="doctor-detail__avatar-card">' +
        '<span class="doctor-detail__avatar">' +
        escapeHtml(getInitials(item.name)) +
        "</span>" +
        '<strong class="doctor-detail__avatar-name">' +
        escapeHtml(item.name || "Врач") +
        "</strong>" +
        '<span class="doctor-detail__avatar-role">' +
        escapeHtml(item.specialty || "Специалист клиники") +
        "</span>" +
        "</div>";

    if (state) {
      state.hidden = true;
    }

    applySeoMetaTags(
      buildDetailSeoData(
        content,
        "doctorDetail",
        item,
        String((content.brand && content.brand.name) || "PROMEDCENTRE") +
          " | " +
          String(item.name || "Врач"),
        String(item.specialty || item.experience || item.about || "Смотрите детали врача.")
      )
    );
    setText("doctorDetailTitle", item.name);
    setText("doctorDetailSpecialty", item.specialty);
    setText("doctorDetailExperience", item.experience);
    setText("doctorDetailAbout", item.about);
    setText("doctorDetailPhone", content.brand.phone);
    setText("doctorDetailHours", content.brand.hours);
    setText("doctorDetailAddress", content.brand.address);
    setText(
      "doctorLeadTitle",
      applyTemplate(
        page.lead && page.lead.titleTemplate,
        {
          name: item.name || "Специалист",
          doctor: item.name || "Специалист",
        },
        "Запишитесь к врачу: " + String(item.name || "Специалист")
      )
    );
    setText(
      "doctorLeadDescription",
      (page.lead && page.lead.description) ||
        "Оставьте заявку, и администратор поможет выбрать удобное время и уточнит детали приема."
    );

    const media = document.getElementById("doctorDetailVisual");

    if (media) {
      media.innerHTML = mediaHtml;
    }

    populateLeadServicesWithPreferred(content.services || [], {
      value: "Консультация: " + String(item.name || "Специалист"),
      label: "Запись к " + String(item.name || "врачу"),
    });

    renderDoctors(content.doctors || [], "relatedDoctorsGrid", slug);
  }

  function renderInternalPages(content) {
    const pages = content.pages || {};
    const about = pages.about || {};
    const services = pages.services || {};
    const doctors = pages.doctors || {};
    const contacts = pages.contacts || {};

    setText("aboutPageHeroBadge", about.hero && about.hero.badge);
    setText("aboutPageHeroTitle", about.hero && about.hero.title);
    setText("aboutPageHeroDescription", about.hero && about.hero.description);
    setOptionalLink(
      "aboutPageHeroPrimaryLink",
      about.hero && about.hero.primaryLink,
      about.hero && about.hero.primaryLabel
    );
    setOptionalLink(
      "aboutPageHeroSecondaryLink",
      about.hero && about.hero.secondaryLink,
      about.hero && about.hero.secondaryLabel
    );
    setText("aboutPageFact1Title", about.facts && about.facts[0] && about.facts[0].title);
    setText("aboutPageFact1Text", about.facts && about.facts[0] && about.facts[0].text);
    setText("aboutPageFact2Title", about.facts && about.facts[1] && about.facts[1].title);
    setText("aboutPageFact2Text", about.facts && about.facts[1] && about.facts[1].text);
    setText("aboutPageFact3Title", about.facts && about.facts[2] && about.facts[2].title);
    setText("aboutPageFact3Text", about.facts && about.facts[2] && about.facts[2].text);
    setText("aboutPageBenefitsIntro", about.benefitsIntro);
    setText("aboutPageBridgeBadge", about.bridge && about.bridge.badge);
    setText("aboutPageBridgeTitle", about.bridge && about.bridge.title);
    setText("aboutPageBridgeDescription", about.bridge && about.bridge.description);
    setOptionalLink(
      "aboutPageBridgePrimaryLink",
      about.bridge && about.bridge.primaryLink,
      about.bridge && about.bridge.primaryLabel
    );
    setOptionalLink(
      "aboutPageBridgeSecondaryLink",
      about.bridge && about.bridge.secondaryLink,
      about.bridge && about.bridge.secondaryLabel
    );
    renderGallery(about.gallery || {});
    renderMaterials(about.materials || {});
    renderDocuments(about.documents || {});

    setText("servicesPageHeroBadge", services.hero && services.hero.badge);
    setText("servicesPageHeroTitle", services.hero && services.hero.title);
    setText("servicesPageHeroDescription", services.hero && services.hero.description);
    setOptionalLink(
      "servicesPageHeroPrimaryLink",
      services.hero && services.hero.primaryLink,
      services.hero && services.hero.primaryLabel
    );
    setOptionalLink(
      "servicesPageHeroSecondaryLink",
      services.hero && services.hero.secondaryLink,
      services.hero && services.hero.secondaryLabel
    );
    setText("servicesPageSectionHeadingPlain", services.sectionHeadingPlain || "наши");
    setText("servicesPageSectionHeadingAccent", services.sectionHeadingAccent || "услуги");
    setText("servicesPageFact1Title", services.facts && services.facts[0] && services.facts[0].title);
    setText("servicesPageFact1Text", services.facts && services.facts[0] && services.facts[0].text);
    setText("servicesPageFact2Title", services.facts && services.facts[1] && services.facts[1].title);
    setText("servicesPageFact2Text", services.facts && services.facts[1] && services.facts[1].text);
    setText("servicesPageFact3Title", services.facts && services.facts[2] && services.facts[2].title);
    setText("servicesPageFact3Text", services.facts && services.facts[2] && services.facts[2].text);
    setText("servicesPageSectionIntro", services.sectionIntro);
    renderServicePrices(services.prices || {});
    setText("servicesPageBridgeBadge", services.bridge && services.bridge.badge);
    setText("servicesPageBridgeTitle", services.bridge && services.bridge.title);
    setText("servicesPageBridgeDescription", services.bridge && services.bridge.description);
    setOptionalLink(
      "servicesPageBridgePrimaryLink",
      services.bridge && services.bridge.primaryLink,
      services.bridge && services.bridge.primaryLabel
    );
    setOptionalLink(
      "servicesPageBridgeSecondaryLink",
      services.bridge && services.bridge.secondaryLink,
      services.bridge && services.bridge.secondaryLabel
    );

    setText("doctorsPageHeroBadge", doctors.hero && doctors.hero.badge);
    setText("doctorsPageHeroTitle", doctors.hero && doctors.hero.title);
    setText("doctorsPageHeroDescription", doctors.hero && doctors.hero.description);
    setOptionalLink(
      "doctorsPageHeroPrimaryLink",
      doctors.hero && doctors.hero.primaryLink,
      doctors.hero && doctors.hero.primaryLabel
    );
    setOptionalLink(
      "doctorsPageHeroSecondaryLink",
      doctors.hero && doctors.hero.secondaryLink,
      doctors.hero && doctors.hero.secondaryLabel
    );
    setText("doctorsPageFact1Title", doctors.facts && doctors.facts[0] && doctors.facts[0].title);
    setText("doctorsPageFact1Text", doctors.facts && doctors.facts[0] && doctors.facts[0].text);
    setText("doctorsPageFact2Title", doctors.facts && doctors.facts[1] && doctors.facts[1].title);
    setText("doctorsPageFact2Text", doctors.facts && doctors.facts[1] && doctors.facts[1].text);
    setText("doctorsPageSectionIntro", doctors.doctorsIntro);
    setText("doctorsPageReviewsIntro", doctors.reviewsIntro);
    setText("doctorsPageBridgeBadge", doctors.bridge && doctors.bridge.badge);
    setText("doctorsPageBridgeTitle", doctors.bridge && doctors.bridge.title);
    setText("doctorsPageBridgeDescription", doctors.bridge && doctors.bridge.description);
    setOptionalLink(
      "doctorsPageBridgePrimaryLink",
      doctors.bridge && doctors.bridge.primaryLink,
      doctors.bridge && doctors.bridge.primaryLabel
    );
    setOptionalLink(
      "doctorsPageBridgeSecondaryLink",
      doctors.bridge && doctors.bridge.secondaryLink,
      doctors.bridge && doctors.bridge.secondaryLabel
    );

    setText("contactsPageHeroBadge", contacts.hero && contacts.hero.badge);
    setText("contactsPageHeroTitle", contacts.hero && contacts.hero.title);
    setText("contactsPageHeroDescription", contacts.hero && contacts.hero.description);
    setText("contactsPageFact1Title", contacts.facts && contacts.facts[0] && contacts.facts[0].title);
    setText("contactsPageFact1Text", contacts.facts && contacts.facts[0] && contacts.facts[0].text);
    setText("contactsPageFact2Title", contacts.facts && contacts.facts[1] && contacts.facts[1].title);
    setText("contactsPageFact2Text", contacts.facts && contacts.facts[1] && contacts.facts[1].text);
  }

  function renderPage(content) {
    const phoneHref = phoneToHref(content.brand.phone);
    const primaryHref = resolveSiteHref(content.hero.primaryCtaLink, "/contacts");
    const secondaryHref = resolveSiteHref(content.hero.secondaryCtaLink, "/services");
    const pages = content.pages || {};
    const home = pages.home || {};
    const heroBadgeText = String(content.hero.badge || "").trim();
    const heroTitleText = String(content.hero.title || "").trim();
    const heroDescriptionText = String(content.hero.description || "").trim();
    const heroPrimaryLabel = String(content.hero.primaryCtaLabel || "").trim();
    const heroSecondaryLabel = String(content.hero.secondaryCtaLabel || "").trim();
    const pageTitle =
      document.body && document.body.dataset.pageTitle
        ? document.body.dataset.pageTitle
        : "Медицинская клиника";
    const socials = (content.brand && content.brand.socials) || {};
    const brandEmail = String((content.brand && content.brand.email) || "").trim();
    const telegramHref = telegramToHref(socials.telegram);
    const instagramHref = instagramToHref(socials.instagram);
    const whatsappHref = whatsappToHref(socials.whatsapp);
    const tiktokHref = tiktokToHref(socials.tiktok);
    const secondaryContactHref = brandEmail ? emailToHref(brandEmail) : telegramHref;
    const secondaryContactLabel = brandEmail || telegramToLabel(socials.telegram);
    const contactSecondaryHeading = brandEmail ? translateUiText("E-mail") : translateUiText("Telegram");

    document.title = content.brand.name + " | " + translateUiText(pageTitle);
    setImage("brandLogo", content.brand.logo, "/assets/logo.svg?v=20260328");
    const brandLogo = document.getElementById("brandLogo");

    if (brandLogo) {
      brandLogo.alt = "Логотип " + String(content.brand.name || "клиники");
    }

    setText("brandName", content.brand.name);
    setText("brandTag", content.brand.tag);
    setText("footerBrandName", content.brand.name);
    setText("footerBrandTag", content.brand.tag);
    setText(
      "footerCopyright",
      content.brand.footerCopyrightText || "© PROMEDCENTRE. Все права защищены."
    );

    setLink("headerPhone", phoneHref, content.brand.phone);
    setOptionalLink("headerSecondaryContact", secondaryContactHref, secondaryContactLabel);
    setLink("headerPrimaryCta", primaryHref, heroPrimaryLabel);
    setLink("headerSecondaryCta", secondaryHref, heroSecondaryLabel);
    setLink("contactPhone", phoneHref, content.brand.phone);
    setLink("footerPhone", phoneHref, content.brand.footerPhoneLabel || "Позвонить");
    setOptionalLink("footerSecondaryLink", secondaryContactHref, secondaryContactLabel);
    setText("contactSecondaryLabel", contactSecondaryHeading);
    setOptionalLink("contactSecondaryLink", secondaryContactHref, secondaryContactLabel);
    setOptionalLink("socialTelegram", telegramHref, "TG");
    setOptionalLink("socialInstagram", instagramHref, "IG");
    setOptionalLink("socialWhatsapp", whatsappHref, "WA");
    setOptionalLink("socialTiktok", tiktokHref, "TT");
    setOptionalLink("footerTelegram", telegramHref, telegramToLabel(socials.telegram));
    setOptionalLink(
      "footerInstagram",
      instagramHref,
      instagramToLabel(socials.instagram)
    );
    setOptionalLink("footerWhatsapp", whatsappHref, "WhatsApp");
    setOptionalLink("footerTiktok", tiktokHref, tiktokToLabel(socials.tiktok));

    setText("contactAddress", content.brand.address);
    setText("contactHours", content.brand.hours);
    setText("footerAddress", content.brand.address);
    setText("footerHours", content.brand.hours);

    setText("heroBadge", heroBadgeText);
    setText("heroTitle", heroTitleText);
    setText("heroDescription", heroDescriptionText);
    const heroBadgeNode = document.getElementById("heroBadge");
    const heroTitleNode = document.getElementById("heroTitle");
    const heroDescriptionNode = document.getElementById("heroDescription");
    const heroActionsNode = document.querySelector(".hero__actions");

    if (heroBadgeNode) {
      heroBadgeNode.hidden = !heroBadgeText;
    }

    if (heroTitleNode) {
      heroTitleNode.hidden = !heroTitleText;
    }

    if (heroDescriptionNode) {
      heroDescriptionNode.hidden = !heroDescriptionText;
    }

    if (heroActionsNode) {
      heroActionsNode.hidden = !(heroPrimaryLabel || heroSecondaryLabel);
    }
    const heroVisualImage = document.getElementById("heroVisualImage");

    if (heroVisualImage) {
      const heroImageSrc = safeImageSrc(content.hero && content.hero.image, "");

      if (heroImageSrc) {
        heroVisualImage.hidden = false;
        heroVisualImage.setAttribute("src", heroImageSrc);
      } else {
        heroVisualImage.removeAttribute("src");
        heroVisualImage.hidden = true;
      }
    }
    setLink("heroPrimaryLink", primaryHref, heroPrimaryLabel);
    setLink("heroSecondaryLink", secondaryHref, heroSecondaryLabel);

    setText("storyEyebrow", content.story.eyebrow);
    setText("storyTitle", content.story.title);
    setText("storyDescription", content.story.description);
    setText("storyNote", content.story.note);

    setText("homeBenefitsHeadingPlain", home.benefitsHeadingPlain || translateUiText("наши"));
    setText(
      "homeBenefitsHeadingAccent",
      home.benefitsHeadingAccent || translateUiText("преимущества")
    );
    setText(
      "homeBenefitsIntro",
      home.benefitsIntro ||
        translateUiText(
          "Показываем не просто набор кабинетов, а понятный сервис, из-за которого пациенты возвращаются и рекомендуют клинику."
        )
    );
    setText("homeDoctorsEyebrow", home.doctorsEyebrow || translateUiText("Команда"));
    setText(
      "homeDoctorsTitle",
      home.doctorsTitle ||
        translateUiText("Специалисты, которые объясняют лечение человеческим языком.")
    );
    setText(
      "homeDoctorsDescription",
      home.doctorsDescription ||
        translateUiText(
          "На странице врачей мы собрали расширенный состав команды, а на главной оставили короткий обзор."
        )
    );
    setText("homeReviewsEyebrow", home.reviewsEyebrow || translateUiText("Отзывы"));
    setText(
      "homeReviewsTitle",
      home.reviewsTitle || translateUiText("Что пациенты отмечают после приема и диагностики.")
    );
    setText(
      "homeReviewsDescription",
      home.reviewsDescription ||
        translateUiText("Отзывы помогают показать реальный опыт пациентов и укрепить доверие к клинике.")
    );

    setText("ctaTitle", content.cta.title);
    setText("ctaDescription", content.cta.description);
    setLink(
      "ctaButton",
      resolveSiteHref(content.cta.buttonLink, phoneHref),
      content.cta.buttonLabel
    );

    renderInternalPages(content);

    renderMetrics(content.metrics || []);
    renderServices(content.services || []);
    renderBenefits(content.benefits || []);
    renderTrust(content.trust || {}, content.brand || {}, socials);
    renderFaq(content.faq || {});
    renderDoctors(content.doctors || []);
    renderReviews(content.reviews || []);
    populateLeadServices(content.services || []);
  }

  function setFormMessage(text, isError) {
    const node = document.getElementById("leadFormMessage");

    if (!node) {
      return;
    }

    node.textContent = translateUiText(text) || "";
    node.classList.toggle("lead-form__message--error", Boolean(isError));
  }

  function bindLeadForm() {
    const form = document.getElementById("leadForm");

    if (!form || form.dataset.bound === "true") {
      return;
    }

    form.dataset.bound = "true";
    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);

      const payload = {
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        service: String(formData.get("service") || "").trim(),
        message: String(formData.get("message") || "").trim(),
        website: String(formData.get("website") || "").trim(),
      };

      if (!payload.name || !payload.phone) {
        notify("Укажи имя и телефон.", "error");
        setFormMessage("Укажи имя и телефон.", true);
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        await window.ContentStore.submitRequest(payload);
        form.reset();
        notify("Заявка отправлена.", "success");
        setFormMessage("Заявка отправлена. Мы свяжемся с вами в ближайшее время.", false);
      } catch (error) {
        if (error && error.status === 429) {
          const retryAfter = Number(error.payload && error.payload.retryAfter);
          const message =
            retryAfter > 0
              ? `Слишком много заявок. Подожди ${retryAfter} сек. и попробуй снова.`
              : "Слишком много заявок. Подожди немного и попробуй снова.";

          notify(message, "error");
          setFormMessage(message, true);
          return;
        }

        notify("Не удалось отправить заявку.", "error");
        setFormMessage("Не удалось отправить заявку. Попробуйте еще раз.", true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  function updateSeoTags(content) {
    if (!content || !document.body) {
      return;
    }

    const pageKind = String(document.body.dataset.pageKind || "").trim();

    if (pageKind === "service-detail" || pageKind === "doctor-detail") {
      return;
    }

    const pageKey = String(document.body.dataset.nav || "").trim() || "home";
    const seoData = getSeoPage(content, pageKey);

    if (!seoData) return;

    applySeoMetaTags({
      title: seoData.title,
      description: seoData.description,
      keywords: seoData.keywords,
      ogTitle: seoData.title,
      ogDescription: seoData.description,
      ogType: "website",
      ogImage:
        safeImageSrc(content.hero && content.hero.image, "/assets/og-default.svg") ||
        "/assets/og-default.svg",
      twitterTitle: seoData.title,
      twitterDescription: seoData.description,
      twitterImage:
        safeImageSrc(content.hero && content.hero.image, "/assets/og-default.svg") ||
        "/assets/og-default.svg",
    });
  }

  async function boot() {
    if (!window.ContentStore) {
      document.documentElement.classList.remove("content-pending");
      return;
    }

    try {
      currentLocale = getCurrentLocale();
      localeInitialized = true;
      currentContent = await window.ContentStore.getContent();
      bindLocaleToggle();
      renderCurrentPage();
      document.documentElement.classList.remove("content-pending");
    } catch (error) {
      bindLeadForm();
      document.documentElement.classList.remove("content-pending");
      notify("Не удалось загрузить контент сайта. Обновите страницу.", "error");
      return;
    }

    if (!window.ContentStore.isRemoteMode()) {
      window.addEventListener("storage", function (event) {
        if (event.key === "medsite.content.v1" || event.key === "medsite.locale.v1") {
          window.ContentStore.getContent().then(function (content) {
            currentContent = content;
            if (event.key === "medsite.locale.v1") {
              currentLocale = normalizeLocale(event.newValue);
              localeInitialized = true;
            } else {
              currentLocale = getCurrentLocale();
            }
            renderCurrentPage();
          });
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot();
    });
  } else {
    boot();
  }
})();
