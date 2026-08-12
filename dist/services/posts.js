import { supabase } from "../db/supabase.js";
import { getAppSettings } from "./settings.js";
async function getUserPlan(userId) {
    const { data, error } = await supabase
        .from("users")
        .select("plan, vip_expires_at")
        .eq("id", userId)
        .single();
    if (error || !data) {
        throw new Error("USER_NOT_FOUND");
    }
    const vip = data.plan === "vip" &&
        !!data.vip_expires_at &&
        new Date(data.vip_expires_at) > new Date();
    return vip ? "vip" : "free";
}
export async function getDailyPublishCount(userId) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { count, error } = await supabase
        .from("publish_runs")
        .select("id", {
        count: "exact",
        head: true
    })
        .eq("user_id", userId)
        .gte("created_at", start.toISOString());
    if (error) {
        throw new Error(error.message);
    }
    return count ?? 0;
}
export async function createPost(userId, accountId, content, signatureEnabled = true) {
    const settings = await getAppSettings();
    const plan = await getUserPlan(userId);
    const limit = plan === "vip"
        ? settings.vip_message_limit
        : settings.free_message_limit;
    const cleanContent = content.trim();
    if (!cleanContent) {
        throw new Error("EMPTY_MESSAGE");
    }
    if (cleanContent.length > limit) {
        throw new Error(`MESSAGE_TOO_LONG:${limit}`);
    }
    const dailyLimit = plan === "vip"
        ? settings.vip_daily_runs
        : settings.free_daily_runs;
    const dailyCount = await getDailyPublishCount(userId);
    if (dailyCount >= dailyLimit) {
        throw new Error("DAILY_LIMIT_REACHED");
    }
    const { data, error } = await supabase
        .from("messages")
        .insert({
        user_id: userId,
        telegram_account_id: accountId,
        content: cleanContent,
        signature_enabled: signatureEnabled,
        status: "draft",
        send_mode: "manual"
    })
        .select("*")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return {
        message: data,
        plan,
        limit,
        dailyLimit,
        dailyUsed: dailyCount
    };
}
export async function getUserPosts(userId, accountId) {
    const { data, error } = await supabase
        .from("messages")
        .select(`
      id,
      content,
      signature_enabled,
      status,
      send_mode,
      created_at,
      scheduled_at
    `)
        .eq("user_id", userId)
        .eq("telegram_account_id", accountId)
        .order("created_at", {
        ascending: false
    })
        .limit(20);
    if (error) {
        throw new Error(error.message);
    }
    return data ?? [];
}
export function buildPreview(content, signature, _enabled = true) {
    const finalSignature = signature.trim() ||
        "بوت نشر تلقائي: @postrush_bot";
    return `${content.trim()}\n\n${finalSignature}`;
}
