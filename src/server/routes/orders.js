function createOrdersRouteHandler({
  storage,
  sendJson,
  readBody,
  validateOrderPayload
}) {
  return async function handleOrdersRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== "/api/orders") {
      return false;
    }

    const body = await readBody(req);
    const error = validateOrderPayload(body);

    if (error) {
      sendJson(res, 400, { error });
      return true;
    }

    const order = await storage.createOrder(body, req);
    sendJson(res, 201, { ok: true, orderId: order.id });
    return true;
  };
}

module.exports = {
  createOrdersRouteHandler
};
