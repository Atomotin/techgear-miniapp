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

  // Check the real file contents, not only the Content-Type the client sent.
  function matchesFileSignature(buffer, contentType) {
    const startsWith = (bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);

    if (contentType === "image/jpeg") return startsWith([0xff, 0xd8, 0xff]);
    if (contentType === "image/png") return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (contentType === "image/webp") {
      return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8);
    }
    if (contentType.startsWith("audio/")) {
      // ID3 tag or an MPEG audio frame sync.
      return startsWith([0x49, 0x44, 0x33]) || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    }
    return false;
  }

  return async function saveAdminUpload(req, url) {
    const originalName = normalizeString(url.searchParams.get("filename"));
    const contentType = normalizeString(req.headers["content-type"]).split(";")[0];
    const extension = uploadExtensions.get(contentType);

    if (!extension) {
      throw createHttpError(400, "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f JPG, PNG, WEBP \u0438 MP3");
    }

    const maxSize = contentType.startsWith("audio/") ? 1024 * 1024 * 25 : undefined;
    const buffer = await readBinaryBody(req, maxSize);
    if (!buffer.length) {
      throw createHttpError(400, "\u041f\u0443\u0441\u0442\u043e\u0439 \u0444\u0430\u0439\u043b");
    }

    if (!matchesFileSignature(buffer, contentType)) {
      throw createHttpError(400, "Содержимое файла не совпадает с его типом. Загрузите настоящий JPG, PNG, WEBP или MP3.");
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
      // No silent fallback to local disk: such files vanish on the next
      // deploy while products keep pointing at them. Let the admin retry.
      try {
        return await uploadBinaryToSupabaseStorage(fileName, buffer, contentType);
      } catch (error) {
        console.error("Supabase upload failed:", error.message);
        throw createHttpError(502, "Не удалось загрузить файл в Supabase Storage. Попробуйте ещё раз.");
      }
    }

    return saveLocally();
  };
}

module.exports = {
  createUploadService
};
