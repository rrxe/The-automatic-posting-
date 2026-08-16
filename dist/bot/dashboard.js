import { InlineKeyboard } from "grammy";
import { getUserByTelegramId } from "../services/users.js";
import { getAppSettings } from "../services/settings.js";
import { getUserTelegramAccounts } from "../telegram/clientManager.js";
import { getDailyPublishCount } from "../services/posts.js";
import { getActiveRunForUser } from "../services/publishControl.js";
import { isAdmin } from "../services/admin.js";
export async function sendSecurityInfo(ctx) {
    await ctx.reply("🔐 أمان حسابك وخصوصيتك أولويتنا\n\n" +
        "ربط حسابك يتم عبر اتصال رسمي مباشر مع Telegram، وبيانات الجلسة تُحفظ بشكل مشفّر.\n\n" +
        "🛡️ حماية الجلسة\n" +
        "جلسة حسابك على Telegram تُشفَّر قبل حفظها في قاعدة البيانات، ولا تُخزَّن مكشوفة أبداً.\n\n" +
        "🔒 المفاتيح السرية\n" +
        "مفاتيح التشفير وتوكن البوت محفوظة كمتغيرات بيئة على السيرفر فقط — غير ظاهرة لأي واجهة أو مستخدم.\n\n" +
        "👤 عزل الحسابات\n" +
        "كل حساب Telegram له جلسة مستقلة خاصة بصاحبه فقط، ولا تُعرض أو تُشارك مع أي مستخدم آخر.\n\n" +
        "🚫 كلمة مرورك محمية\n" +
        "تسجيل الدخول يتم عبر نظام Telegram نفسه (رقم + رمز). لا نطلب كلمة مرور حسابك إطلاقاً، إلا إذا كان التحقق بخطوتين مفعّلاً من طرفك على Telegram — وحتى في هذه الحالة تُستخدم لحظياً لإكمال الدخول فقط، ولا تُخزَّن عندنا نهائياً.\n\n" +
        "🧹 تنظيف الجلسات المنتهية\n" +
        "إذا انتهت صلاحية جلسة حساب أو قيّدته Telegram، يتم إيقافه تلقائياً وإشعارك لإعادة ربطه.\n\n" +
        "🌐 اتصال مشفّر\n" +
        "التواصل مع خوادم Telegram يتم عبر بروتوكول Telegram المشفّر (MTProto).\n\n" +
        "⚠️ تنبيه مهم: لا ترسل رمز تسجيل الدخول أو كلمة مرور التحقق بخطوتين لأي شخص، حتى لو ادّعى أنه من الدعم — العملية الآمنة الوحيدة تتم داخل هذا البوت مباشرة.\n\n" +
        "باختصار: بياناتك غير معروضة لأحد، وجلستك محمية بالتشفير والعزل الكامل بين الحسابات. 🔐", {
        reply_markup: new InlineKeyboard()
            .text("🏠 الرئيسية", "dashboard")
    });
}
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
    const activeRun = await getActiveRunForUser(user.id);
    const keyboard = new InlineKeyboard();
    if (activeRun) {
        keyboard
            .text("⏹ إيقاف التشغيل", `stop:${activeRun.id}`)
            .row();
    }
    else {
        keyboard
            .text("▶️ تشغيل", "run_publish")
            .row();
    }
    keyboard
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
        .text("⚙️ حسابي", "account")
        .text("🔐 الأمان والخصوصية", "security_info");
    if (await isAdmin(ctx.from.id)) {
        keyboard
            .row()
            .text("👑 لوحة الإدارة", "admin_panel");
    }
    await ctx.reply("🚀 نشر تلقائي\n\n" +
        "أداة سهلة لإدارة ونشر منشوراتك\n" +
        "في مجموعاتك المحددة.\n\n" +
        "──────────\n\n" +
        `📦 باقتك: ${vip
            ? "⭐ VIP"
            : "🆓 مجاني"}\n\n` +
        "📊 الاستخدام\n" +
        `👤 الحسابات: ${accounts.length} من ${accountLimit}\n` +
        `▶️ التشغيلات اليوم: ${displayedUsed} من ${dailyLimit} (متبقي ${dailyRemaining})\n` +
        `🔄 الدورات لكل تشغيل: ${cycleLimit} — انتظار ${cycleDelay} دقيقة بينها\n` +
        `📣 حد المجموعات: ${groupLimit}\n\n` +
        "──────────\n\n" +
        "👇 اختر من القائمة:", {
        reply_markup: keyboard
    });
}
