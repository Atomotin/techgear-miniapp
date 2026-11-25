const crypto = require("crypto");

function isValidWebhookSecret(received, expected) {
  if (!expected || typeof received !== "string" || !received) return false;
  const left = crypto.createHash("sha256").update(received).digest();
  const right = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(left, right);
}

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

    if (!telegramBotEnabled) {
      sendJson(res, 503, { error: "Telegram bot is not configured" });
      return true;
    }

    // The secret is always set (generated at startup if not configured),
    // so the webhook is never open to forged updates.
    const header = req.headers["x-telegram-bot-api-secret-token"];
    const secret = Array.isArray(header) ? header[0] : header;
    if (!isValidWebhookSecret(secret, telegramWebhookSecret)) {
      sendJson(res, 401, { error: "Invalid Telegram webhook secret" });
      return true;
    }

    const update = await readBody(req, { maxSize: 256 * 1024 });

    // Always acknowledge the update. A non-2xx answer makes Telegram redeliver
    // the same update for hours (for example when the user blocked the bot).
    try {
      await handleTelegramUpdate(update);
    } catch (error) {
      console.error("Failed to handle Telegram update:", error?.message || error);
    }

    sendJson(res, 200, { ok: true });
    return true;
  };
}

module.exports = {
  createTelegramRouteHandler
};
