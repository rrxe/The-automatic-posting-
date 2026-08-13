import "dotenv/config";
function required(name) {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value.trim();
}
export const env = {
    BOT_TOKEN: required("BOT_TOKEN"),
    SUPABASE_URL: required("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
    OWNER_TELEGRAM_ID: Number(required("OWNER_TELEGRAM_ID")),
    PORT: Number(process.env.PORT || 3000),
    TELEGRAM_API_ID: Number(process.env.TELEGRAM_API_ID || 0),
    TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH || "",
    SESSION_ENCRYPTION_KEY: process.env.SESSION_ENCRYPTION_KEY || "",
    MAX_PUBLISH_CONCURRENCY: Number(process.env.MAX_PUBLISH_CONCURRENCY || 2),
    TELEGRAM_CLIENT_IDLE_TIMEOUT_MINUTES: Number(process.env.TELEGRAM_CLIENT_IDLE_TIMEOUT_MINUTES || 15),
    TELEGRAM_ENTITY_CACHE_MAX: Number(process.env.TELEGRAM_ENTITY_CACHE_MAX || 300),
    TELEGRAM_ENTITY_CACHE_TTL_MINUTES: Number(process.env.TELEGRAM_ENTITY_CACHE_TTL_MINUTES || 15)
};
