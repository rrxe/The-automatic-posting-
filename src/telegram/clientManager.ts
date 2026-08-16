import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions/index.js";
import { SocksProxyAgent } from "socks-proxy-agent";

import { env } from "../config/env.js";
import { supabase } from "../db/supabase.js";
import { decrypt } from "../utils/crypto.js";

interface CachedClient {
  client: TelegramClient;
  accountId: string;
  userId: string;
  lastUsedAt: number;
}

const clients = new Map<string, CachedClient>();

const IDLE_TIMEOUT_MS =
  Math.max(1, env.TELEGRAM_CLIENT_IDLE_TIMEOUT_MINUTES) * 60 * 1000;
const SWEEP_INTERVAL_MS = 2 * 60 * 1000;

function createTelegramClient(session: string = "") {
  const options: any = {
    connectionRetries: 5,
    deviceModel: env.TELEGRAM_DEVICE_MODEL || "Web",
    systemVersion: env.TELEGRAM_SYSTEM_VERSION || "Linux",
    appVersion: env.TELEGRAM_APP_VERSION || "2.1.5",
    langCode: env.TELEGRAM_LANG_CODE || "en",
    systemLangCode: env.TELEGRAM_SYSTEM_LANG_CODE || "en-US",
    entityCache: {
      max: env.TELEGRAM_ENTITY_CACHE_MAX || 100,
      ttl: (env.TELEGRAM_ENTITY_CACHE_TTL_MINUTES || 60) * 60 * 1000
    }
  };

  const proxyHost = env.TELEGRAM_PROXY_HOST?.trim();
  const proxyPort = env.TELEGRAM_PROXY_PORT?.trim();
  if (proxyHost && proxyPort) {
    const username = env.TELEGRAM_PROXY_USERNAME?.trim() || "";
    const password = env.TELEGRAM_PROXY_PASSWORD?.trim() || "";
    const auth = username || password ? `${username}:${password}@` : "";
    const proxyUrl = `socks5://${auth}${proxyHost}:${proxyPort}`;
    try {
      options.proxy = new SocksProxyAgent(proxyUrl);
      console.log("Telegram client using proxy");
    } catch (err) {
      console.warn("Invalid proxy config, skipping:", err);
    }
  }

  return new TelegramClient(
    new StringSession(session),
    env.TELEGRAM_API_ID,
    env.TELEGRAM_API_HASH,
    options
  );
}

async function getAccount(accountId: string) {
  const { data, error } = await supabase
    .from("telegram_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error("TELEGRAM_ACCOUNT_NOT_FOUND");
  }
  return data;
}

export async function getTelegramClient(accountId: string): Promise<TelegramClient> {
  const cached = clients.get(accountId);
  if (cached) {
    try {
      if (cached.client.connected) {
        cached.lastUsedAt = Date.now();
        return cached.client;
      }
    } catch {}
  }

  const account = await getAccount(accountId);
  const session = decrypt(account.session_encrypted);
  const client = createTelegramClient(session);

  await client.connect();
  const authorized = await client.isUserAuthorized();

  if (!authorized) {
    clients.delete(accountId);
    throw new Error("TELEGRAM_SESSION_EXPIRED");
  }

  clients.set(accountId, {
    client,
    accountId,
    userId: account.user_id,
    lastUsedAt: Date.now()
  });

  return client;
}

export function touchTelegramClient(accountId: string) {
  const cached = clients.get(accountId);
  if (cached) {
    cached.lastUsedAt = Date.now();
  }
}

async function disconnectIdleClients() {
  const now = Date.now();
  for (const [accountId, cached] of clients) {
    if (now - cached.lastUsedAt > IDLE_TIMEOUT_MS) {
      try {
        await cached.client.disconnect();
      } catch (error) {
        console.error(`IDLE DISCONNECT ERROR (${accountId}):`, error);
      }
      clients.delete(accountId);
      console.log(`Idle Telegram client disconnected: ${accountId}`);
    }
  }
}

let sweeperStarted = false;
export function startIdleClientSweeper() {
  if (sweeperStarted) return;
  sweeperStarted = true;
  setInterval(() => {
    disconnectIdleClients().catch((error) => {
      console.error("IDLE SWEEP ERROR:", error);
    });
  }, SWEEP_INTERVAL_MS);
}

export function getActiveTelegramClientCount() {
  return clients.size;
}

export async function getUserTelegramAccounts(userId: string) {
  const { data, error } = await supabase
    .from("telegram_accounts")
    .select("id, telegram_user_id, phone_hint, display_name, username, is_active, last_connected_at, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function disconnectTelegramAccount(accountId: string) {
  const cached = clients.get(accountId);
  if (cached) {
    await cached.client.disconnect().catch(() => {});
    clients.delete(accountId);
  }
}

export async function removeTelegramAccount(accountId: string, userId: string) {
  await disconnectTelegramAccount(accountId);
  const { error } = await supabase
    .from("telegram_accounts")
    .update({ is_active: false })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function warmTelegramAccounts() {
  const { data, error } = await supabase
    .from("telegram_accounts")
    .select("id")
    .eq("is_active", true);

  if (error) {
    console.error("ACCOUNT WARMUP ERROR:", error.message);
    return;
  }

  for (const account of data ?? []) {
    try {
      await getTelegramClient(account.id);
    } catch (error) {
      console.error(`Failed to connect account ${account.id}:`, error);
    }
  }
}
