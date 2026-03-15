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
      "Р”РѕР±СЂРѕ РїРѕР¶Р°Р»РѕРІР°С‚СЊ.",
      "",
      "TechGear вЂ” СЌС‚Рѕ РјР°РіР°Р·РёРЅ Р°РєСЃРµСЃСЃСѓР°СЂРѕРІ, С‚РѕРІР°СЂРѕРІ РґР»СЏ СЃРµС‚Р°РїР° Рё СЃС‚РёР»СЊРЅС‹С… РґРµС‚Р°Р»РµР№ РґР»СЏ СЂР°Р±РѕС‡РµРіРѕ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІР°.",
      "",
      "РћС‚РєСЂРѕР№ Mini App РЅРёР¶Рµ, С‡С‚РѕР±С‹ РїРѕСЃРјРѕС‚СЂРµС‚СЊ РєР°РґР°Р»РѕРі, РЅРѕРІРёРЅРєРё Рё РѕС„РѕСЂРјРёС‚СЊ Р·Р°РєР°Р· РІ РЅРµСЃРєРѕР»СЊРєРѕ РЅР°Р¶Р°С‚РёР№."
    ].join("\n");
  }

  function buildTelegramStartKeyboard() {
    const rows = [
      [{ text: "рџ›Ќ РћС‚РєСЂС‹С‚СЊ РјР°РіР°Р·РёРЅ", web_app: { url: `${publicBaseUrl}/` } }]
    ];

    const linksRow = [];
    if (telegramChannelUrl) {
      linksRow.push({ text: "рџ“ў РќР°С€ РєР°РЅР°Р»", url: telegramChannelUrl });
    }
    if (telegramManagerUrl) {
      linksRow.push({ text: "рџ’¬ РќР°РїРёСЃР°С‚СЊ РјРµРЅРµРґР¶РµСЂСѓ", url: telegramManagerUrl });
    }
    if (linksRow.length) {
      rows.push(linksRow);
    }

    rows.push([{ text: "рџ”Ґ РќРѕРІРёРЅРєРё Рё Р°РєСЃРµСЃСЃСѓР°СЂС‹", web_app: { url: `${publicBaseUrl}/` } }]);

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
          text: "рџ›Ќ РњР°РіР°Р·РёРЅ",
          web_app: {
            url: `${publicBaseUrl}/`
          }
        }
      });
      await telegramApi("setMyCommands", {
        commands: [
          { command: "start", description: "РћС‚РєСЂС‹С‚СЊ РїСЂРёРІРµС‚СЃС‚РІРёРµ Рё РјР°РіР°Р·РёРЅ" }
        ]
      });
      await telegramApi("setMyDescription", {
        description: "TechGear Store: РјР°РіР°Р·РёРЅ Р°РєСЃРµСЃСЃСѓР°СЂРѕРІ, С‚РѕРІР°СЂРѕРІ РґР»СЏ СЃРµС‚Р°РїР° Рё Mini App Р·Р°РєР°Р·РѕРІ."
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
