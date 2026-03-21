function createHttpHelpers({ createHttpError }) {
  function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "geolocation=(self)"
    });
    res.end(JSON.stringify(payload));
  }

  function sendText(res, statusCode, payload) {
    res.writeHead(statusCode, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "geolocation=(self)"
    });
    res.end(payload);
  }

  function readBinaryBody(req, maxSize = 1024 * 1024 * 8) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let total = 0;

      req.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxSize) {
          reject(createHttpError(413, "\u0424\u0430\u0439\u043b \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0431\u043e\u043b\u044c\u0448\u043e\u0439"));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let raw = "";
      let total = 0;
      let settled = false;

      function fail(error) {
        if (settled) return;
        settled = true;
        reject(error);
      }

      function succeed(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }

      req.on("data", (chunk) => {
        total += chunk.length;
        if (settled) return;

        if (total > 1024 * 1024 * 2) {
          fail(createHttpError(413, "Payload too large"));
          req.destroy();
          return;
        }

        raw += chunk;
      });

      req.on("end", () => {
        if (settled) return;

        if (!raw) {
          succeed({});
          return;
        }

        try {
          succeed(JSON.parse(raw));
        } catch (error) {
          fail(createHttpError(400, "Invalid JSON"));
        }
      });

      req.on("error", (error) => {
        fail(error);
      });
    });
  }

  return {
    sendJson,
    sendText,
    readBinaryBody,
    readBody
  };
}

module.exports = {
  createHttpHelpers
};
