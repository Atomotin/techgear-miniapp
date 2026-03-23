function createTelegramService({
  normalizeString,
  telegramApiBase,
  publicBaseUrl,
  telegramBotEnabled,
  telegramBotName,
  telegramChannelUrl,
  telegramManagerUrl,
  telegramManagerChatIds = [],
  telegramLogoUrl
}) {
  const ORDER_STATUS_LABELS = {
    new: "Новый",
    processing: "В работе",
    done: "Готов",
    cancelled: "Отменён"
  };

  const ORDER_STATUS_DETAILS = {
    new: "Заказ зарегистрирован. Мы проверим детали и свяжемся с вами.",
    processing: "Мы уже обрабатываем заказ и готовим детали по доставке.",
    done: "Заказ готов. Скоро свяжемся с вами для передачи или доставки.",
    cancelled: "Заказ отменён. Если это произошло по ошибке, напишите менеджеру."
  };

  const CONTACT_METHOD_LABELS = {
    telegram: "Telegram",
    phone: "Телефон"
  };

  const DELIVERY_TIME_LABELS = {
    asap: "Как можно скорее",
    today: "Сегодня",
    tomorrow: "Завтра"
  };

  const managerRecipients = [...new Set(
    (Array.isArray(telegramManagerChatIds) ? telegramManagerChatIds : [])
      .map((chatId) => String(chatId || "").trim())
      .filter(Boolean)
  )];

  async function telegramApi(method, payload) {
    if (!telegramBotEnabled) {
      throw new Error("Telegram bot is not configured");
    }

    const response = await fetch(`${telegramApiBase}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.description || `Telegram API request failed: ${method}`);
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
    const amount = Number(value) || 0;
    if (!amount) return "";
    return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function normalizeTelegramUsername(value) {
    return normalizeString(value).replace(/^@/, "");
  }

  function parseOrderCoordinates(location) {
    const match = String(location || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;

    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    return { lat, lon };
  }

  function buildOrderMapLink(location) {
    const coords = parseOrderCoordinates(location);
    if (!coords) return "";
    return `https://yandex.uz/maps/?pt=${encodeURIComponent(coords.lon)},${encodeURIComponent(coords.lat)}&z=16&l=map`;
  }

  function formatContactMethod(value) {
    const normalized = normalizeString(value).toLowerCase();
    return CONTACT_METHOD_LABELS[normalized] || normalized || "";
  }

  function formatDeliveryTime(value) {
    const normalized = normalizeString(value).toLowerCase();
    return DELIVERY_TIME_LABELS[normalized] || normalized || "";
  }

  function getOrderChatId(order = {}) {
    return normalizeString(order?.telegram?.id || order?.customer?.telegramId);
  }

  function getOrderCustomerUsername(order = {}) {
    const username = normalizeTelegramUsername(order?.customer?.username || order?.telegram?.username);
    return username ? `@${username}` : "";
  }

  function getOrderItems(order = {}) {
    return Array.isArray(order?.items) ? order.items : [];
  }

  function getOrderItemsCount(order = {}) {
    return getOrderItems(order).reduce((sum, item) => sum + (Number(item?.qty) || 0), 0);
  }

  function buildOrderItemLines(order = {}) {
    const items = getOrderItems(order);
    const lines = items.slice(0, 12).map((item) => {
      const itemName = escapeHtml(item?.name || "Товар");
      const qty = Number(item?.qty) || 0;
      const variant = normalizeString(item?.variant);
      const itemTotal = formatPrice((Number(item?.price) || 0) * qty);
      return `- ${itemName} x${qty}${variant ? ` (${escapeHtml(variant)})` : ""}${itemTotal ? ` - ${escapeHtml(itemTotal)}` : ""}`;
    });

    if (items.length > lines.length) {
      lines.push(`- И еще ${items.length - lines.length} поз.`);
    }

    return lines;
  }

  function buildTelegramSupportKeyboard() {
    const rows = [];

    if (publicBaseUrl) {
      rows.push([
        { text: "🛍 Открыть магазин", web_app: { url: `${publicBaseUrl}/` } }
      ]);
    }

    const linksRow = [];
    if (telegramManagerUrl) {
      linksRow.push({ text: "💬 Менеджер", url: telegramManagerUrl });
    }
    if (telegramChannelUrl) {
      linksRow.push({ text: "📢 Канал", url: telegramChannelUrl });
    }

    if (linksRow.length) {
      rows.push(linksRow);
    }

    return rows.length ? { inline_keyboard: rows } : null;
  }

  function buildManagerOrderKeyboard(order = {}) {
    const rows = [];
    const customerUsername = normalizeTelegramUsername(getOrderCustomerUsername(order));
    const mapLink = buildOrderMapLink(order?.customer?.location);

    const actionRow = [];
    if (customerUsername) {
      actionRow.push({ text: "👤 Клиент", url: `https://t.me/${customerUsername}` });
    }
    if (mapLink) {
      actionRow.push({ text: "🗺️ Карта", url: mapLink });
    }
    if (actionRow.length) {
      rows.push(actionRow);
    }

    if (publicBaseUrl) {
      rows.push([
        { text: "⚙️ Админка", url: `${publicBaseUrl}/admin` }
      ]);
    }

    return rows.length ? { inline_keyboard: rows } : null;
  }

  function buildTelegramStartMessage() {
    return [
      `<b>${telegramBotName}</b>`,
      "",
      "Добро пожаловать.",
      "",
      "TechGear — это магазин аксессуаров, товаров для сетапа и стильных деталей для рабочего пространства.",
      "",
      "Открой Mini App ниже, чтобы посмотреть каталог, новинки и оформить заказ в несколько нажатий."
    ].join("\n");
  }

  function buildTelegramStartKeyboard() {
    const rows = [
      [{ text: "🛍 Открыть магазин", web_app: { url: `${publicBaseUrl}/` } }]
    ];

    const linksRow = [];
    if (telegramChannelUrl) {
      linksRow.push({ text: "📢 Наш канал", url: telegramChannelUrl });
    }
    if (telegramManagerUrl) {
      linksRow.push({ text: "💬 Написать менеджеру", url: telegramManagerUrl });
    }
    if (linksRow.length) {
      rows.push(linksRow);
    }

    rows.push([{ text: "🔥 Новинки и аксессуары", web_app: { url: `${publicBaseUrl}/` } }]);

    return { inline_keyboard: rows };
  }

  async function handleTelegramUpdate(update) {
    const message = update?.message;
    if (!message?.chat?.id) return;

    const text = normalizeString(message.text);
    if (text !== "/start") return;

    const payload = {
      chat_id: message.chat.id,
      parse_mode: "HTML",
      reply_markup: buildTelegramStartKeyboard()
    };

    if (telegramLogoUrl) {
      await telegramApi("sendPhoto", {
        ...payload,
        photo: telegramLogoUrl,
        caption: buildTelegramStartMessage()
      });
      return;
    }

    await telegramApi("sendMessage", {
      ...payload,
      text: buildTelegramStartMessage()
    });
  }

  async function notifyCustomerOrderCreated(order) {
    if (!telegramBotEnabled) {
      return { sent: false, skipped: true, reason: "bot_not_configured" };
    }

    const chatId = getOrderChatId(order);
    if (!chatId) {
      return { sent: false, skipped: true, reason: "missing_chat_id" };
    }

    const customerName = normalizeString(order?.customer?.name) || "клиент";
    const totalLabel = formatPrice(order?.total);
    const createdAtLabel = formatDateTime(order?.createdAt);
    const itemsCount = getOrderItemsCount(order);
    const itemLines = buildOrderItemLines(order);
    const replyMarkup = buildTelegramSupportKeyboard();
    const messageLines = [
      `<b>${escapeHtml(telegramBotName)}</b>`,
      "",
      `Здравствуйте, <b>${escapeHtml(customerName)}</b>.`,
      `Ваш заказ <b>#${escapeHtml(order?.id)}</b> оформлен и принят в обработку.`,
      "",
      `Статус: <b>${escapeHtml(ORDER_STATUS_LABELS.new)}</b>`,
      createdAtLabel ? `Время оформления: ${escapeHtml(createdAtLabel)}` : "",
      itemsCount > 0 ? `Количество товаров: ${itemsCount}` : "",
      totalLabel ? `Сумма: ${escapeHtml(totalLabel)}` : ""
    ];

    if (itemLines.length) {
      messageLines.push("", "Состав заказа:", ...itemLines);
    }

    messageLines.push("", "Мы скоро свяжемся с вами для подтверждения деталей.");

    await telegramApi("sendMessage", {
      chat_id: chatId,
      parse_mode: "HTML",
      text: messageLines.filter(Boolean).join("\n"),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    });

    return {
      sent: true,
      skipped: false,
      orderId: order?.id,
      chatId
    };
  }

  async function notifyManagerOrderCreated(order) {
    if (!telegramBotEnabled) {
      return { sent: false, skipped: true, reason: "bot_not_configured" };
    }

    if (!managerRecipients.length) {
      return { sent: false, skipped: true, reason: "missing_manager_chat_id" };
    }

    const customerName = normalizeString(order?.customer?.name) || "Клиент";
    const customerPhone = normalizeString(order?.customer?.phone) || "";
    const customerUsername = getOrderCustomerUsername(order);
    const customerTelegramId = normalizeString(order?.telegram?.id || order?.customer?.telegramId);
    const contactMethod = formatContactMethod(order?.customer?.contactMethod);
    const deliveryTime = formatDeliveryTime(order?.customer?.deliveryTime);
    const delivery = normalizeString(order?.customer?.delivery);
    const comment = normalizeString(order?.customer?.comment);
    const location = normalizeString(order?.customer?.location);
    const mapLink = buildOrderMapLink(location);
    const totalLabel = formatPrice(order?.total);
    const createdAtLabel = formatDateTime(order?.createdAt);
    const itemsCount = getOrderItemsCount(order);
    const itemLines = buildOrderItemLines(order);
    const replyMarkup = buildManagerOrderKeyboard(order);
    const messageLines = [
      `<b>${escapeHtml(telegramBotName)}</b>`,
      "",
      `Новый заказ <b>#${escapeHtml(order?.id)}</b>`,
      createdAtLabel ? `Время: ${escapeHtml(createdAtLabel)}` : "",
      `Статус: <b>${escapeHtml(ORDER_STATUS_LABELS.new)}</b>`,
      "",
      `Клиент: <b>${escapeHtml(customerName)}</b>`,
      customerPhone ? `Телефон: ${escapeHtml(customerPhone)}` : "",
      customerUsername ? `Telegram: ${escapeHtml(customerUsername)}` : "",
      customerTelegramId ? `Telegram ID: ${escapeHtml(customerTelegramId)}` : "",
      contactMethod ? `Связь: ${escapeHtml(contactMethod)}` : "",
      deliveryTime ? `Когда удобно: ${escapeHtml(deliveryTime)}` : "",
      delivery ? `Адрес: ${escapeHtml(delivery)}` : "",
      comment ? `Комментарий: ${escapeHtml(comment)}` : "",
      location ? `Локация: ${escapeHtml(location)}` : "",
      mapLink ? `Карта: ${escapeHtml(mapLink)}` : "",
      itemsCount > 0 ? `Количество товаров: ${itemsCount}` : "",
      totalLabel ? `Сумма: ${escapeHtml(totalLabel)}` : ""
    ];

    if (itemLines.length) {
      messageLines.push("", "Состав заказа:", ...itemLines);
    }

    const recipients = [];
    for (const chatId of managerRecipients) {
      try {
        await telegramApi("sendMessage", {
          chat_id: chatId,
          parse_mode: "HTML",
          text: messageLines.filter(Boolean).join("\n"),
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {})
        });
        recipients.push({
          chatId,
          sent: true,
          skipped: false
        });
      } catch (error) {
        recipients.push({
          chatId,
          sent: false,
          skipped: false,
          error: error?.message || "notification_failed"
        });
      }
    }

    return {
      sent: recipients.some((entry) => entry.sent),
      skipped: recipients.every((entry) => entry.skipped),
      recipients,
      deliveredTo: recipients.filter((entry) => entry.sent).map((entry) => entry.chatId)
    };
  }

  function buildNotificationSummary(results = {}) {
    const entries = Object.values(results).filter(Boolean);
    const reasons = [...new Set(entries.map((entry) => normalizeString(entry?.reason)).filter(Boolean))];
    const errors = [...new Set(entries.map((entry) => normalizeString(entry?.error)).filter(Boolean))];
    const sent = entries.some((entry) => entry.sent);
    const skipped = entries.length > 0 ? entries.every((entry) => entry.skipped) : true;
    const partial = entries.some((entry) => entry.sent) && entries.some((entry) => !entry.sent);
    const summary = {
      sent,
      skipped,
      partial,
      ...results
    };

    if (!sent && reasons.length === 1) {
      summary.reason = reasons[0];
    }

    if (!sent && errors.length === 1) {
      summary.error = errors[0];
    } else if (!sent && errors.length > 1) {
      summary.error = errors.join("; ");
    }

    return summary;
  }

  async function runNotificationTask(task) {
    try {
      return await task();
    } catch (error) {
      return {
        sent: false,
        skipped: false,
        error: error?.message || "notification_failed"
      };
    }
  }

  async function notifyOrderCreated(order) {
    const customer = await runNotificationTask(() => notifyCustomerOrderCreated(order));
    const manager = await runNotificationTask(() => notifyManagerOrderCreated(order));
    return buildNotificationSummary({ customer, manager });
  }

  async function notifyOrderStatusUpdate(order, { previousStatus = "" } = {}) {
    if (!telegramBotEnabled) {
      return { sent: false, skipped: true, reason: "bot_not_configured" };
    }

    const chatId = getOrderChatId(order);
    if (!chatId) {
      return { sent: false, skipped: true, reason: "missing_chat_id" };
    }

    const nextStatus = normalizeString(order?.status).toLowerCase();
    const statusLabel = ORDER_STATUS_LABELS[nextStatus] || nextStatus || "Обновлён";
    const previousStatusLabel = ORDER_STATUS_LABELS[normalizeString(previousStatus).toLowerCase()] || "";
    const customerName = normalizeString(order?.customer?.name) || "клиент";
    const itemsCount = getOrderItemsCount(order);
    const totalLabel = formatPrice(order?.total);
    const messageLines = [
      `<b>${escapeHtml(telegramBotName)}</b>`,
      "",
      `Здравствуйте, <b>${escapeHtml(customerName)}</b>.`,
      `Статус заказа <b>#${escapeHtml(order?.id)}</b> обновлён.`,
      "",
      `Новый статус: <b>${escapeHtml(statusLabel)}</b>`
    ];

    if (previousStatusLabel && previousStatusLabel !== statusLabel) {
      messageLines.push(`Было: ${escapeHtml(previousStatusLabel)}`);
    }

    if (itemsCount > 0) {
      messageLines.push(`Товаров: ${itemsCount}`);
    }

    if (totalLabel) {
      messageLines.push(`Сумма: ${escapeHtml(totalLabel)}`);
    }

    messageLines.push("", escapeHtml(ORDER_STATUS_DETAILS[nextStatus] || "Мы обновили информацию по вашему заказу."));

    const replyMarkup = buildTelegramSupportKeyboard();
    await telegramApi("sendMessage", {
      chat_id: chatId,
      parse_mode: "HTML",
      text: messageLines.join("\n"),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    });

    return {
      sent: true,
      skipped: false,
      status: nextStatus,
      chatId
    };
  }

  async function configureTelegramBot({ telegramWebhookSecret }) {
    if (!telegramBotEnabled) {
      return;
    }

    const webhookUrl = `${publicBaseUrl}/api/telegram/webhook`;
    const webhookData = {
      url: webhookUrl,
      allowed_updates: ["message"]
    };

    if (telegramWebhookSecret) {
      webhookData.secret_token = telegramWebhookSecret;
    }

    try {
      await telegramApi("setWebhook", webhookData);
      await telegramApi("setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "🛍 Магазин",
          web_app: {
            url: `${publicBaseUrl}/`
          }
        }
      });
      await telegramApi("setMyCommands", {
        commands: [
          { command: "start", description: "Открыть приветствие и магазин" }
        ]
      });
      await telegramApi("setMyDescription", {
        description: "TechGear Store: магазин аксессуаров, товаров для сетапа и Mini App заказов."
      });
    } catch (error) {
      console.error("Failed to configure Telegram bot:", error);
    }
  }

  return {
    telegramApi,
    buildTelegramStartMessage,
    buildTelegramStartKeyboard,
    handleTelegramUpdate,
    notifyOrderCreated,
    notifyOrderStatusUpdate,
    configureTelegramBot
  };
}

module.exports = {
  createTelegramService
};
