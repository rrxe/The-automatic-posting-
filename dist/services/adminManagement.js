import { supabase } from "../db/supabase.js";
import { env } from "../config/env.js";
export async function findUser(input) {
    const value = input.trim();
    const telegramId = Number(value);
    if (Number.isSafeInteger(telegramId) &&
        telegramId > 0) {
        const { data } = await supabase
            .from("users")
            .select("*")
            .eq("telegram_id", telegramId)
            .maybeSingle();
        return data;
    }
    const username = value.replace(/^@/, "");
    const { data } = await supabase
        .from("users")
        .select("*")
        .ilike("username", username)
        .maybeSingle();
    return data;
}
export async function grantVip(actorTelegramId, targetTelegramId, days) {
    if (!Number.isInteger(days) ||
        days <= 0 ||
        days > 3650) {
        throw new Error("INVALID_VIP_DAYS");
    }
    const { data: target, error } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", targetTelegramId)
        .single();
    if (error ||
        !target) {
        throw new Error("USER_NOT_FOUND");
    }
    const start = target.vip_expires_at &&
        new Date(target.vip_expires_at) > new Date()
        ? new Date(target.vip_expires_at)
        : new Date();
    const expires = new Date(start.getTime() +
        days *
            24 *
            60 *
            60 *
            1000);
    const { error: updateError } = await supabase
        .from("users")
        .update({
        plan: "vip",
        vip_expires_at: expires.toISOString()
    })
        .eq("id", target.id);
    if (updateError) {
        throw new Error(updateError.message);
    }
    await supabase
        .from("vip_grants")
        .insert({
        user_id: target.id,
        source: "admin",
        duration_days: days,
        starts_at: start.toISOString(),
        expires_at: expires.toISOString(),
        granted_by: null
    });
    await supabase
        .from("audit_logs")
        .insert({
        actor_user_id: null,
        action: "grant_vip",
        target_user_id: target.id,
        metadata: {
            actorTelegramId,
            days
        }
    });
    return expires;
}
export async function revokeVip(actorTelegramId, targetTelegramId) {
    const { data: target, error } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", targetTelegramId)
        .single();
    if (error ||
        !target) {
        throw new Error("USER_NOT_FOUND");
    }
    await supabase
        .from("users")
        .update({
        plan: "free",
        vip_expires_at: null
    })
        .eq("id", target.id);
    await supabase
        .from("audit_logs")
        .insert({
        actor_user_id: null,
        action: "revoke_vip",
        target_user_id: target.id,
        metadata: {
            actorTelegramId
        }
    });
}
export async function addAdmin(targetTelegramId) {
    if (targetTelegramId ===
        env.OWNER_TELEGRAM_ID) {
        return;
    }
    const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", targetTelegramId)
        .single();
    if (!user) {
        throw new Error("USER_NOT_FOUND");
    }
    const { error } = await supabase
        .from("admin_users")
        .upsert({
        user_id: user.id,
        role: "admin"
    }, {
        onConflict: "user_id"
    });
    if (error) {
        throw new Error(error.message);
    }
}
export async function removeAdmin(targetTelegramId) {
    if (targetTelegramId ===
        env.OWNER_TELEGRAM_ID) {
        throw new Error("CANNOT_REMOVE_OWNER");
    }
    const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", targetTelegramId)
        .single();
    if (!user) {
        throw new Error("USER_NOT_FOUND");
    }
    await supabase
        .from("admin_users")
        .delete()
        .eq("user_id", user.id);
}
export async function getAdmins() {
    const { data, error } = await supabase
        .from("admin_users")
        .select(`
      role,
      users (
        telegram_id,
        username,
        first_name
      )
    `)
        .order("created_at", {
        ascending: true
    });
    if (error) {
        throw new Error(error.message);
    }
    return data ?? [];
}
export async function getStats() {
    const [users, vip, accounts, groups, runs] = await Promise.all([
        supabase
            .from("users")
            .select("id", {
            count: "exact",
            head: true
        }),
        supabase
            .from("users")
            .select("id", {
            count: "exact",
            head: true
        })
            .eq("plan", "vip"),
        supabase
            .from("telegram_accounts")
            .select("id", {
            count: "exact",
            head: true
        })
            .eq("is_active", true),
        supabase
            .from("user_groups")
            .select("id", {
            count: "exact",
            head: true
        })
            .eq("source", "manual"),
        supabase
            .from("publish_runs")
            .select("id", {
            count: "exact",
            head: true
        })
    ]);
    return {
        users: users.count ?? 0,
        vip: vip.count ?? 0,
        accounts: accounts.count ?? 0,
        groups: groups.count ?? 0,
        runs: runs.count ?? 0
    };
}
