const fs = require("fs");
const path = require("path");

function createUploadService({
  normalizeString,
  uploadExtensions,
  readBinaryBody,
  createHttpError,
  imageUploadDir,
  supabaseEnabled,
  uploadBinaryToSupabaseStorage
}) {
  function sanitizeUploadName(fileName) {
    const parsed = path.parse(String(fileName || "").trim());
    const safeName = parsed.name
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "image";
    return safeName;
  }

  return async function saveAdminUpload(req, url) {
    const originalName = normalizeString(url.searchParams.get("filename"));
    const contentType = normalizeString(req.headers["content-type"]).split(";")[0];
    const extension = uploadExtensions.get(contentType);

    if (!extension) {
      throw createHttpError(400, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e JPG, PNG, WEBP \u0438 SVG");
    }

    const buffer = await readBinaryBody(req);
    if (!buffer.length) {
      throw createHttpError(400, "\u041f\u0443\u0441\u0442\u043e\u0439 \u0444\u0430\u0439\u043b");
    }

    const safeBaseName = sanitizeUploadName(originalName);
    const fileName = `${Date.now()}-${safeBaseName}${extension}`;

    if (supabaseEnabled) {
      return uploadBinaryToSupabaseStorage(fileName, buffer, contentType);
    }

    fs.mkdirSync(imageUploadDir, { recursive: true });
    const absolutePath = path.join(imageUploadDir, fileName);
    fs.writeFileSync(absolutePath, buffer);

    return {
      ok: true,
      path: `images.img/${fileName}`,
      fileName,
      storage: "local"
    };
  };
}

module.exports = {
  createUploadService
};
