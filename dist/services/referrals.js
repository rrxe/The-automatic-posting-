import { supabase } from "../db/supabase.js";
import { getAppSettings } from "./settings.js";
const TIER_2_REFERRAL_COUNT = 15;
async function getConfirmedReferralCount(userId) {
    const { count, error } = await supabase
        .from("referrals")
        .select("id", {
        count: "exact",
        head: true
    })
        .eq("referrer_id", userId)
        .eq("status", "confirmed");
    if (error) {
        throw new Error(`Failed to count referrals: ${error.message}`);
    }
    return count ?? 0;
}
async function grantReferralVip(user, source, days) {
    const { data: existing, error: existingError } = await supabase
        .from("vip_grants")
        .select("id")
        .eq("user_id", user.id)
        .eq("source", source)
        .limit(1);
    if (existingError) {
        throw new Error(existingError.message);
    }
    if (existing && existing.length > 0) {
        return false;
    }
    const now = new Date();
    const currentExpiry = user.vip_expires_at
        ? new Date(user.vip_expires_at)
        : null;
    const startFrom = currentExpiry && currentExpiry > now
        ? currentExpiry
        : now;
    const expiresAt = new Date(startFrom.getTime());
    expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
    const { error: grantError } = await supabase
        .from("vip_grants")
        .insert({
        user_id: user.id,
        source,
        duration_days: days,
        starts_at: startFrom.toISOString(),
        expires_at: expiresAt.toISOString()
    });
    if (grantError) {
        throw new Error(grantError.message);
    }
    const { error: userError } = await supabase
        .from("users")
        .update({
        plan: "vip",
        vip_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
    })
        .eq("id", user.id);
    if (userError) {
        throw new Error(userError.message);
    }
    return true;
}
export async function confirmReferral(referredUser) {
    if (!referredUser.referred_by) {
        return 0;
    }
    const { error } = await supabase
        .from("referrals")
        .update({
        status: "confirmed"
    })
        .eq("referred_user_id", referredUser.id)
        .eq("status", "pending");
    if (error) {
        throw new Error(error.message);
    }
    return getConfirmedReferralCount(referredUser.referred_by);
}
export async function processReferralRewards(referrerUserId, referralCount) {
    const { data: referrer, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", referrerUserId)
        .single();
    if (error || !referrer) {
        return [];
    }
    const settings = await getAppSettings();
    const rewards = [];
    if (referralCount >= 7) {
        const days = settings.referral_7_vip_days;
        const granted = await grantReferralVip(referrer, "referral_7", days);
        if (granted) {
            rewards.push(days);
        }
    }
    if (referralCount >= TIER_2_REFERRAL_COUNT) {
        const days = settings.referral_20_vip_days;
        const granted = await grantReferralVip(referrer, "referral_20", days);
        if (granted) {
            rewards.push(days);
        }
    }
    return rewards;
}
export async function getReferralStats(userId) {
    const count = await getConfirmedReferralCount(userId);
    return {
        count,
        nextTarget: count < 7
            ? 7
            : count < TIER_2_REFERRAL_COUNT
                ? TIER_2_REFERRAL_COUNT
                : null
    };
}
