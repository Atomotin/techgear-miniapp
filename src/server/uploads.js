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
      throw createHttpError(400, "РџРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ JPG, PNG, WEBP Рё SVG");
    }

    const buffer = await readBinaryBody(req);
    if (!buffer.length) {
      throw createHttpError(400, "РџСѓСЃС‚РѕР№ С„Р°Р№Р»");
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
