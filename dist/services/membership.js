import { supabase } from "../db/supabase.js";
export async function getRequiredChannels() {
    const { data, error } = await supabase
        .from("mandatory_channels")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
    if (error) {
        throw new Error(`Failed to load mandatory channels: ${error.message}`);
    }
    return (data ?? []);
}
function isMemberStatus(member) {
    if (!member) {
        return false;
    }
    if (member.status === "left" || member.status === "kicked") {
        return false;
    }
    if (member.status === "restricted") {
        return member.is_member === true;
    }
    return (member.status === "member" ||
        member.status === "administrator" ||
        member.status === "creator");
}
export async function checkChannelMembership(bot, telegramId, channel) {
    try {
        const member = await bot.api.getChatMember(channel.chat_id, telegramId);
        return isMemberStatus(member);
    }
    catch (error) {
        console.error(`Membership check failed for ${channel.chat_id}:`, error);
        return false;
    }
}
export async function checkAllRequiredChannels(bot, telegramId) {
    const channels = await getRequiredChannels();
    const results = await Promise.all(channels.map(async (channel) => ({
        channel,
        joined: await checkChannelMembership(bot, telegramId, channel)
    })));
    return {
        complete: results.every((item) => item.joined),
        results
    };
}
