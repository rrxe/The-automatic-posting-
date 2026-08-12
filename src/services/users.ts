import { supabase } from "../db/supabase.js";
import type { AppUser } from "../types/user.js";
import { env } from "../config/env.js";

export async function getUserByTelegramId(
  telegramId: number
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data as AppUser | null;
}

export async function getOrCreateUser(data: {
  telegramId: number;
  username?: string;
  firstName?: string;
}): Promise<AppUser> {
  const existing = await getUserByTelegramId(data.telegramId);

  if (existing) {
    const { data: updated, error } = await supabase
      .from("users")
      .update({
        username: data.username ?? existing.username,
        first_name: data.firstName ?? existing.first_name,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return updated as AppUser;
  }

  const { data: created, error } = await supabase
    .from("users")
    .insert({
      telegram_id: data.telegramId,
      username: data.username ?? null,
      first_name: data.firstName ?? null,
      language: "ar"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return created as AppUser;
}

export async function ensureOwnerAdmin(
  telegramId: number
): Promise<void> {
  /*
   * فقط OWNER_TELEGRAM_ID يمكن أن يكون Owner.
   * أي مستخدم آخر يتم تجاهله بالكامل.
   */
  if (
    telegramId !==
    env.OWNER_TELEGRAM_ID
  ) {
    return;
  }

  const user =
    await getUserByTelegramId(
      telegramId
    );

  if (!user) {
    return;
  }

  const {
    error
  } = await supabase
    .from("admin_users")
    .upsert(
      {
        user_id:
          user.id,
        role:
          "owner"
      },
      {
        onConflict:
          "user_id"
      }
    );

  if (error) {
    throw new Error(
      `Failed to ensure owner admin: ${error.message}`
    );
  }
}

export async function attachReferral(
  referredUser: AppUser,
  referrerTelegramId: number
): Promise<boolean> {
  if (referrerTelegramId === referredUser.telegram_id) {
    return false;
  }

  if (referredUser.referred_by) {
    return false;
  }

  const referrer = await getUserByTelegramId(referrerTelegramId);

  if (!referrer) {
    return false;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      referred_by: referrer.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", referredUser.id)
    .is("referred_by", null);

  if (updateError) {
    throw new Error(`Failed to attach referral: ${updateError.message}`);
  }

  const { error: referralError } = await supabase
    .from("referrals")
    .upsert(
      {
        referrer_id: referrer.id,
        referred_user_id: referredUser.id,
        status: "pending"
      },
      {
        onConflict: "referred_user_id"
      }
    );

  if (referralError) {
    console.error("Referral record error:", referralError.message);
  }

  return true;
}
