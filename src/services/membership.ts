import type { Bot } from "grammy";
import { supabase } from "../db/supabase.js";

interface RequiredChannel {
  id: string;
  chat_id: number;
  username: string | null;
  title: string | null;
  invite_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export async function getRequiredChannels(): Promise<RequiredChannel[]> {
  const { data, error } = await supabase
    .from("mandatory_channels")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load mandatory channels: ${error.message}`);
  }

  return (data ?? []) as RequiredChannel[];
}

function isMemberStatus(member: any): boolean {
  if (!member) {
    return false;
  }

  if (member.status === "left" || member.status === "kicked") {
    return false;
  }

  if (member.status === "restricted") {
    return member.is_member === true;
  }

  return (
    member.status === "member" ||
    member.status === "administrator" ||
    member.status === "creator"
  );
}

export async function checkChannelMembership(
  bot: Bot,
  telegramId: number,
  channel: RequiredChannel
): Promise<boolean> {
  try {
    const member = await bot.api.getChatMember(
      channel.chat_id,
      telegramId
    );

    return isMemberStatus(member);
  } catch (error) {
    console.error(
      `Membership check failed for ${channel.chat_id}:`,
      error
    );

    return false;
  }
}

export async function checkAllRequiredChannels(
  bot: Bot,
  telegramId: number
) {
  const channels = await getRequiredChannels();

  const results = await Promise.all(
    channels.map(async (channel) => ({
      channel,
      joined: await checkChannelMembership(
        bot,
        telegramId,
        channel
      )
    }))
  );

  return {
    complete: results.every((item) => item.joined),
    results
  };
}
