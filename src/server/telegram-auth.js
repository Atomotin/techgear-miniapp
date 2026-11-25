const crypto = require("crypto");

const INIT_DATA_HEADER = "x-telegram-init-data";
const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60;

// Validates Telegram Mini App initData as described in
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Returns the verified Telegram user, or null if the data is missing, forged or expired.
function verifyTelegramInitData(initData, botToken, { maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS, now = Date.now() } = {}) {
  const raw = typeof initData === "string" ? initData.trim() : "";
  if (!raw || !botToken) return null;

  let params;
  try {
    params = new URLSearchParams(raw);
  } catch (error) {
    return null;
  }

  const receivedHash = params.get("hash") || "";
  if (!/^[0-9a-f]{64}$/i.test(receivedHash)) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest();
  const receivedBuffer = Buffer.from(receivedHash, "hex");

  if (receivedBuffer.length !== expectedHash.length || !crypto.timingSafeEqual(receivedBuffer, expectedHash)) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0) return null;

  const ageSeconds = now / 1000 - authDate;
  if (ageSeconds > maxAgeSeconds || ageSeconds < -300) return null;

  let user;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch (error) {
    return null;
  }

  const id = user && (typeof user.id === "number" || typeof user.id === "string") ? String(user.id).trim() : "";
  if (!/^\d{1,20}$/.test(id)) return null;

  return {
    id,
    username: typeof user.username === "string" ? user.username.slice(0, 64) : "",
    first_name: typeof user.first_name === "string" ? user.first_name.slice(0, 128) : "",
    last_name: typeof user.last_name === "string" ? user.last_name.slice(0, 128) : ""
  };
}

function createTelegramAuth({ botToken, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS } = {}) {
  return function getVerifiedTelegramUser(req) {
    const header = req?.headers?.[INIT_DATA_HEADER];
    const initData = Array.isArray(header) ? header[0] : header;
    return verifyTelegramInitData(initData, botToken, { maxAgeSeconds });
  };
}

module.exports = {
  INIT_DATA_HEADER,
  verifyTelegramInitData,
  createTelegramAuth
};
