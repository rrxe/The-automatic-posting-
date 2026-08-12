import { supabase } from "../db/supabase.js";
import { bot } from "../bot/index.js";

export async function setAdminAction(
  telegramId: number,
  action: string
) {
  const { error } = await supabase
    .from("admin_sessions")
    .upsert({
      telegram_id: telegramId,
      action,
      expires_at: new Date(
        Date.now() + 10 * 60 * 1000
      ).toISOString()
    });

  if (error) {
    throw new Error(`Failed to set admin action: ${error.message}`);
  }
}

export async function getAdminAction(
  telegramId: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("action, expires_at")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get admin action: ${error.message}`);
  }

  if (!data) return null;

  if (new Date(data.expires_at) <= new Date()) {
    await clearAdminAction(telegramId);
    return null;
  }

  return data.action;
}

export async function clearAdminAction(
  telegramId: number
) {
  await supabase
    .from("admin_sessions")
    .delete()
    .eq("telegram_id", telegramId);
}

export async function getMandatoryChannels() {
  const { data, error } = await supabase
    .from("mandatory_channels")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", {
      ascending: true
    });

  if (error) {
    throw new Error(`Failed to load channels: ${error.message}`);
  }

  return data ?? [];
}

export async function addMandatoryChannel(
  input: string
) {
  const clean = input.trim();

  if (!clean) {
    throw new Error("EMPTY_CHANNEL");
  }

  let chatIdOrUsername: string | number = clean;

  if (/^@/.test(clean)) {
    chatIdOrUsername = clean;
  } else if (/^-?\d+$/.test(clean)) {
    chatIdOrUsername = Number(clean);
  } else {
    chatIdOrUsername = `@${clean}`;
  }

  let chat;

  try {
    chat = await bot.api.getChat(chatIdOrUsername);
  } catch {
    throw new Error("CHANNEL_NOT_FOUND");
  }

  if (chat.type !== "channel") {
    throw new Error("NOT_CHANNEL");
  }

  let me;

  try {
    me = await bot.api.getMe();
  } catch {
    throw new Error("BOT_INFO_FAILED");
  }

  let botMember;

  try {
    botMember = await bot.api.getChatMember(
      chat.id,
      me.id
    );
  } catch {
    throw new Error("BOT_NOT_IN_CHANNEL");
  }

  if (
    botMember.status !== "administrator" &&
    botMember.status !== "creator"
  ) {
    throw new Error("BOT_NOT_ADMIN");
  }

  const inviteUrl = chat.username
    ? `https://t.me/${chat.username}`
    : null;

  const { data, error } = await supabase
    .from("mandatory_channels")
    .insert({
      chat_id: chat.id,
      username: chat.username
        ? `@${chat.username}`
        : null,
      title: chat.title,
      invite_url: inviteUrl,
      is_active: true
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("CHANNEL_EXISTS");
    }

    throw new Error(
      `Failed to save channel: ${error.message}`
    );
  }

  return data;
}

export async function deleteMandatoryChannel(
  id: string
) {
  const { error } = await supabase
    .from("mandatory_channels")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(
      `Failed to delete channel: ${error.message}`
    );
  }
}
