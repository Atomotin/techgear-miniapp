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
    configureTelegramBot
  };
}

module.exports = {
  createTelegramService
};
