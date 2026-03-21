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
  sanitizeLongText,
  sanitizeCustomerProfile,
  validateCustomerProfile,
  validateOrderPayload,
  adminPassword,
  adminAuthEnabled,
  createToken,
  ensureAdmin,
  saveAdminUpload,
  supabaseEnabled,
  requirePersistentAdminStorage,
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
      requirePersistentAdminStorage,
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
      sanitizeLongText,
      adminPassword,
      adminAuthEnabled,
      createToken,
      ensureAdmin,
      saveAdminUpload,
      requirePersistentAdminStorage,
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
