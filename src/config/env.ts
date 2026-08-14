import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name: string, defaultValue: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) return defaultValue;
  return value.trim();
}

function optionalNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value || !value.trim()) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export const env = {
  // Required
  BOT_TOKEN: required("BOT_TOKEN"),
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  OWNER_TELEGRAM_ID: Number(required("OWNER_TELEGRAM_ID")),
  TELEGRAM_API_ID: Number(required("TELEGRAM_API_ID")),
  TELEGRAM_API_HASH: required("TELEGRAM_API_HASH"),
  SESSION_ENCRYPTION_KEY: required("SESSION_ENCRYPTION_KEY"),

  // Optional with defaults
  PORT: optionalNumber("PORT", 3000),
  MAX_PUBLISH_CONCURRENCY: optionalNumber("MAX_PUBLISH_CONCURRENCY", 2),
  TELEGRAM_CLIENT_IDLE_TIMEOUT_MINUTES: optionalNumber("TELEGRAM_CLIENT_IDLE_TIMEOUT_MINUTES", 15),
  TELEGRAM_ENTITY_CACHE_MAX: optionalNumber("TELEGRAM_ENTITY_CACHE_MAX", 300),
  TELEGRAM_ENTITY_CACHE_TTL_MINUTES: optionalNumber("TELEGRAM_ENTITY_CACHE_TTL_MINUTES", 15),

  // محاكاة الجهاز – اختيارية
  TELEGRAM_DEVICE_MODEL: optional("TELEGRAM_DEVICE_MODEL", "iPhone 14 Pro"),
  TELEGRAM_SYSTEM_VERSION: optional("TELEGRAM_SYSTEM_VERSION", "iOS 16.5"),
  TELEGRAM_APP_VERSION: optional("TELEGRAM_APP_VERSION", "10.10.0"),
  TELEGRAM_LANG_CODE: optional("TELEGRAM_LANG_CODE", "en"),
  TELEGRAM_SYSTEM_LANG_CODE: optional("TELEGRAM_SYSTEM_LANG_CODE", "en-US"),

  // بروكسي – اختياري
  TELEGRAM_PROXY_HOST: optional("TELEGRAM_PROXY_HOST", ""),
  TELEGRAM_PROXY_PORT: optional("TELEGRAM_PROXY_PORT", ""),
  TELEGRAM_PROXY_USERNAME: optional("TELEGRAM_PROXY_USERNAME", ""),
  TELEGRAM_PROXY_PASSWORD: optional("TELEGRAM_PROXY_PASSWORD", ""),
};
