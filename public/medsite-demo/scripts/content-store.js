(function (root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ContentStore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const STORAGE_KEY = "medsite.content.v1";
  const SESSION_KEY = "medsite.admin.session.v1";
  const SUBMISSIONS_KEY = "medsite.submissions.v1";
  const ADMIN_PASSWORD_HASH =
    String(root && root.__MEDSITE_ADMIN_PASSWORD_HASH__ ? root.__MEDSITE_ADMIN_PASSWORD_HASH__ : "")
      .trim()
      .toLowerCase();
  const DEFAULT_BRAND_NAME = "PROMEDCENTRE";
  // Legacy markers used only to repair older saved content.
  const LEGACY_BRAND_NAME = "Aurea Med";
  const LEGACY_BRAND_TAG = "Клиника превентивной и семейной медицины";
  const LEGACY_BRAND_PHONE = "+998 (90) 123-45-67";
  const LEGACY_BRAND_EMAIL = "care@promedcentre.uz";
  const LEGACY_HOME_SERVICE_NAME = "Выезд лаборатории на дом";
  const LEGACY_HOME_SERVICE_DESCRIPTION =
    "Забор анализов дома для детей, пожилых пациентов и тех, кому важен комфорт без поездки в клинику.";
  const DEFAULT_CONTENT = root && root.DefaultContent ? root.DefaultContent : {};
  let I18N = root && root.MedsiteI18n ? root.MedsiteI18n : null;

  if (!I18N && typeof module === "object" && module.exports && typeof require === "function") {
    try {
      I18N = require("./locales.js");
    } catch (error) {
      I18N = null;
    }
  }

  const SERVICE_THEME_OPTIONS = [
    { value: "doctor", label: "Консультация врача" },
    { value: "ultrasound", label: "УЗИ" },
    { value: "analyses", label: "Анализы" },
    { value: "checkup", label: "Check-up" },
    { value: "xray", label: "Рентген" },
  ];

  const SERVICE_VISUAL_OPTIONS = [
    { value: "doctor", label: "Консультация врача" },
    { value: "ultrasound", label: "УЗИ" },
    { value: "analyses", label: "Анализы" },
    { value: "checkup", label: "Check-up" },
    { value: "xray", label: "Рентген" },
    { value: "home", label: "Главная" },
  ];

  const BENEFIT_THEME_OPTIONS = [
    { value: "care", label: "Сервис" },
    { value: "route", label: "Маршрут пациента" },
    { value: "quality", label: "Качество" },
  ];

  const SUBMISSION_STATUS_OPTIONS = [
    { value: "new", label: "Новая" },
    { value: "contacted", label: "Связались" },
    { value: "scheduled", label: "Записан" },
    { value: "closed", label: "Закрыта" },
  ];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function allowedSubmissionStatuses() {
    return SUBMISSION_STATUS_OPTIONS.map(function (option) {
      return option.value;
    });
  }

  function normalizeSubmissionStatus(value) {
    const raw = String(value || "").trim().toLowerCase();
    const allowed = allowedSubmissionStatuses();
    return allowed.indexOf(raw) !== -1 ? raw : "new";
  }

  function mergeWithDefaults(base, incoming) {
    if (Array.isArray(base)) {
      return Array.isArray(incoming) ? deepClone(incoming) : deepClone(base);
    }

    if (isObject(base)) {
      const source = isObject(incoming) ? incoming : {};
      const result = {};

      Object.keys(base).forEach(function (key) {
        result[key] = mergeWithDefaults(base[key], source[key]);
      });

      Object.keys(source).forEach(function (key) {
        if (!(key in result)) {
          result[key] = deepClone(source[key]);
        }
      });

      return result;
    }

    if (incoming === undefined || incoming === null) {
      return base;
    }

    return incoming;
  }

  const WINDOWS_1251_DECODER =
    typeof TextDecoder === "function" ? new TextDecoder("windows-1251") : null;
  const UTF8_DECODER = typeof TextDecoder === "function" ? new TextDecoder("utf-8") : null;
  let WINDOWS_1251_REVERSE_MAP = null;
  let WINDOWS_1251_SUSPICIOUS_SET = null;

  function getWindows1251Tables() {
    if (!WINDOWS_1251_DECODER) {
      return null;
    }

    if (WINDOWS_1251_REVERSE_MAP && WINDOWS_1251_SUSPICIOUS_SET) {
      return {
        reverseMap: WINDOWS_1251_REVERSE_MAP,
        suspiciousSet: WINDOWS_1251_SUSPICIOUS_SET,
      };
    }

    const bytes = new Uint8Array(256);

    for (let index = 0; index < 256; index += 1) {
      bytes[index] = index;
    }

    const decoded = WINDOWS_1251_DECODER.decode(bytes);
    const reverseMap = new Map();
    const suspiciousSet = new Set();

    for (let index = 0; index < decoded.length; index += 1) {
      const character = decoded[index];

      if (!reverseMap.has(character)) {
        reverseMap.set(character, index);
      }

      if (index >= 0x80 && index <= 0xbf) {
        suspiciousSet.add(character);
      }
    }

    WINDOWS_1251_REVERSE_MAP = reverseMap;
    WINDOWS_1251_SUSPICIOUS_SET = suspiciousSet;

    return {
      reverseMap,
      suspiciousSet,
    };
  }

  function encodeWindows1251(value) {
    const tables = getWindows1251Tables();

    if (!tables) {
      return null;
    }

    const source = String(value || "");
    const bytes = [];

    for (const character of source) {
      const byte = tables.reverseMap.get(character);

      if (byte === undefined) {
        return null;
      }

      bytes.push(byte);
    }

    return Uint8Array.from(bytes);
  }

  function repairMojibakeString(value) {
    const source = String(value || "");

    if (!source || !isLikelyMojibakeString(source)) {
      return source;
    }

    const bytes = encodeWindows1251(source);

    if (!bytes || !UTF8_DECODER) {
      return source;
    }

    const repaired = UTF8_DECODER.decode(bytes);

    if (!repaired || repaired === source) {
      return source;
    }

    if (repaired.indexOf("�") !== -1) {
      return source;
    }

    if (isLikelyMojibakeString(repaired)) {
      return source;
    }

    return repaired;
  }

  function repairMojibakeTree(node) {
    if (Array.isArray(node)) {
      let changed = false;
      const value = node.map(function (item) {
        const repaired = repairMojibakeTree(item);

        if (repaired.changed) {
          changed = true;
        }

        return repaired.value;
      });

      return {
        value: value,
        changed: changed,
      };
    }

    if (isObject(node)) {
      let changed = false;
      const value = {};

      Object.keys(node).forEach(function (key) {
        const repaired = repairMojibakeTree(node[key]);
        value[key] = repaired.value;

        if (repaired.changed) {
          changed = true;
        }
      });

      return {
        value: value,
        changed: changed,
      };
    }

    if (typeof node === "string") {
      const repaired = repairMojibakeString(node);

      return {
        value: repaired,
        changed: repaired !== node,
      };
    }

    return {
      value: node,
      changed: false,
    };
  }

  function isLikelyMojibakeString(value) {
    const source = String(value || "");

    if (source.length < 4) {
      return false;
    }

    const tables = getWindows1251Tables();

    if (!tables) {
      return false;
    }

    let suspiciousCount = 0;
    let letterCount = 0;

    for (const character of source) {
      if (/[A-Za-z\u0400-\u04FF]/.test(character)) {
        letterCount += 1;
      }

      if (tables.suspiciousSet.has(character)) {
        suspiciousCount += 1;
      }
    }

    if (suspiciousCount < 2) {
      return false;
    }

    const ratio = suspiciousCount / Math.max(1, letterCount);

    return ratio >= 0.12 || suspiciousCount >= 4;
  }

  function repairBrokenStringsWithDefaults(node, defaults) {
    if (Array.isArray(node)) {
      let changed = false;
      const defaultItems = Array.isArray(defaults) ? defaults : [];
      const value = node.map(function (item, index) {
        const repaired = repairBrokenStringsWithDefaults(item, defaultItems[index]);

        if (repaired.changed) {
          changed = true;
        }

        return repaired.value;
      });

      return {
        value: value,
        changed: changed,
      };
    }

    if (isObject(node)) {
      let changed = false;
      const defaultNode = isObject(defaults) ? defaults : {};
      const value = {};

      Object.keys(node).forEach(function (key) {
        const repaired = repairBrokenStringsWithDefaults(node[key], defaultNode[key]);
        value[key] = repaired.value;

        if (repaired.changed) {
          changed = true;
        }
      });

      return {
        value: value,
        changed: changed,
      };
    }

    if (typeof node === "string" && node.indexOf("�") !== -1 && typeof defaults === "string") {
      return {
        value: defaults,
        changed: defaults !== node,
      };
    }

    return {
      value: node,
      changed: false,
    };
  }

  function allowedThemeValues(options) {
    return options.map(function (option) {
      return option.value;
    });
  }

  function inferServiceTheme(item, index) {
    const source = String(
      (item && (item.theme || item.name || item.description || item.details)) || ""
    ).toLowerCase();

    if (source.indexOf("узи") !== -1 || source.indexOf("ultra") !== -1) {
      return "ultrasound";
    }

    if (source.indexOf("анализ") !== -1 || source.indexOf("лаборат") !== -1) {
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

    return SERVICE_THEME_OPTIONS[index % SERVICE_THEME_OPTIONS.length].value;
  }

  function inferBenefitTheme(item, index) {
    const source = String(
      (item && (item.theme || item.title || item.description)) || ""
    ).toLowerCase();

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

    return BENEFIT_THEME_OPTIONS[index % BENEFIT_THEME_OPTIONS.length].value;
  }

  function normalizeCollection(items, prefix, inferTheme, options) {
    const allowed = allowedThemeValues(options);

    if (!Array.isArray(items)) {
      return [];
    }

    return items.map(function (item, index) {
      const next = isObject(item) ? deepClone(item) : {};

      if (!next.id) {
        next.id = prefix + "-" + (index + 1);
      }

      if (allowed.indexOf(next.theme) === -1) {
        next.theme = inferTheme(next, index);
      }

      return next;
    });
  }

  function normalizeServiceThemeOptions(items) {
    const source = Array.isArray(items) && items.length ? items : SERVICE_THEME_OPTIONS;
    const allowedVisuals = allowedThemeValues(SERVICE_VISUAL_OPTIONS);

    return source.map(function (item, index) {
      const option = isObject(item) ? deepClone(item) : {};
      const fallbackVisual =
        SERVICE_VISUAL_OPTIONS[index % SERVICE_VISUAL_OPTIONS.length] &&
        SERVICE_VISUAL_OPTIONS[index % SERVICE_VISUAL_OPTIONS.length].value;

      if (!option.id) {
        option.id = "service-theme-" + (index + 1);
      }

      option.value = String(option.value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (!option.value) {
        option.value = "service-theme-" + (index + 1);
      }

      option.label = String(option.label || option.value || "Новая иллюстрация").trim();

      const visual = String(option.visual || "").trim();
      option.visual =
        allowedVisuals.indexOf(visual) !== -1
          ? visual
          : String(fallbackVisual || "doctor").trim() || "doctor";

      return option;
    });
  }

  function normalizeServiceItems(items, prefix, themeOptions) {
    const source = Array.isArray(items) ? items : [];
    const fallbackThemes = Array.isArray(themeOptions)
      ? themeOptions
          .map(function (option) {
            return String(option && option.value ? option.value : "")
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
          })
          .filter(Boolean)
      : [];

    return source.map(function (item, index) {
      const next = isObject(item) ? deepClone(item) : {};

      if (!next.id) {
        next.id = prefix + "-" + (index + 1);
      }

      const theme = String(next.theme || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      if (theme) {
        next.theme = theme;
      } else {
        next.theme =
          fallbackThemes[index % fallbackThemes.length] ||
          inferServiceTheme(next, index);
      }

      return next;
    });
  }

  const LOCALIZED_BLOCKED_TOKENS = [
    "logo",
    "image",
    "fileurl",
    "phone",
    "email",
    "telegram",
    "instagram",
    "whatsapp",
    "tiktok",
    "link",
    "url",
    "src",
    "href",
    "slug",
    "id",
    "theme",
    "price",
    "value",
  ];

  const LOCALIZED_ALLOWED_TOKENS = [
    "name",
    "badge",
    "title",
    "description",
    "note",
    "eyebrow",
    "label",
    "text",
    "answer",
    "question",
    "tag",
    "detail",
    "details",
    "intro",
    "caption",
    "specialty",
    "experience",
    "role",
    "author",
    "about",
    "quote",
    "hint",
      "template",
      "plain",
      "accent",
      "keywords",
      "keyword",
    "summary",
    "message",
    "comment",
    "subtitle",
    "content",
    "body",
  ];

  function splitLocalizedPathTokens(path) {
    return String(path || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(function (token) {
        return token.toLowerCase();
      });
  }

  function isLocalizedPath(path) {
    const normalized = String(path || "").trim();
    const tokens = splitLocalizedPathTokens(normalized);

    if (!normalized) {
      return false;
    }

    if (normalized.toLowerCase() === "brand.name") {
      return false;
    }

    if (
      tokens.some(function (token) {
        return LOCALIZED_BLOCKED_TOKENS.indexOf(token) !== -1;
      })
    ) {
      return false;
    }

    if (/socials\./i.test(normalized)) {
      return false;
    }

    return tokens.length > 0 && LOCALIZED_ALLOWED_TOKENS.indexOf(tokens[tokens.length - 1]) !== -1;
  }

  function hasShadowValue(value) {
    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return value !== undefined && value !== null;
  }

  function translateLocalizedText(value) {
    const source = String(value || "");

    if (!source) {
      return source;
    }

    if (I18N && typeof I18N.translateText === "function") {
      return I18N.translateText(source, "kz");
    }

    return source;
  }

  function applyLocalizedShadows(node, path) {
    if (Array.isArray(node)) {
      node.forEach(function (item, index) {
        applyLocalizedShadows(item, path ? path + "." + index : String(index));
      });

      return node;
    }

    if (!isObject(node)) {
      return node;
    }

    Object.keys(node).forEach(function (key) {
      if (/(?:Ru|Kz)$/i.test(key)) {
        return;
      }

      const value = node[key];
      const childPath = path ? path + "." + key : key;

      applyLocalizedShadows(value, childPath);

      if (!isLocalizedPath(childPath)) {
        return;
      }

      if (typeof value !== "string") {
        return;
      }

      const shadowKey = key + "Kz";

      if (hasShadowValue(node[shadowKey])) {
        return;
      }

      node[shadowKey] = translateLocalizedText(value);
    });

    return node;
  }

  function normalizePageCards(items, defaults) {
    const source = Array.isArray(items) ? items : [];

    return defaults.map(function (fallback, index) {
      const incoming = isObject(source[index]) ? source[index] : {};
      return mergeWithDefaults(fallback, incoming);
    });
  }

  function normalizeTrustCards(items) {
    const source = Array.isArray(items) ? items : [];

    return source.map(function (item, index) {
      const card = isObject(item) ? deepClone(item) : { title: String(item || "") };

      if (!card.id) {
        card.id = "trust-card-" + (index + 1);
      }

      return card;
    });
  }

  function normalizeTrustNoteItems(items) {
    const source = Array.isArray(items) ? items : [];

    return source.map(function (item, index) {
      if (isObject(item)) {
        const noteItem = deepClone(item);

        if (!noteItem.id) {
          noteItem.id = "trust-note-" + (index + 1);
        }

        if (typeof noteItem.text !== "string") {
          noteItem.text = String(noteItem.text || noteItem.label || noteItem.title || "");
        }

        return noteItem;
      }

      return {
        id: "trust-note-" + (index + 1),
        text: String(item || ""),
      };
    });
  }

  function normalizeFaqItems(items) {
    const source = Array.isArray(items) ? items : [];

    return source.map(function (item, index) {
      if (isObject(item)) {
        const faqItem = deepClone(item);

        if (!faqItem.id) {
          faqItem.id = "faq-item-" + (index + 1);
        }

        if (typeof faqItem.question !== "string") {
          faqItem.question = String(
            faqItem.question || faqItem.title || faqItem.label || faqItem.text || ""
          );
        }

        if (typeof faqItem.answer !== "string") {
          faqItem.answer = String(
            faqItem.answer || faqItem.description || faqItem.details || ""
          );
        }

        return faqItem;
      }

      return {
        id: "faq-item-" + (index + 1),
        question: String(item || ""),
        answer: "",
      };
    });
  }

  function normalizeAboutMaterials(items) {
    const source = Array.isArray(items) ? items : [];

    return source.map(function (item, index) {
      if (isObject(item)) {
        const material = deepClone(item);

        if (!material.id) {
          material.id = "material-" + (index + 1);
        }

        if (typeof material.tag !== "string") {
          material.tag = String(material.tag || material.type || "");
        }

        if (typeof material.title !== "string") {
          material.title = String(material.title || material.label || material.name || "");
        }

        if (typeof material.description !== "string") {
          material.description = String(material.description || material.details || "");
        }

        if (typeof material.fileUrl !== "string") {
          material.fileUrl = String(material.fileUrl || material.href || material.link || "");
        }

        if (typeof material.buttonLabel !== "string") {
          material.buttonLabel = String(
            material.buttonLabel || material.linkLabel || material.ctaLabel || "Открыть файл"
          );
        }

        return material;
      }

      return {
        id: "material-" + (index + 1),
        tag: "",
        title: String(item || ""),
        description: "",
        fileUrl: "",
        buttonLabel: "Открыть файл",
      };
    });
  }

  function normalizeAboutGallery(items) {
    const source = Array.isArray(items) ? items : [];

    return source.map(function (item, index) {
      if (isObject(item)) {
        const galleryItem = deepClone(item);

        if (!galleryItem.id) {
          galleryItem.id = "gallery-item-" + (index + 1);
        }

        if (typeof galleryItem.tag !== "string") {
          galleryItem.tag = String(galleryItem.tag || galleryItem.type || "");
        }

        if (typeof galleryItem.title !== "string") {
          galleryItem.title = String(galleryItem.title || galleryItem.label || galleryItem.name || "");
        }

        if (typeof galleryItem.description !== "string") {
          galleryItem.description = String(galleryItem.description || galleryItem.details || "");
        }

        if (typeof galleryItem.image !== "string") {
          galleryItem.image = String(
            galleryItem.image || galleryItem.imageUrl || galleryItem.fileUrl || ""
          );
        }

        return galleryItem;
      }

      return {
        id: "gallery-item-" + (index + 1),
        tag: "",
        title: String(item || ""),
        description: "",
        image: "",
      };
    });
  }

  function normalizeServicePriceItems(items) {
    const source = Array.isArray(items) ? items : [];

    return source.map(function (item, index) {
      if (isObject(item)) {
        const priceItem = deepClone(item);

        if (!priceItem.id) {
          priceItem.id = "price-item-" + (index + 1);
        }

        if (typeof priceItem.tag !== "string") {
          priceItem.tag = String(priceItem.tag || priceItem.category || priceItem.type || "");
        }

        if (typeof priceItem.title !== "string") {
          priceItem.title = String(
            priceItem.title || priceItem.name || priceItem.label || ""
          );
        }

        if (typeof priceItem.price !== "string") {
          priceItem.price = String(
            priceItem.price || priceItem.amount || priceItem.value || "По прайсу"
          );
        }

        if (typeof priceItem.note !== "string") {
          priceItem.note = String(
            priceItem.note || priceItem.description || priceItem.details || ""
          );
        }

        if (typeof priceItem.buttonLabel !== "string") {
          priceItem.buttonLabel = String(
            priceItem.buttonLabel || priceItem.ctaLabel || "Записаться"
          );
        }

        if (typeof priceItem.buttonLink !== "string") {
          priceItem.buttonLink = String(priceItem.buttonLink || priceItem.link || "/contacts");
        }

        return priceItem;
      }

      return {
        id: "price-item-" + (index + 1),
        tag: "",
        title: String(item || ""),
        price: "По прайсу",
        note: "",
        buttonLabel: "Записаться",
        buttonLink: "/contacts",
      };
    });
  }

  function normalizeMergedContent(merged) {
    const repaired = repairMojibakeTree(merged || {});
    const next = deepClone(repaired.value);

    next.metrics = Array.isArray(next.metrics)
      ? next.metrics.map(function (item, index) {
          const metric = isObject(item) ? deepClone(item) : {};

          if (!metric.id) {
            metric.id = "metric-" + (index + 1);
          }

          return metric;
      })
      : deepClone(DEFAULT_CONTENT.metrics || []);

    next.themeOptions = isObject(next.themeOptions) ? next.themeOptions : {};
    next.themeOptions.service = normalizeServiceThemeOptions(next.themeOptions.service);

    next.services = normalizeServiceItems(next.services, "service", next.themeOptions.service);
    next.benefits = normalizeCollection(
      next.benefits,
      "benefit",
      inferBenefitTheme,
      BENEFIT_THEME_OPTIONS
    );

    next.trust = isObject(next.trust) ? next.trust : {};
    next.trust.cards = normalizeTrustCards(next.trust.cards);
    next.trust.note = isObject(next.trust.note) ? next.trust.note : {};
    next.trust.note.items = normalizeTrustNoteItems(next.trust.note.items);

    next.faq = isObject(next.faq) ? next.faq : {};
    next.faq.items = normalizeFaqItems(next.faq.items);

    next.doctors = Array.isArray(next.doctors)
      ? next.doctors.map(function (item, index) {
          const doctor = isObject(item) ? deepClone(item) : {};

          if (!doctor.id) {
            doctor.id = "doctor-" + (index + 1);
          }

          return doctor;
        })
      : deepClone(DEFAULT_CONTENT.doctors || []);

    next.reviews = Array.isArray(next.reviews)
      ? next.reviews.map(function (item, index) {
          const review = isObject(item) ? deepClone(item) : {};

          if (!review.id) {
            review.id = "review-" + (index + 1);
          }

          return review;
        })
      : deepClone(DEFAULT_CONTENT.reviews || []);

    next.pages = isObject(next.pages) ? next.pages : {};
    next.pages.about = mergeWithDefaults(DEFAULT_CONTENT.pages.about, next.pages.about || {});
    next.pages.about.facts = normalizePageCards(
      next.pages.about.facts,
      DEFAULT_CONTENT.pages.about.facts || []
    );
    next.pages.about.materials = isObject(next.pages.about.materials)
      ? next.pages.about.materials
      : {};
    next.pages.about.materials.items = normalizeAboutMaterials(
      next.pages.about.materials.items
    );
    next.pages.about.gallery = mergeWithDefaults(
      {
        eyebrow: "Фотографии",
        title: "Клиника изнутри и снаружи.",
        description:
          "Добавьте реальные фото ресепшена, кабинетов, оборудования и входной группы.",
        items: [],
      },
      next.pages.about.gallery || {}
    );
    next.pages.about.gallery.items = normalizeAboutGallery(
      next.pages.about.gallery.items
    );
    next.pages.about.documents = mergeWithDefaults(
      {
        eyebrow: "Лицензии и документы",
        title: "Документы клиники в одном месте.",
        description:
          "Сюда можно добавить лицензии, сертификаты, разрешения и любые другие файлы.",
        items: [],
      },
      next.pages.about.documents || {}
    );
    next.pages.about.documents.items = normalizeAboutMaterials(
      next.pages.about.documents.items
    );
    next.pages.services = mergeWithDefaults(
      DEFAULT_CONTENT.pages.services,
      next.pages.services || {}
    );
    next.pages.services.facts = normalizePageCards(
      next.pages.services.facts,
      DEFAULT_CONTENT.pages.services.facts || []
    );
    next.pages.services.prices = isObject(next.pages.services.prices)
      ? next.pages.services.prices
      : {};
    next.pages.services.prices.items = normalizeServicePriceItems(
      next.pages.services.prices.items
    );
    next.pages.doctors = mergeWithDefaults(
      DEFAULT_CONTENT.pages.doctors,
      next.pages.doctors || {}
    );
    next.pages.doctors.facts = normalizePageCards(
      next.pages.doctors.facts,
      DEFAULT_CONTENT.pages.doctors.facts || []
    );
    next.pages.contacts = mergeWithDefaults(
      DEFAULT_CONTENT.pages.contacts,
      next.pages.contacts || {}
    );
    next.pages.contacts.facts = normalizePageCards(
      next.pages.contacts.facts,
      DEFAULT_CONTENT.pages.contacts.facts || []
    );
    next.pages.serviceDetail = mergeWithDefaults(
      DEFAULT_CONTENT.pages.serviceDetail,
      next.pages.serviceDetail || {}
    );
    next.pages.doctorDetail = mergeWithDefaults(
      DEFAULT_CONTENT.pages.doctorDetail,
      next.pages.doctorDetail || {}
    );

    const healed = repairBrokenStringsWithDefaults(next, DEFAULT_CONTENT);

    applyLocalizedShadows(healed.value);

    return healed.value;
  }

  function normalizeContent(content) {
    const merged = mergeWithDefaults(DEFAULT_CONTENT, content || {});
    return normalizeMergedContent(merged);
  }

  function isLegacyMetrics(metrics) {
    return (
      Array.isArray(metrics) &&
      metrics.length === 3 &&
      metrics[0] &&
      metrics[0].value === "12+" &&
      metrics[1] &&
      metrics[1].value === "20 мин" &&
      metrics[2] &&
      metrics[2].value === "7 дней"
    );
  }

  function isLegacyServices(services) {
    return (
      Array.isArray(services) &&
      services.length === 3 &&
      services.every(function (item, index) {
        return item && item.name === ["Семейная медицина", "Кардиология", "Гинекология и check-up"][index];
      })
    );
  }

  function isLegacyBenefits(benefits) {
    return (
      Array.isArray(benefits) &&
      benefits.length === 3 &&
      benefits[0] &&
      benefits[0].title === "Один маршрут лечения" &&
      benefits[1] &&
      benefits[1].title === "Без перегрузки кабинетами" &&
      benefits[2] &&
      benefits[2].title === "Нормальный сервис"
    );
  }

  function isLegacyHomeService(item) {
    return (
      item &&
      item.name === LEGACY_HOME_SERVICE_NAME &&
      item.description === LEGACY_HOME_SERVICE_DESCRIPTION
    );
  }

  function replaceTextIfContains(node, key, fragments, replacement) {
    if (!isObject(node) || typeof node[key] !== "string") {
      return;
    }

    const value = node[key];
    const list = Array.isArray(fragments) ? fragments : [fragments];
    const shouldReplace = list.some(function (fragment) {
      return fragment && value.indexOf(fragment) !== -1;
    });

    if (shouldReplace) {
      node[key] = replacement;
    }
  }

  function migrateLegacyContent(content) {
    const next = deepClone(content || {});

    if (next.brand && next.brand.name === LEGACY_BRAND_NAME) {
      next.brand.name = DEFAULT_BRAND_NAME;
    }

    if (next.brand && next.brand.tag === LEGACY_BRAND_TAG) {
      next.brand.tag = DEFAULT_CONTENT.brand.tag;
    }

    if (next.brand && next.brand.email === "care@aureamed.uz") {
      next.brand.email = DEFAULT_CONTENT.brand.email;
    }

    if (next.brand && next.brand.phone === LEGACY_BRAND_PHONE) {
      next.brand.phone = DEFAULT_CONTENT.brand.phone;
    }

    if (next.brand && next.brand.email === LEGACY_BRAND_EMAIL) {
      next.brand.email = DEFAULT_CONTENT.brand.email;
    }

    if (next.brand && (next.brand.logo === "/assets/logo.svg" || next.brand.logo === "assets/logo.svg")) {
      next.brand.logo = DEFAULT_CONTENT.brand.logo;
    }

    if (
      next.hero &&
      typeof next.hero.description === "string" &&
      next.hero.description.indexOf(LEGACY_BRAND_NAME) !== -1
    ) {
      next.hero.description = DEFAULT_CONTENT.hero.description;
    }

    if (
      next.hero &&
      next.hero.primaryCtaLabel === "Записаться на прием" &&
      next.hero.secondaryCtaLabel === "Посмотреть услуги"
    ) {
      next.hero.primaryCtaLabel = DEFAULT_CONTENT.hero.primaryCtaLabel;
      next.hero.secondaryCtaLabel = DEFAULT_CONTENT.hero.secondaryCtaLabel;
    }

    if (isLegacyMetrics(next.metrics)) {
      next.metrics = deepClone(DEFAULT_CONTENT.metrics);
    }

    if (isLegacyServices(next.services)) {
      next.services = deepClone(DEFAULT_CONTENT.services);
    }

    if (isLegacyBenefits(next.benefits)) {
      next.benefits = deepClone(DEFAULT_CONTENT.benefits);
    }

    if (next.story && next.story.eyebrow === "Клиника, где все собрано логично") {
      next.story = deepClone(DEFAULT_CONTENT.story);
    }

    if (
      next.cta &&
      next.cta.title === "Нужна консультация без очередей и лишней бюрократии?"
    ) {
      next.cta = deepClone(DEFAULT_CONTENT.cta);
    }

    if (
      Array.isArray(next.services) &&
      next.services.some(isLegacyHomeService) &&
      next.hero &&
      next.hero.secondaryCtaLabel === "Вызов на дом"
    ) {
      next.services = next.services.filter(function (item) {
        return !isLegacyHomeService(item);
      });
      next.hero.description = DEFAULT_CONTENT.hero.description;
      next.hero.secondaryCtaLabel = DEFAULT_CONTENT.hero.secondaryCtaLabel;
      next.hero.secondaryCtaLink = DEFAULT_CONTENT.hero.secondaryCtaLink;

      if (next.cta) {
        next.cta.description = DEFAULT_CONTENT.cta.description;
      }
    }

    if (next.cta && next.cta.buttonLink === "tel:+998901234567") {
      next.cta.buttonLink = DEFAULT_CONTENT.cta.buttonLink;
    }

    if (next.cta && next.cta.buttonLabel === "Позвонить в клинику") {
      next.cta.buttonLabel = DEFAULT_CONTENT.cta.buttonLabel;
    }

    if (Array.isArray(next.reviews) && next.reviews[0]) {
      replaceTextIfContains(
        next.reviews[0],
        "quote",
        "Понравилось, что сайт и сама запись работают",
        DEFAULT_CONTENT.reviews[0].quote
      );
      replaceTextIfContains(
        next.reviews[0],
        "quoteKz",
        "Сайт та, жазылудың өзі де",
        DEFAULT_CONTENT.reviews[0].quoteKz
      );
    }

    const pages = isObject(next.pages) ? next.pages : null;

    if (pages && isObject(pages.about)) {
      replaceTextIfContains(
        pages.about,
        "benefitsIntro",
        "под SEO и доверие",
        DEFAULT_CONTENT.pages.about.benefitsIntro
      );

      if (isObject(pages.about.bridge)) {
        replaceTextIfContains(
          pages.about.bridge,
          "description",
          "Структуру сайта уже можно наращивать дальше",
          DEFAULT_CONTENT.pages.about.bridge.description
        );
      }
    }

    if (pages && isObject(pages.services)) {
      if (isObject(pages.services.hero)) {
        replaceTextIfContains(
          pages.services.hero,
          "title",
          "на отдельной странице",
          DEFAULT_CONTENT.pages.services.hero.title
        );
        replaceTextIfContains(
          pages.services.hero,
          "description",
          "на отдельной странице",
          DEFAULT_CONTENT.pages.services.hero.description
        );
      }

      if (Array.isArray(pages.services.facts) && pages.services.facts[0]) {
        replaceTextIfContains(
          pages.services.facts[0],
          "text",
          "нормальной маршрутизацией по обследованиям и следующему шагу",
          DEFAULT_CONTENT.pages.services.facts[0].text
        );
      }

      if (Array.isArray(pages.services.facts) && pages.services.facts[1]) {
        replaceTextIfContains(
          pages.services.facts[1],
          "text",
          "держать рядом с приемом",
          DEFAULT_CONTENT.pages.services.facts[1].text
        );
      }

      if (Array.isArray(pages.services.facts) && pages.services.facts[2]) {
        replaceTextIfContains(
          pages.services.facts[2],
          "text",
          "отдельная история сама по себе",
          DEFAULT_CONTENT.pages.services.facts[2].text
        );
      }

      replaceTextIfContains(
        pages.services,
        "sectionIntro",
        "первый этап многостраничности",
        DEFAULT_CONTENT.pages.services.sectionIntro
      );

      replaceTextIfContains(
        pages.services.bridge,
        "title",
        "администратор закроет маршрут записи",
        DEFAULT_CONTENT.pages.services.bridge.title
      );

      if (isObject(pages.services.bridge)) {
        replaceTextIfContains(
          pages.services.bridge,
          "description",
          "Следующим этапом сюда можно будет делать отдельные страницы",
          DEFAULT_CONTENT.pages.services.bridge.description
        );
      }
    }

    if (pages && isObject(pages.doctors)) {
      if (isObject(pages.doctors.hero)) {
        replaceTextIfContains(
          pages.doctors.hero,
          "title",
          "нормальным языком",
          DEFAULT_CONTENT.pages.doctors.hero.title
        );
        replaceTextIfContains(
          pages.doctors.hero,
          "description",
          "нормальный раздел сайта",
          DEFAULT_CONTENT.pages.doctors.hero.description
        );
      }

      if (Array.isArray(pages.doctors.facts) && pages.doctors.facts[0]) {
        replaceTextIfContains(
          pages.doctors.facts[0],
          "text",
          "понятной экспертизой",
          DEFAULT_CONTENT.pages.doctors.facts[0].text
        );
      }

      if (Array.isArray(pages.doctors.facts) && pages.doctors.facts[1]) {
        replaceTextIfContains(
          pages.doctors.facts[1],
          "text",
          "должно быть ясно",
          DEFAULT_CONTENT.pages.doctors.facts[1].text
        );
      }

      replaceTextIfContains(
        pages.doctors,
        "doctorsIntro",
        "можно дальше усиливать",
        DEFAULT_CONTENT.pages.doctors.doctorsIntro
      );
      replaceTextIfContains(
        pages.doctors,
        "reviewsIntro",
        "работают на доверие",
        DEFAULT_CONTENT.pages.doctors.reviewsIntro
      );

      replaceTextIfContains(
        pages.doctors.bridge,
        "title",
        "администратор согласует удобное время",
        DEFAULT_CONTENT.pages.doctors.bridge.title
      );

      if (isObject(pages.doctors.bridge)) {
        replaceTextIfContains(
          pages.doctors.bridge,
          "description",
          "Следующим этапом сюда уже можно добавлять расписание",
          DEFAULT_CONTENT.pages.doctors.bridge.description
        );
      }
    }

    if (pages && isObject(pages.contacts)) {
      if (isObject(pages.contacts.hero)) {
        replaceTextIfContains(
          pages.contacts.hero,
          "description",
          "тебе дальше было удобнее дорабатывать этот раздел",
          DEFAULT_CONTENT.pages.contacts.hero.description
        );
      }

      if (Array.isArray(pages.contacts.facts) && pages.contacts.facts[0]) {
        replaceTextIfContains(
          pages.contacts.facts[0],
          "text",
          "Telegram-канал",
          DEFAULT_CONTENT.pages.contacts.facts[0].text
        );
      }

      if (Array.isArray(pages.contacts.facts) && pages.contacts.facts[1]) {
        replaceTextIfContains(
          pages.contacts.facts[1],
          "text",
          "глубоко внизу сайта",
          DEFAULT_CONTENT.pages.contacts.facts[1].text
        );
      }
    }

    const seoPages = isObject(next.seo) && isObject(next.seo.pages) ? next.seo.pages : null;

    if (seoPages && isObject(seoPages.home)) {
      replaceTextIfContains(
        seoPages.home,
        "title",
        "Медицинская клиника в Ташкенте",
        DEFAULT_CONTENT.seo.pages.home.title
      );
      replaceTextIfContains(
        seoPages.home,
        "description",
        "PROMEDCENTRE - частная клиника с консультациями врачей, диагностикой, check-up и лабораторией. Запись к врачам, УЗИ, анализы в одном месте.",
        DEFAULT_CONTENT.seo.pages.home.description
      );
      replaceTextIfContains(
        seoPages.home,
        "keywords",
        "медицинская клиника Ташкент, частная клиника, врачи, УЗИ, анализы, check-up, диагностика, терапевт, гинеколог, кардиолог",
        DEFAULT_CONTENT.seo.pages.home.keywords
      );
    }

    if (seoPages && isObject(seoPages.about)) {
      replaceTextIfContains(
        seoPages.about,
        "title",
        "О клинике PROMEDCENTRE",
        DEFAULT_CONTENT.seo.pages.about.title
      );
      replaceTextIfContains(
        seoPages.about,
        "description",
        "Узнайте о клинике PROMEDCENTRE: наш подход, преимущества, команда врачей и единый медицинский маршрут для пациентов.",
        DEFAULT_CONTENT.seo.pages.about.description
      );
      replaceTextIfContains(
        seoPages.about,
        "keywords",
        "о клинике PROMEDCENTRE, медицинский центр Ташкент, подход к лечению, преимущества клиники, команда врачей",
        DEFAULT_CONTENT.seo.pages.about.keywords
      );
    }

    if (seoPages && isObject(seoPages.services)) {
      replaceTextIfContains(
        seoPages.services,
        "title",
        "Услуги PROMEDCENTRE",
        DEFAULT_CONTENT.seo.pages.services.title
      );
      replaceTextIfContains(
        seoPages.services,
        "description",
        "Полный перечень услуг PROMEDCENTRE: консультации врачей, УЗИ-диагностика, лабораторные анализы, чек-ап программы и рентген.",
        DEFAULT_CONTENT.seo.pages.services.description
      );
      replaceTextIfContains(
        seoPages.services,
        "keywords",
        "услуги клиники, консультация врача, УЗИ Ташкент, анализы, check-up, диагностика, рентген, лаборатория",
        DEFAULT_CONTENT.seo.pages.services.keywords
      );
    }

    if (seoPages && isObject(seoPages.doctors)) {
      replaceTextIfContains(
        seoPages.doctors,
        "title",
        "Врачи PROMEDCENTRE",
        DEFAULT_CONTENT.seo.pages.doctors.title
      );
      replaceTextIfContains(
        seoPages.doctors,
        "description",
        "Познакомьтесь с командой врачей PROMEDCENTRE: терапевты, кардиологи, гинекологи и другие специалисты с опытом работы.",
        DEFAULT_CONTENT.seo.pages.doctors.description
      );
      replaceTextIfContains(
        seoPages.doctors,
        "keywords",
        "врачи Ташкент, специалисты клиники, терапевт, кардиолог, гинеколог, семейный врач, опытные врачи",
        DEFAULT_CONTENT.seo.pages.doctors.keywords
      );
    }

    if (seoPages && isObject(seoPages.contacts)) {
      replaceTextIfContains(
        seoPages.contacts,
        "title",
        "Контакты PROMEDCENTRE",
        DEFAULT_CONTENT.seo.pages.contacts.title
      );
      replaceTextIfContains(
        seoPages.contacts,
        "description",
        "Контактная информация PROMEDCENTRE: адрес в Ташкенте, телефон для записи, время работы, WhatsApp и социальные сети.",
        DEFAULT_CONTENT.seo.pages.contacts.description
      );
      replaceTextIfContains(
        seoPages.contacts,
        "keywords",
        "контакты клиники, адрес PROMEDCENTRE, телефон клиники, время работы, запись на прием, Ташкент ул Мирабад",
        DEFAULT_CONTENT.seo.pages.contacts.keywords
      );
    }

    if (seoPages && isObject(seoPages.serviceDetail)) {
      replaceTextIfContains(
        seoPages.serviceDetail,
        "titleTemplate",
        "PROMEDCENTRE | {name}",
        DEFAULT_CONTENT.seo.pages.serviceDetail.titleTemplate
      );
    }

    if (seoPages && isObject(seoPages.doctorDetail)) {
      replaceTextIfContains(
        seoPages.doctorDetail,
        "titleTemplate",
        "PROMEDCENTRE | {name}",
        DEFAULT_CONTENT.seo.pages.doctorDetail.titleTemplate
      );
    }

    return next;
  }

  function prepareContent(content) {
    return prepareContentWithRepair(content).content;
  }

  function prepareContentWithRepair(content) {
    const migrated = migrateLegacyContent(content);
    const merged = mergeWithDefaults(DEFAULT_CONTENT, migrated || {});
    const repaired = repairMojibakeTree(merged);
    const normalized = normalizeMergedContent(repaired.value);
    const normalizedChanged = JSON.stringify(normalized) !== JSON.stringify(repaired.value);

    return {
      content: normalized,
      repaired: repaired.changed || normalizedChanged,
    };
  }

  function createSubmission(payload) {
    const source = isObject(payload) ? payload : {};

    return {
      id:
        "lead-" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString(),
      name: String(source.name || "").trim(),
      phone: String(source.phone || "").trim(),
      service: String(source.service || "").trim(),
      message: String(source.message || "").trim(),
      status: normalizeSubmissionStatus(source.status),
    };
  }

  function prepareSubmission(payload) {
    const source = isObject(payload) ? payload : {};
    const normalized = createSubmission(source);

    if (source.id) {
      normalized.id = String(source.id).trim();
    }

    if (source.createdAt) {
      normalized.createdAt = String(source.createdAt);
    }

    return normalized;
  }

  function prepareSubmissionUpdate(payload) {
    const source = isObject(payload) ? payload : {};

    return {
      status: normalizeSubmissionStatus(source.status),
    };
  }

  function isRemoteMode() {
    if (!root || !root.location) {
      return false;
    }

    return false; // portfolio demo: no server
  }

  function isLocalHostRuntime() {
    if (!root || !root.location) {
      return false;
    }

    return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(root.location.hostname);
  }

  function shouldUseLocalFallback(error) {
    if (!isLocalHostRuntime()) {
      return false;
    }

    if (!error || error.status === undefined || error.status === null) {
      return true;
    }

    return error.status === 404 || error.status === 502 || error.status === 503;
  }

  function readLocalStorage(key) {
    try {
      return root.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function readJsonStorage(key) {
    const raw = readLocalStorage(key);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      removeLocalStorage(key);
      return null;
    }
  }

  function writeLocalStorage(key, value) {
    try {
      root.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeLocalStorage(key) {
    try {
      root.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readSessionStorage(key) {
    try {
      return root.sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeSessionStorage(key, value) {
    try {
      root.sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeSessionStorage(key) {
    try {
      root.sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readLocalSubmissions() {
    const raw = readLocalStorage(SUBMISSIONS_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        removeLocalStorage(SUBMISSIONS_KEY);
        return [];
      }

      return parsed.map(function (item) {
        return prepareSubmission(item);
      });
    } catch (error) {
      removeLocalStorage(SUBMISSIONS_KEY);
      return [];
    }
  }

  function writeLocalSubmissions(items) {
    return writeLocalStorage(SUBMISSIONS_KEY, JSON.stringify(items));
  }

  async function requestJson(url, options) {
    const response = await root.fetch(url, options);

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(text || "request_failed");
      error.status = response.status;

      if (text) {
        try {
          error.payload = JSON.parse(text);
        } catch (parseError) {
          error.payload = null;
        }
      } else {
        error.payload = null;
      }

      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  function getDefaultContent() {
    return prepareContent(DEFAULT_CONTENT);
  }

  async function getContent() {
    if (isRemoteMode()) {
      try {
        const payload = await requestJson("/api/content");
        return prepareContent(payload);
      } catch (error) {
        // Stricter server error checking - only use localStorage for real server errors
        if (!shouldUseLocalFallback(error)) {
          throw error;
        }
        // On server errors, try localStorage as fallback but not as primary source
      }
    }

    // Local development or fallback mode
    const parsed = readJsonStorage(STORAGE_KEY);

    if (!parsed) {
      return getDefaultContent();
    }

    return prepareContent(parsed);
  }

  async function saveContent(content) {
    const normalized = prepareContent(content);

    if (isRemoteMode()) {
      try {
        const payload = await requestJson("/api/content", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(normalized),
        });

        return prepareContent(payload);
      } catch (error) {
        if (!shouldUseLocalFallback(error)) {
          throw error;
        }
      }
    }

    if (!writeLocalStorage(STORAGE_KEY, JSON.stringify(normalized))) {
      throw new Error("local_storage_write_failed");
    }

    return normalized;
  }

  async function login(password) {
    if (isRemoteMode()) {
      try {
        await requestJson("/api/admin/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ password: String(password || "") }),
        });

        return true;
      } catch (error) {
        if (!ADMIN_PASSWORD_HASH) {
          throw error;
        }

        if (!shouldUseLocalFallback(error)) {
          if (error && error.status === 401) {
            return false;
          }

          throw error;
        }
      }
    }

    const isValid = await verifyPassword(password);

    if (isValid) {
      writeSessionStorage(SESSION_KEY, "active");
    }

    return isValid;
  }

  async function logout() {
    if (isRemoteMode()) {
      try {
        await requestJson("/api/admin/logout", {
          method: "POST",
          credentials: "same-origin",
        });
        return;
      } catch (error) {
        if (!shouldUseLocalFallback(error)) {
          throw error;
        }
      }
    }

    removeSessionStorage(SESSION_KEY);
  }

  async function hasSession() {
    if (isRemoteMode()) {
      try {
        const payload = await requestJson("/api/admin/session", {
          credentials: "same-origin",
        });

        return Boolean(payload && payload.authenticated);
      } catch (error) {
        if (!shouldUseLocalFallback(error)) {
          throw error;
        }
      }
    }

    return readSessionStorage(SESSION_KEY) === "active";
  }

  async function getSubmissions() {
    if (isRemoteMode()) {
      try {
        const payload = await requestJson("/api/submissions", {
          credentials: "same-origin",
        });

        return Array.isArray(payload)
          ? payload.map(function (item) {
              return prepareSubmission(item);
            })
          : [];
      } catch (error) {
        if (!shouldUseLocalFallback(error)) {
          throw error;
        }
      }
    }

    return readLocalSubmissions();
  }

  async function submitRequest(payload) {
    const normalized = createSubmission(payload);
    const honeypot = String(
      (isObject(payload) && (payload.website || payload.honeypot || payload.company || payload.url)) ||
        ""
    ).trim();

    if (!normalized.name || !normalized.phone) {
      throw new Error("missing_required_fields");
    }

    if (isRemoteMode()) {
      try {
        const outbound = honeypot ? Object.assign({}, normalized, { website: honeypot }) : normalized;

        return await requestJson("/api/submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify(outbound),
        });
      } catch (error) {
        if (!shouldUseLocalFallback(error)) {
          throw error;
        }
      }
    }

    const current = readLocalSubmissions();
    current.unshift(normalized);
    if (!writeLocalSubmissions(current)) {
      throw new Error("local_storage_write_failed");
    }

    return normalized;
  }

  async function updateSubmission(submissionId, payload) {
    const id = String(submissionId || "").trim();

    if (!id) {
      throw new Error("missing_submission_id");
    }

    const normalized = prepareSubmissionUpdate(payload);

    if (isRemoteMode()) {
      try {
        return prepareSubmission(
          await requestJson("/api/submissions/" + encodeURIComponent(id), {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify(normalized),
          })
        );
      } catch (error) {
        if (!shouldUseLocalFallback(error)) {
          throw error;
        }
      }
    }

    let updatedItem = null;
    const next = readLocalSubmissions().map(function (item) {
      if (item.id !== id) {
        return item;
      }

      updatedItem = prepareSubmission({
        id: item.id,
        createdAt: item.createdAt,
        name: item.name,
        phone: item.phone,
        service: item.service,
        message: item.message,
        status: normalized.status,
      });

      return updatedItem;
    });

    if (!writeLocalSubmissions(next)) {
      throw new Error("local_storage_write_failed");
    }

    return updatedItem;
  }

  async function deleteSubmission(submissionId) {
    const id = String(submissionId || "").trim();

    if (!id) {
      throw new Error("missing_submission_id");
    }

    if (isRemoteMode()) {
      try {
        await requestJson("/api/submissions/" + encodeURIComponent(id), {
          method: "DELETE",
          credentials: "same-origin",
        });
        return;
      } catch (error) {
        if (!shouldUseLocalFallback(error)) {
          throw error;
        }
      }
    }

    if (
      !writeLocalSubmissions(
        readLocalSubmissions().filter(function (item) {
          return item.id !== id;
        })
      )
    ) {
      throw new Error("local_storage_write_failed");
    }
  }

  async function sha256Hex(value) {
    if (!root.crypto || !root.crypto.subtle || !root.TextEncoder) {
      throw new Error("secure-hash-unavailable");
    }

    const buffer = await root.crypto.subtle.digest(
      "SHA-256",
      new root.TextEncoder().encode(value)
    );

    return Array.from(new Uint8Array(buffer))
      .map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");
  }

  async function verifyPassword(password) {
    if (!ADMIN_PASSWORD_HASH) {
      throw new Error("admin_password_unavailable");
    }

    const hash = await sha256Hex(String(password || ""));
    return hash === ADMIN_PASSWORD_HASH;
  }

  return {
    getDefaultContent: getDefaultContent,
    getContent: getContent,
    saveContent: saveContent,
    prepareContent: prepareContent,
    prepareContentWithRepair: prepareContentWithRepair,
    createSubmission: createSubmission,
    prepareSubmission: prepareSubmission,
    prepareSubmissionUpdate: prepareSubmissionUpdate,
    submitRequest: submitRequest,
    getSubmissions: getSubmissions,
    updateSubmission: updateSubmission,
    deleteSubmission: deleteSubmission,
    login: login,
    logout: logout,
    hasSession: hasSession,
    verifyPassword: verifyPassword,
    isRemoteMode: isRemoteMode,
    getThemeOptions: function (kind) {
      if (kind === "service") {
        const options =
          DEFAULT_CONTENT &&
          isObject(DEFAULT_CONTENT.themeOptions) &&
          Array.isArray(DEFAULT_CONTENT.themeOptions.service)
            ? DEFAULT_CONTENT.themeOptions.service
            : SERVICE_THEME_OPTIONS;

        return deepClone(options);
      }

      if (kind === "benefit") {
        return deepClone(BENEFIT_THEME_OPTIONS);
      }

      if (kind === "submission-status") {
        return deepClone(SUBMISSION_STATUS_OPTIONS);
      }

      return [];
    },
  };
});
