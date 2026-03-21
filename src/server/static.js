const fs = require("fs");
const path = require("path");

function createStaticHandler({ rootDir, publicDir, mimeTypes, sendText }) {
  const publicRoot = path.resolve(publicDir);
  const allowedRootAssets = [
    { prefix: "/images.img/", dir: path.resolve(rootDir, "images.img") },
    { prefix: "/songs/", dir: path.resolve(rootDir, "songs") }
  ];

  function resolveInsideBase(baseDir, requestedPath) {
    const safeRelativePath = requestedPath.replace(/^[/\\]+/, "");
    const absolutePath = path.resolve(baseDir, safeRelativePath);
    const baseWithSep = `${baseDir}${path.sep}`;

    if (absolutePath === baseDir || absolutePath.startsWith(baseWithSep)) {
      return absolutePath;
    }

    return "";
  }

  function resolveFilePath(urlPathname) {
    const decodedPath = decodeURIComponent(urlPathname === "/" ? "/index.html" : urlPathname);
    const requestedPath = decodedPath === "/admin" ? "/admin.html" : decodedPath;
    const publicPath = resolveInsideBase(publicRoot, requestedPath);

    if (publicPath && fs.existsSync(publicPath)) {
      return publicPath;
    }

    for (const asset of allowedRootAssets) {
      if (!requestedPath.startsWith(asset.prefix)) {
        continue;
      }

      const relativePath = requestedPath.slice(asset.prefix.length);
      const absolutePath = resolveInsideBase(asset.dir, relativePath);

      if (absolutePath && fs.existsSync(absolutePath)) {
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
