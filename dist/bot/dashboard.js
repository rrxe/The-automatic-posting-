import { InlineKeyboard } from "grammy";
import { getUserByTelegramId } from "../services/users.js";
import { getAppSettings } from "../services/settings.js";
import { getUserTelegramAccounts } from "../telegram/clientManager.js";
import { getDailyPublishCount } from "../services/posts.js";
export async function sendDashboard(ctx) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const settings = await getAppSettings();
    const vip = user.plan === "vip" &&
        !!user.vip_expires_at &&
        new Date(user.vip_expires_at) > new Date();
    const accountLimit = vip
        ? settings.vip_account_limit
        : settings.free_account_limit;
    const groupLimit = vip
        ? settings.vip_group_limit
        : settings.free_group_limit;
    const dailyLimit = vip
        ? settings.vip_daily_runs
        : settings.free_daily_runs;
    const cycleLimit = vip
        ? settings.vip_cycle_limit
        : settings.free_cycle_limit;
    const cycleDelay = vip
        ? settings.vip_cycle_delay_minutes
        : settings.free_cycle_delay_minutes;
    const dailyUsed = await getDailyPublishCount(user.id);
    /*
     * إذا خفّض الأدمن الحد بعد أن كان المستخدم
     * قد تجاوز الحد القديم، لا نظهر 5 / 4.
     * نظهر 4 / 4 مع المتبقي 0.
     */
    const displayedUsed = Math.min(dailyUsed, dailyLimit);
    const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);
    const accounts = await getUserTelegramAccounts(user.id);
    const keyboard = new InlineKeyboard()
        .text("▶️ تشغيل", "run_publish")
        .row()
        .text("➕ إضافة حساب", "account_add")
        .row()
        .text("✍️ إنشاء منشور", "create_message")
        .text("📝 منشوراتي", "my_messages")
        .row()
        .text("📣 مجموعاتي", "groups")
        .text("⭐ VIP", "vip")
        .row()
        .text("👥 الإحالات", "referrals")
        .text("📊 سجل النشر", "publish_history")
        .row()
        .text("⚙️ حسابي", "account");
    if (ctx.from.id ===
        Number(process.env.OWNER_TELEGRAM_ID)) {
        keyboard
            .row()
            .text("👑 لوحة الإدارة", "admin_panel");
    }
    await ctx.reply("🚀 أهلاً بك في نشر تلقائي!\n\n" +
        "أداة سهلة لإدارة ونشر منشوراتك\n" +
        "في مجموعاتك المحددة.\n\n" +
        `📦 الباقة: ${vip
            ? "⭐ VIP"
            : "🆓 مجاني"}\n` +
        `👤 الحسابات: ${accounts.length} / ${accountLimit}\n` +
        `📣 حد المجموعات: ${groupLimit}\n` +
        `▶️ التشغيلات: ${displayedUsed} / ${dailyLimit}\n` +
        `⏳ المتبقي: ${dailyRemaining}\n` +
        `🔄 الدورات لكل تشغيل: ${cycleLimit}\n` +
        `⏱ الانتظار بين الدورات: ${cycleDelay} دقيقة\n\n` +
        "👇 اختر الخدمة التي تريدها:", {
        reply_markup: keyboard
    });
}
