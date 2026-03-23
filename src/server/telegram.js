function createTelegramService({
  normalizeString,
  telegramApiBase,
  publicBaseUrl,
  telegramBotEnabled,
  telegramBotName,
  telegramChannelUrl,
  telegramManagerUrl,
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

  function getOrderChatId(order = {}) {
    return normalizeString(order?.telegram?.id || order?.customer?.telegramId);
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
        { text: "\uD83D\uDECD Открыть магазин", web_app: { url: `${publicBaseUrl}/` } }
      ]);
    }

    const linksRow = [];
    if (telegramManagerUrl) {
      linksRow.push({ text: "\uD83D\uDCAC Менеджер", url: telegramManagerUrl });
    }
    if (telegramChannelUrl) {
      linksRow.push({ text: "\uD83D\uDCE2 Канал", url: telegramChannelUrl });
    }

    if (linksRow.length) {
      rows.push(linksRow);
    }

    return rows.length ? { inline_keyboard: rows } : null;
  }

  function buildTelegramStartMessage() {
    return [
      `<b>${telegramBotName}</b>`,
      "",
      "\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c.",
      "",
      "TechGear \u2014 \u044d\u0442\u043e \u043c\u0430\u0433\u0430\u0437\u0438\u043d \u0430\u043a\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u043e\u0432, \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u0434\u043b\u044f \u0441\u0435\u0442\u0430\u043f\u0430 \u0438 \u0441\u0442\u0438\u043b\u044c\u043d\u044b\u0445 \u0434\u0435\u0442\u0430\u043b\u0435\u0439 \u0434\u043b\u044f \u0440\u0430\u0431\u043e\u0447\u0435\u0433\u043e \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0430.",
      "",
      "\u041e\u0442\u043a\u0440\u043e\u0439 Mini App \u043d\u0438\u0436\u0435, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u043a\u0430\u0442\u0430\u043b\u043e\u0433, \u043d\u043e\u0432\u0438\u043d\u043a\u0438 \u0438 \u043e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437 \u0432 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043d\u0430\u0436\u0430\u0442\u0438\u0439."
    ].join("\n");
  }

  function buildTelegramStartKeyboard() {
    const rows = [
      [{ text: "\uD83D\uDECD \u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0430\u0433\u0430\u0437\u0438\u043d", web_app: { url: `${publicBaseUrl}/` } }]
    ];

    const linksRow = [];
    if (telegramChannelUrl) {
      linksRow.push({ text: "\uD83D\uDCE2 \u041d\u0430\u0448 \u043a\u0430\u043d\u0430\u043b", url: telegramChannelUrl });
    }
    if (telegramManagerUrl) {
      linksRow.push({ text: "\uD83D\uDCAC \u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440\u0443", url: telegramManagerUrl });
    }
    if (linksRow.length) {
      rows.push(linksRow);
    }

    rows.push([{ text: "\uD83D\uDD25 \u041d\u043e\u0432\u0438\u043d\u043a\u0438 \u0438 \u0430\u043a\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u044b", web_app: { url: `${publicBaseUrl}/` } }]);

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

  async function notifyOrderCreated(order) {
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
          text: "\uD83D\uDECD \u041c\u0430\u0433\u0430\u0437\u0438\u043d",
          web_app: {
            url: `${publicBaseUrl}/`
          }
        }
      });
      await telegramApi("setMyCommands", {
        commands: [
          { command: "start", description: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0438\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435 \u0438 \u043c\u0430\u0433\u0430\u0437\u0438\u043d" }
        ]
      });
      await telegramApi("setMyDescription", {
        description: "TechGear Store: \u043c\u0430\u0433\u0430\u0437\u0438\u043d \u0430\u043a\u0441\u0435\u0441\u0441\u0443\u0430\u0440\u043e\u0432, \u0442\u043e\u0432\u0430\u0440\u043e\u0432 \u0434\u043b\u044f \u0441\u0435\u0442\u0430\u043f\u0430 \u0438 Mini App \u0437\u0430\u043a\u0430\u0437\u043e\u0432."
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
