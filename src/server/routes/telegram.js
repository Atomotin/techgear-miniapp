function createTelegramRouteHandler({
  sendJson,
  readBody,
  telegramBotEnabled,
  telegramWebhookSecret,
  handleTelegramUpdate
}) {
  return async function handleTelegramRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== "/api/telegram/webhook") {
      return false;
    }

    if (telegramWebhookSecret) {
      const secret = req.headers["x-telegram-bot-api-secret-token"] || "";
      if (secret !== telegramWebhookSecret) {
        sendJson(res, 401, { error: "Invalid Telegram webhook secret" });
        return true;
      }
    }

    if (!telegramBotEnabled) {
      sendJson(res, 503, { error: "Telegram bot is not configured" });
      return true;
    }

    const update = await readBody(req);
    await handleTelegramUpdate(update);
    sendJson(res, 200, { ok: true });
    return true;
  };
}

module.exports = {
  createTelegramRouteHandler
};
