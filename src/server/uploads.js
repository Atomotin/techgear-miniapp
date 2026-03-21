const fs = require("fs");
const path = require("path");

function createUploadService({
  normalizeString,
  uploadExtensions,
  readBinaryBody,
  createHttpError,
  imageUploadDir,
  supabaseEnabled,
  requirePersistentStorage,
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
      throw createHttpError(400, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f JPG, PNG, WEBP, SVG \u0438 MP3");
    }

    const maxSize = contentType.startsWith("audio/") ? 1024 * 1024 * 25 : undefined;
    const buffer = await readBinaryBody(req, maxSize);
    if (!buffer.length) {
      throw createHttpError(400, "\u041f\u0443\u0441\u0442\u043e\u0439 \u0444\u0430\u0439\u043b");
    }

    const safeBaseName = sanitizeUploadName(originalName);
    const fileName = `${Date.now()}-${safeBaseName}${extension}`;

    function saveLocally(storageLabel = "local") {
      if (requirePersistentStorage) {
        throw createHttpError(
          503,
          "Локальная загрузка отключена: настройте постоянное хранилище для картинок и проверьте /api/health"
        );
      }

      fs.mkdirSync(imageUploadDir, { recursive: true });
      const absolutePath = path.join(imageUploadDir, fileName);
      fs.writeFileSync(absolutePath, buffer);

      return {
        ok: true,
        path: `images.img/${fileName}`,
        fileName,
        storage: storageLabel,
        persistent: false,
        warning: "Файл сохранён локально на сервере и может исчезнуть после нового деплоя"
      };
    }

    if (supabaseEnabled) {
      try {
        return await uploadBinaryToSupabaseStorage(fileName, buffer, contentType);
      } catch (error) {
        console.warn("Supabase upload failed, fallback to local storage:", error.message);
        return saveLocally("local-fallback");
      }
    }

    return saveLocally();
  };
}

module.exports = {
  createUploadService
};
