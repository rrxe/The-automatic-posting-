import { InlineKeyboard } from "grammy";
import { getUserByTelegramId } from "../services/users.js";
import { getAppSettings } from "../services/settings.js";
import { supabase } from "../db/supabase.js";
function isVip(user) {
    return (user?.plan === "vip" &&
        !!user.vip_expires_at &&
        new Date(user.vip_expires_at) > new Date());
}
async function loadManualGroups(userId, accountId) {
    const { data, error } = await supabase
        .from("user_groups")
        .select(`
      id,
      group_id,
      is_active,
      created_at,
      groups (
        id,
        telegram_chat_id,
        title,
        username
      )
    `)
        .eq("user_id", userId)
        .eq("telegram_account_id", accountId)
        .eq("source", "manual")
        .order("created_at", {
        ascending: true
    });
    if (error) {
        throw new Error(error.message);
    }
    return data ?? [];
}
function groupName(group) {
    return (group?.title ||
        group?.username ||
        "بدون اسم");
}
export async function showManualGroups(ctx, accountId) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const groups = await loadManualGroups(user.id, accountId);
    const settings = await getAppSettings();
    const limit = isVip(user)
        ? settings.vip_group_limit
        : settings.free_group_limit;
    const activeCount = groups.filter((row) => row.is_active).length;
    const keyboard = new InlineKeyboard();
    if (!groups.length) {
        await ctx.reply("📣 مجموعاتي\n\n" +
            "لا توجد مجموعات أو قنوات مضافة لهذا الحساب.\n\n" +
            "أضف مجموعة أو قناة من الزر التالي.", {
            reply_markup: keyboard
                .text("➕ إضافة مجموعة", `ac:${accountId}`)
                .row()
                .text("↩️ الحساب", `av:${accountId}`)
                .row()
                .text("🏠 الرئيسية", "dashboard")
        });
        return;
    }
    /*
     * زر لكل وجهة للتفعيل/الإيقاف.
     */
    groups.forEach((row, index) => {
        const group = row.groups;
        if (!group) {
            return;
        }
        keyboard
            .text(`${row.is_active ? "✅" : "⬜"} ${groupName(group)}`, `mg:${accountId}:${index}`)
            .row();
    });
    /*
     * زر فصل لكل وجهة.
     */
    groups.forEach((row, index) => {
        const group = row.groups;
        if (!group) {
            return;
        }
        const title = groupName(group);
        keyboard
            .text(`🗑 فصل ${title}`.slice(0, 60), `md:${accountId}:${index}`)
            .row();
    });
    keyboard
        .text("➕ إضافة مجموعة", `ac:${accountId}`)
        .row()
        .text("↩️ الحساب", `av:${accountId}`)
        .text("🏠 الرئيسية", "dashboard");
    await ctx.reply("📣 مجموعاتي\n\n" +
        "هذه القائمة تعرض فقط الوجهات التي أضفتها أنت.\n\n" +
        `✅ المحددة للنشر: ${activeCount} / ${limit}\n` +
        `📋 إجمالي المضافة: ${groups.length}\n\n` +
        "✅ = مفعلة للنشر\n" +
        "⬜ = غير مفعلة", {
        reply_markup: keyboard
    });
}
export async function toggleManualGroup(ctx, accountId, index) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const groups = await loadManualGroups(user.id, accountId);
    const row = groups[index];
    if (!row) {
        await ctx.answerCallbackQuery({
            text: "❌ الوجهة غير موجودة.",
            show_alert: true
        });
        return;
    }
    if (!row.is_active) {
        const settings = await getAppSettings();
        const limit = isVip(user)
            ? settings.vip_group_limit
            : settings.free_group_limit;
        const activeCount = groups.filter((item) => item.is_active).length;
        if (activeCount >=
            limit) {
            await ctx.answerCallbackQuery({
                text: `⚠️ الحد المسموح في باقتك هو ${limit}.`,
                show_alert: true
            });
            return;
        }
    }
    const next = !row.is_active;
    const { error } = await supabase
        .from("user_groups")
        .update({
        is_active: next
    })
        .eq("id", row.id)
        .eq("user_id", user.id)
        .eq("telegram_account_id", accountId)
        .eq("source", "manual");
    if (error) {
        await ctx.answerCallbackQuery({
            text: "❌ تعذر تحديث الحالة.",
            show_alert: true
        });
        return;
    }
    await ctx.answerCallbackQuery({
        text: next
            ? "✅ تم تفعيل الوجهة."
            : "⬜ تم إيقاف الوجهة."
    });
    await showManualGroups(ctx, accountId);
}
export async function detachManualGroup(ctx, accountId, index) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const groups = await loadManualGroups(user.id, accountId);
    const row = groups[index];
    if (!row) {
        await ctx.answerCallbackQuery({
            text: "❌ الوجهة غير موجودة.",
            show_alert: true
        });
        return;
    }
    const groupNameText = groupName(row.groups);
    const { error } = await supabase
        .from("user_groups")
        .delete()
        .eq("id", row.id)
        .eq("user_id", user.id)
        .eq("telegram_account_id", accountId)
        .eq("source", "manual");
    if (error) {
        await ctx.answerCallbackQuery({
            text: "❌ تعذر فصل الوجهة.",
            show_alert: true
        });
        return;
    }
    await ctx.answerCallbackQuery({
        text: "✅ تم فصل الوجهة."
    });
    await ctx.reply(`🗑 تم فصل «${groupNameText}» من البوت.\n\n` +
        "لم يتم حذفها من Telegram.", {
        reply_markup: new InlineKeyboard()
            .text("📣 مجموعاتي", `ag:${accountId}`)
            .row()
            .text("🏠 الرئيسية", "dashboard")
    });
    await showManualGroups(ctx, accountId);
}
