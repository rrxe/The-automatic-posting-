import { InlineKeyboard } from "grammy";
import { isAdmin, isOwner } from "../services/admin.js";
import { getAppSettings, updateAppSetting } from "../services/settings.js";
import { setAdminAction, getAdminAction, clearAdminAction } from "../services/adminChannels.js";
import { findUser, grantVip, revokeVip, addAdmin, removeAdmin, getAdmins, getStats } from "../services/adminManagement.js";
import { getPublishQueueStats } from "../services/publishQueue.js";
import { getActiveTelegramClientCount } from "../telegram/clientManager.js";
function adminSettingsKeyboard() {
    return new InlineKeyboard()
        .text("📣 Free المجموعات", "set_fg")
        .text("📣 VIP المجموعات", "set_vg")
        .row()
        .text("📱 Free الحسابات", "set_fa")
        .text("📱 VIP الحسابات", "set_va")
        .row()
        .text("📝 Free الحروف", "set_fm")
        .text("📝 VIP الحروف", "set_vm")
        .row()
        .text("▶️ Free التشغيلات", "set_fd")
        .text("▶️ VIP التشغيلات", "set_vd")
        .row()
        .text("🔄 Free الدورات", "set_fc")
        .text("🔄 VIP الدورات", "set_vc")
        .row()
        .text("⏱ Free انتظار الدورة", "set_fcd")
        .text("⏱ VIP انتظار الدورة", "set_vcd")
        .row()
        .text("🐢 تأخير الرسائل", "set_md")
        .row()
        .text("🎁 إحالات 7", "set_r7")
        .text("🎁 إحالات 20", "set_r20")
        .row()
        .text("💰 سعر VIP", "set_price")
        .row()
        .text("↩️ لوحة الإدارة", "admin_panel");
}
async function sendAdminSettings(ctx) {
    const settings = await getAppSettings();
    await ctx.reply("⚙️ إعدادات النظام\n\n" +
        "🆓 Free\n" +
        `📣 المجموعات: ${settings.free_group_limit}\n` +
        `📱 الحسابات: ${settings.free_account_limit}\n` +
        `📝 الحروف: ${settings.free_message_limit}\n` +
        `▶️ التشغيلات اليومية: ${settings.free_daily_runs}\n` +
        `🔄 الدورات لكل تشغيل: ${settings.free_cycle_limit}\n` +
        `⏱ الانتظار بين الدورات: ${settings.free_cycle_delay_minutes} دقيقة\n\n` +
        "⭐ VIP\n" +
        `📣 المجموعات: ${settings.vip_group_limit}\n` +
        `📱 الحسابات: ${settings.vip_account_limit}\n` +
        `📝 الحروف: ${settings.vip_message_limit}\n` +
        `▶️ التشغيلات اليومية: ${settings.vip_daily_runs}\n` +
        `🔄 الدورات لكل تشغيل: ${settings.vip_cycle_limit}\n` +
        `⏱ الانتظار بين الدورات: ${settings.vip_cycle_delay_minutes} دقيقة\n\n` +
        `🐢 التأخير بين الرسائل: ${settings.message_delay_minutes} دقيقة\n\n` +
        "🎁 الإحالات\n" +
        `7 إحالات → ${settings.referral_7_vip_days} أيام VIP\n` +
        `15 إحالة → ${settings.referral_20_vip_days} أيام VIP\n\n` +
        `💰 سعر VIP: ${settings.vip_price_usdt} USDT`, {
        reply_markup: adminSettingsKeyboard()
    });
}
export async function handleAdminExtraCallback(ctx) {
    if (!ctx.from) {
        return false;
    }
    const action = ctx.callbackQuery?.data;
    if (!action) {
        return false;
    }
    if (!(await isAdmin(ctx.from.id))) {
        return false;
    }
    /*
     * =========================
     * VIP
     * =========================
     */
    if (action === "admin_vip") {
        await ctx.answerCallbackQuery();
        await ctx.reply("⭐ إدارة VIP\n\n" +
            "اختر العملية:", {
            reply_markup: new InlineKeyboard()
                .text("➕ منح VIP", "vip_grant")
                .text("➖ سحب VIP", "vip_revoke")
                .row()
                .text("🔎 بحث عن مستخدم", "vip_search")
                .row()
                .text("↩️ لوحة الإدارة", "admin_panel")
        });
        return true;
    }
    if (action === "vip_grant") {
        await setAdminAction(ctx.from.id, "vip_grant");
        await ctx.answerCallbackQuery();
        await ctx.reply("➕ منح VIP\n\n" +
            "أرسل Telegram ID وعدد الأيام.\n\n" +
            "مثال:\n" +
            "123456789 30");
        return true;
    }
    if (action === "vip_revoke") {
        await setAdminAction(ctx.from.id, "vip_revoke");
        await ctx.answerCallbackQuery();
        await ctx.reply("➖ سحب VIP\n\n" +
            "أرسل Telegram ID.");
        return true;
    }
    if (action === "vip_search") {
        await setAdminAction(ctx.from.id, "vip_search");
        await ctx.answerCallbackQuery();
        await ctx.reply("🔎 بحث عن مستخدم\n\n" +
            "أرسل Telegram ID أو @username.");
        return true;
    }
    /*
     * =========================
     * USERS
     * =========================
     */
    if (action === "admin_users") {
        await setAdminAction(ctx.from.id, "admin_user_search");
        await ctx.answerCallbackQuery();
        await ctx.reply("👥 إدارة المستخدمين\n\n" +
            "أرسل Telegram ID أو @username.");
        return true;
    }
    /*
     * =========================
     * ADMINS
     * =========================
     */
    if (action === "admin_admins") {
        if (!(await isOwner(ctx.from.id))) {
            await ctx.answerCallbackQuery({
                text: "⛔ هذا القسم للـOwner فقط.",
                show_alert: true
            });
            return true;
        }
        const admins = await getAdmins();
        let text = "🛡 إدارة المشرفين\n\n";
        if (!admins.length) {
            text +=
                "لا يوجد مشرفون مسجلون.\n";
        }
        for (const row of admins) {
            const user = row.users;
            const name = user?.username
                ? `@${user.username}`
                : user?.first_name ||
                    String(user?.telegram_id ||
                        "مستخدم");
            text +=
                `${row.role === "owner" ? "👑 Owner" : "🛡 Admin"} ${name}\n`;
        }
        await ctx.answerCallbackQuery();
        await ctx.reply(text +
            "\nاختر العملية:", {
            reply_markup: new InlineKeyboard()
                .text("➕ إضافة مشرف", "admin_add")
                .text("➖ إزالة مشرف", "admin_remove")
                .row()
                .text("↩️ لوحة الإدارة", "admin_panel")
        });
        return true;
    }
    if (action === "admin_add") {
        if (!(await isOwner(ctx.from.id))) {
            await ctx.answerCallbackQuery({
                text: "⛔ Owner فقط.",
                show_alert: true
            });
            return true;
        }
        await setAdminAction(ctx.from.id, "admin_add");
        await ctx.answerCallbackQuery();
        await ctx.reply("➕ إضافة مشرف\n\n" +
            "أرسل Telegram ID للمستخدم.");
        return true;
    }
    if (action === "admin_remove") {
        if (!(await isOwner(ctx.from.id))) {
            await ctx.answerCallbackQuery({
                text: "⛔ Owner فقط.",
                show_alert: true
            });
            return true;
        }
        await setAdminAction(ctx.from.id, "admin_remove");
        await ctx.answerCallbackQuery();
        await ctx.reply("➖ إزالة مشرف\n\n" +
            "أرسل Telegram ID للمستخدم.");
        return true;
    }
    /*
     * =========================
     * STATS
     * =========================
     */
    if (action === "admin_stats") {
        const stats = await getStats();
        const queueStats = getPublishQueueStats();
        const activeClients = getActiveTelegramClientCount();
        await ctx.answerCallbackQuery();
        await ctx.reply("📊 إحصائيات المشروع\n\n" +
            `👥 المستخدمون: ${stats.users}\n` +
            `⭐ VIP: ${stats.vip}\n` +
            `📱 الحسابات: ${stats.accounts}\n` +
            `📣 المجموعات اليدوية: ${stats.groups}\n` +
            `🚀 عمليات النشر: ${stats.runs}\n\n` +
            "⚙️ الموارد الحية:\n" +
            `🔄 تشغيلات شغالة الآن: ${queueStats.running} / ${queueStats.maxConcurrent}\n` +
            `⏳ تشغيلات بالطابور: ${queueStats.queued}\n` +
            `📡 اتصالات Telegram مفتوحة: ${activeClients}`, {
            reply_markup: new InlineKeyboard()
                .text("↩️ لوحة الإدارة", "admin_panel")
        });
        return true;
    }
    /*
     * =========================
     * SETTINGS
     * =========================
     */
    if (action === "admin_settings") {
        await ctx.answerCallbackQuery();
        await sendAdminSettings(ctx);
        return true;
    }
    const settingActions = {
        set_fg: {
            key: "free_group_limit",
            action: "set_free_groups",
            text: "📣 Free\nأرسل حد المجموعات."
        },
        set_vg: {
            key: "vip_group_limit",
            action: "set_vip_groups",
            text: "📣 VIP\nأرسل حد المجموعات."
        },
        set_fa: {
            key: "free_account_limit",
            action: "set_free_accounts",
            text: "📱 Free\nأرسل حد الحسابات."
        },
        set_va: {
            key: "vip_account_limit",
            action: "set_vip_accounts",
            text: "📱 VIP\nأرسل حد الحسابات."
        },
        set_fm: {
            key: "free_message_limit",
            action: "set_free_message",
            text: "📝 Free\nأرسل حد أحرف المنشور."
        },
        set_vm: {
            key: "vip_message_limit",
            action: "set_vip_message",
            text: "📝 VIP\nأرسل حد أحرف المنشور."
        },
        set_fd: {
            key: "free_daily_runs",
            action: "set_free_daily_runs",
            text: "▶️ Free\nأرسل عدد مرات التشغيل المسموح بها يومياً."
        },
        set_vd: {
            key: "vip_daily_runs",
            action: "set_vip_daily_runs",
            text: "▶️ VIP\nأرسل عدد مرات التشغيل المسموح بها يومياً."
        },
        set_fc: {
            key: "free_cycle_limit",
            action: "set_free_cycles",
            text: "🔄 Free\nأرسل عدد الدورات لكل تشغيل."
        },
        set_vc: {
            key: "vip_cycle_limit",
            action: "set_vip_cycles",
            text: "🔄 VIP\nأرسل عدد الدورات لكل تشغيل."
        },
        set_fcd: {
            key: "free_cycle_delay_minutes",
            action: "set_free_cycle_delay",
            text: "⏱ Free\nأرسل مدة الانتظار بين الدورات بالدقائق."
        },
        set_vcd: {
            key: "vip_cycle_delay_minutes",
            action: "set_vip_cycle_delay",
            text: "⏱ VIP\nأرسل مدة الانتظار بين الدورات بالدقائق."
        },
        set_md: {
            key: "message_delay_minutes",
            action: "set_message_delay",
            text: "🐢 أرسل التأخير بين كل رسالة ووجهة بالدقائق."
        },
        set_r7: {
            key: "referral_7_vip_days",
            action: "set_referral_7",
            text: "🎁 أرسل عدد أيام VIP لمكافأة 7 إحالات."
        },
        set_r20: {
            key: "referral_20_vip_days",
            action: "set_referral_20",
            text: "🎁 أرسل عدد أيام VIP لمكافأة 15 إحالة."
        },
        set_price: {
            key: "vip_price_usdt",
            action: "set_vip_price",
            text: "💰 أرسل سعر VIP بالـ USDT."
        }
    };
    const setting = settingActions[action];
    if (setting) {
        await setAdminAction(ctx.from.id, setting.action);
        await ctx.answerCallbackQuery();
        await ctx.reply(setting.text);
        return true;
    }
    return false;
}
export async function handleAdminExtraText(ctx, text) {
    if (!ctx.from) {
        return false;
    }
    const action = await getAdminAction(ctx.from.id);
    if (!action) {
        return false;
    }
    /*
     * =========================
     * VIP GRANT
     * =========================
     */
    if (action === "vip_grant") {
        const parts = text
            .trim()
            .split(/\s+/);
        if (parts.length < 2) {
            await ctx.reply("❌ الصيغة:\n123456789 30");
            return true;
        }
        const id = Number(parts[0]);
        const days = Number(parts[1]);
        try {
            const expires = await grantVip(ctx.from.id, id, days);
            await clearAdminAction(ctx.from.id);
            await ctx.reply("✅ تم منح VIP.\n\n" +
                `👤 ID: ${id}\n` +
                `⏱ المدة: ${days} يوم\n` +
                `📅 الانتهاء: ${expires.toISOString()}`);
        }
        catch (error) {
            await ctx.reply(error instanceof Error
                ? `❌ ${error.message}`
                : "❌ تعذر منح VIP.");
        }
        return true;
    }
    /*
     * =========================
     * VIP REVOKE
     * =========================
     */
    if (action === "vip_revoke") {
        const id = Number(text.trim());
        try {
            await revokeVip(ctx.from.id, id);
            await clearAdminAction(ctx.from.id);
            await ctx.reply("✅ تم سحب VIP.");
        }
        catch {
            await ctx.reply("❌ تعذر سحب VIP.");
        }
        return true;
    }
    /*
     * =========================
     * SEARCH USER
     * =========================
     */
    if (action === "vip_search" ||
        action === "admin_user_search") {
        const user = await findUser(text);
        await clearAdminAction(ctx.from.id);
        if (!user) {
            await ctx.reply("❌ لم أجد المستخدم.");
            return true;
        }
        await ctx.reply("👤 معلومات المستخدم\n\n" +
            `🆔 ${user.telegram_id}\n` +
            `👤 ${user.username
                ? `@${user.username}`
                : user.first_name ||
                    "بدون اسم"}\n` +
            `📦 ${user.plan === "vip"
                ? "⭐ VIP"
                : "🆓 Free"}\n` +
            `📅 ${user.vip_expires_at ||
                "لا يوجد VIP"}`);
        return true;
    }
    /*
     * =========================
     * ADMINS
     * =========================
     */
    if (action === "admin_add") {
        if (!(await isOwner(ctx.from.id))) {
            return true;
        }
        try {
            await addAdmin(Number(text.trim()));
            await clearAdminAction(ctx.from.id);
            await ctx.reply("✅ تم إضافة المشرف.");
        }
        catch {
            await ctx.reply("❌ تعذر إضافة المشرف.\n\n" +
                "تأكد أن المستخدم بدأ البوت أولاً.");
        }
        return true;
    }
    if (action === "admin_remove") {
        if (!(await isOwner(ctx.from.id))) {
            return true;
        }
        try {
            await removeAdmin(Number(text.trim()));
            await clearAdminAction(ctx.from.id);
            await ctx.reply("✅ تمت إزالة المشرف.");
        }
        catch (error) {
            await ctx.reply(error instanceof Error &&
                error.message ===
                    "CANNOT_REMOVE_OWNER"
                ? "⛔ لا يمكن إزالة الـOwner."
                : "❌ تعذر إزالة المشرف.");
        }
        return true;
    }
    /*
     * =========================
     * SYSTEM SETTINGS UPDATE
     * =========================
     */
    const settingMap = {
        set_free_groups: {
            key: "free_group_limit",
            integer: true,
            min: 1,
            max: 1000
        },
        set_vip_groups: {
            key: "vip_group_limit",
            integer: true,
            min: 1,
            max: 10000
        },
        set_free_accounts: {
            key: "free_account_limit",
            integer: true,
            min: 1,
            max: 50
        },
        set_vip_accounts: {
            key: "vip_account_limit",
            integer: true,
            min: 1,
            max: 100
        },
        set_free_message: {
            key: "free_message_limit",
            integer: true,
            min: 1,
            max: 4096
        },
        set_vip_message: {
            key: "vip_message_limit",
            integer: true,
            min: 1,
            max: 4096
        },
        set_free_daily_runs: {
            key: "free_daily_runs",
            integer: true,
            min: 1,
            max: 100
        },
        set_vip_daily_runs: {
            key: "vip_daily_runs",
            integer: true,
            min: 1,
            max: 100
        },
        set_free_session: {
            key: "free_cycle_delay_minutes",
            integer: true,
            min: 1,
            max: 1440
        },
        set_vip_session: {
            key: "vip_cycle_delay_minutes",
            integer: true,
            min: 1,
            max: 1440
        },
        set_referral_7: {
            key: "referral_7_vip_days",
            integer: true,
            min: 1,
            max: 3650
        },
        set_referral_20: {
            key: "referral_20_vip_days",
            integer: true,
            min: 1,
            max: 3650
        },
        set_vip_price: {
            key: "vip_price_usdt",
            integer: false,
            min: 0.01,
            max: 100000
        }
    };
    const selected = settingMap[action];
    if (selected) {
        const value = Number(text
            .trim()
            .replace(",", "."));
        if (!Number.isFinite(value)) {
            await ctx.reply("❌ أرسل رقماً صحيحاً.");
            return true;
        }
        if (selected.integer &&
            !Number.isInteger(value)) {
            await ctx.reply("❌ يجب أن يكون الرقم صحيحاً بدون فاصلة.");
            return true;
        }
        if (value <
            selected.min ||
            value >
                selected.max) {
            await ctx.reply(`❌ القيمة يجب أن تكون بين ${selected.min} و ${selected.max}.`);
            return true;
        }
        try {
            await updateAppSetting(selected.key, value);
            await clearAdminAction(ctx.from.id);
            const settings = await getAppSettings();
            const saved = settings[selected.key];
            await ctx.reply("✅ تم تحديث الإعداد.\n\n" +
                `القيمة الجديدة: ${saved}`, {
                reply_markup: new InlineKeyboard()
                    .text("⚙️ عرض الإعدادات", "admin_settings")
                    .row()
                    .text("👑 لوحة الإدارة", "admin_panel")
            });
        }
        catch (error) {
            console.error("ADMIN SETTING UPDATE ERROR:", error);
            await ctx.reply("❌ تعذر حفظ الإعداد في قاعدة البيانات.");
        }
        return true;
    }
    return false;
}
