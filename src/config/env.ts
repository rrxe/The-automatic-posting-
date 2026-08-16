import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value : fallback;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  BOT_TOKEN: required("BOT_TOKEN"),
  PORT: optionalNumber("PORT", 3000),
  OWNER_TELEGRAM_ID: optionalNumber("OWNER_TELEGRAM_ID", 0),

  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),

  SESSION_ENCRYPTION_KEY: required("SESSION_ENCRYPTION_KEY"),

  TELEGRAM_API_ID: optionalNumber("TELEGRAM_API_ID", 0),
  TELEGRAM_API_HASH: optional("TELEGRAM_API_HASH", ""),

  TELEGRAM_LOGIN_CLIENT_ID: optional("TELEGRAM_LOGIN_CLIENT_ID", ""),
  TELEGRAM_LOGIN_CLIENT_SECRET: optional("TELEGRAM_LOGIN_CLIENT_SECRET", ""),

  WEB_URL: optional("WEB_URL", ""),

  MAX_PUBLISH_CONCURRENCY: optionalNumber("MAX_PUBLISH_CONCURRENCY", 3),

  TELEGRAM_CLIENT_IDLE_TIMEOUT_MINUTES: optionalNumber("TELEGRAM_CLIENT_IDLE_TIMEOUT_MINUTES", 20),
  TELEGRAM_ENTITY_CACHE_MAX: optionalNumber("TELEGRAM_ENTITY_CACHE_MAX", 300),
  TELEGRAM_ENTITY_CACHE_TTL_MINUTES: optionalNumber("TELEGRAM_ENTITY_CACHE_TTL_MINUTES", 15),

  // محاكاة الجهاز – اختيارية
  TELEGRAM_DEVICE_MODEL: optional("TELEGRAM_DEVICE_MODEL", "Web"),
  TELEGRAM_SYSTEM_VERSION: optional("TELEGRAM_SYSTEM_VERSION", "Linux"),
  TELEGRAM_APP_VERSION: optional("TELEGRAM_APP_VERSION", "2.1.5"),
  TELEGRAM_LANG_CODE: optional("TELEGRAM_LANG_CODE", "en"),
  TELEGRAM_SYSTEM_LANG_CODE: optional("TELEGRAM_SYSTEM_LANG_CODE", "en-US"),

  // بروكسي – اختياري
  TELEGRAM_PROXY_HOST: optional("TELEGRAM_PROXY_HOST", ""),
  TELEGRAM_PROXY_PORT: optional("TELEGRAM_PROXY_PORT", ""),
  TELEGRAM_PROXY_USERNAME: optional("TELEGRAM_PROXY_USERNAME", ""),
  TELEGRAM_PROXY_PASSWORD: optional("TELEGRAM_PROXY_PASSWORD", "")
};
