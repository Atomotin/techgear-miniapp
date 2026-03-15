const fs = require("fs");
const path = require("path");

function createStaticHandler({ rootDir, publicDir, mimeTypes, sendText }) {
  function resolveFilePath(urlPathname) {
    const decodedPath = decodeURIComponent(urlPathname === "/" ? "/index.html" : urlPathname);
    const requestedPath = decodedPath === "/admin" ? "/admin.html" : decodedPath;
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const candidateRoots = [publicDir, rootDir];

    for (const baseDir of candidateRoots) {
      const absolutePath = path.join(baseDir, safePath);

      if (!absolutePath.startsWith(baseDir)) {
        continue;
      }

      if (fs.existsSync(absolutePath)) {
        return absolutePath;
      }
    }

    return "";
  }

  function serveStatic(res, url) {
    const filePath = resolveFilePath(url.pathname);

    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      sendText(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN"
    });
    fs.createReadStream(filePath).pipe(res);
  }

  return {
    resolveFilePath,
    serveStatic
  };
}

module.exports = {
  createStaticHandler
};
