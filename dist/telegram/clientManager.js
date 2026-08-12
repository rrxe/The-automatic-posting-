import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions/index.js";
import { env } from "../config/env.js";
import { supabase } from "../db/supabase.js";
import { decrypt } from "../utils/crypto.js";
const clients = new Map();
async function getAccount(accountId) {
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
export async function getTelegramClient(accountId) {
    const cached = clients.get(accountId);
    if (cached) {
        try {
            if (cached.client.connected) {
                return cached.client;
            }
        }
        catch { }
    }
    const account = await getAccount(accountId);
    const session = decrypt(account.session_encrypted);
    const client = new TelegramClient(new StringSession(session), env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, {
        connectionRetries: 5,
        entityCache: {
            max: 5000,
            ttl: 30 * 60 * 1000
        }
    });
    await client.connect();
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
        clients.delete(accountId);
        throw new Error("TELEGRAM_SESSION_EXPIRED");
    }
    clients.set(accountId, {
        client,
        accountId,
        userId: account.user_id
    });
    return client;
}
export async function getUserTelegramAccounts(userId) {
    const { data, error } = await supabase
        .from("telegram_accounts")
        .select("id, telegram_user_id, phone_hint, display_name, username, is_active, last_connected_at, created_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", {
        ascending: false
    });
    if (error) {
        throw new Error(error.message);
    }
    return data ?? [];
}
export async function disconnectTelegramAccount(accountId) {
    const cached = clients.get(accountId);
    if (cached) {
        await cached.client.disconnect().catch(() => { });
        clients.delete(accountId);
    }
}
export async function removeTelegramAccount(accountId, userId) {
    await disconnectTelegramAccount(accountId);
    const { error } = await supabase
        .from("telegram_accounts")
        .update({
        is_active: false
    })
        .eq("id", accountId)
        .eq("user_id", userId);
    if (error) {
        throw new Error(error.message);
    }
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
        }
        catch (error) {
            console.error(`Failed to connect account ${account.id}:`, error);
        }
    }
}
