const { createTelegramRouteHandler } = require("./routes/telegram");
const { createPublicRouteHandler } = require("./routes/public");
const { createOrdersRouteHandler } = require("./routes/orders");
const { createProfileRouteHandler } = require("./routes/profile");
const { createAdminRouteHandler } = require("./routes/admin");

function createApiHandler({
  storage,
  sendJson,
  readBody,
  normalizeString,
  sanitizeCustomerProfile,
  validateCustomerProfile,
  validateOrderPayload,
  adminPassword,
  createToken,
  ensureAdmin,
  saveAdminUpload,
  supabaseEnabled,
  telegramBotEnabled,
  telegramWebhookSecret,
  handleTelegramUpdate,
  notifyOrderStatusUpdate
}) {
  const routeHandlers = [
    createTelegramRouteHandler({
      sendJson,
      readBody,
      telegramBotEnabled,
      telegramWebhookSecret,
      handleTelegramUpdate
    }),
    createPublicRouteHandler({
      storage,
      sendJson,
      supabaseEnabled,
      telegramBotEnabled
    }),
    createOrdersRouteHandler({
      storage,
      sendJson,
      readBody,
      validateOrderPayload
    }),
    createProfileRouteHandler({
      storage,
      sendJson,
      readBody,
      normalizeString,
      sanitizeCustomerProfile,
      validateCustomerProfile
    }),
    createAdminRouteHandler({
      storage,
      sendJson,
      readBody,
      normalizeString,
      adminPassword,
      createToken,
      ensureAdmin,
      saveAdminUpload,
      notifyOrderStatusUpdate
    })
  ];

  return async function handleApi(req, res, url) {
    for (const routeHandler of routeHandlers) {
      const handled = await routeHandler(req, res, url);
      if (handled) {
        return true;
      }
    }

    return false;
  };
}

module.exports = {
  createApiHandler
};
