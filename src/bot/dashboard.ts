import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types/bot.js";

import {
  getUserByTelegramId
} from "../services/users.js";

import {
  getAppSettings
} from "../services/settings.js";

import {
  getUserTelegramAccounts
} from "../telegram/clientManager.js";

import {
  getDailyPublishCount
} from "../services/posts.js";

import {
  getActiveRunForUser
} from "../services/publishControl.js";

import { isAdmin } from "../services/admin.js";

export async function sendSecurityInfo(
  ctx: BotContext
) {
  await ctx.reply(
    "🔐 أمان حسابك وخصوصيتك أولويتنا\n\n" +
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
    "باختصار: بياناتك غير معروضة لأحد، وجلستك محمية بالتشفير والعزل الكامل بين الحسابات. 🔐",
    {
      reply_markup:
        new InlineKeyboard()
          .text(
            "🏠 الرئيسية",
            "dashboard"
          )
    }
  );
}

export async function sendDashboard(
  ctx: BotContext
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const settings =
    await getAppSettings();

  const vip =
    user.plan === "vip" &&
    !!user.vip_expires_at &&
    new Date(
      user.vip_expires_at
    ) > new Date();

  const groupLimit =
    vip
      ? settings.vip_group_limit
      : settings.free_group_limit;

  const dailyLimit =
    vip
      ? settings.vip_daily_runs
      : settings.free_daily_runs;

  const cycleLimit =
    vip
      ? settings.vip_cycle_limit
      : settings.free_cycle_limit;

  const cycleDelay =
    vip
      ? settings.vip_cycle_delay_minutes
      : settings.free_cycle_delay_minutes;

  const dailyUsed =
    await getDailyPublishCount(
      user.id
    );

  /*
   * إذا خفّض الأدمن الحد بعد أن كان المستخدم
   * قد تجاوز الحد القديم، لا نظهر 5 / 4.
   * نظهر 4 / 4 مع المتبقي 0.
   */
  const displayedUsed =
    Math.min(
      dailyUsed,
      dailyLimit
    );

  const dailyRemaining =
    Math.max(
      0,
      dailyLimit - dailyUsed
    );

  const accounts =
    await getUserTelegramAccounts(
      user.id
    );

  const activeRun =
    await getActiveRunForUser(
      user.id
    );

  const keyboard =
    new InlineKeyboard();

  if (activeRun) {
    keyboard
      .text(
        "⏹ إيقاف التشغيل",
        `stop:${activeRun.id}`
      )
      .row();
  } else {
    keyboard
      .text(
        "▶️ تشغيل النشر",
        "run_publish"
      )
      .row();
  }

  // لا نظهر زر إضافة الحساب طالما يوجد حساب مرتبط.
  if (!accounts.length) {
    keyboard
      .text(
        "➕ إضافة حساب Telegram",
        "account_add"
      )
      .row();
  }

  keyboard
    .text("✍️ المنشورات", "create_message")
    .row()
    .text("📣 مجموعاتي", "groups")
    .text("⚙️ حسابي", "account")
    .row()
    .text("⭐ VIP", "vip")
    .text("👥 الإحالات", "referrals")
    .row()
    .text("📊 سجل النشر", "publish_history")
    .text("🔐 الأمان", "security_info");

  if (
    await isAdmin(
      ctx.from.id
    )
  ) {
    keyboard
      .row()
      .text(
        "👑 لوحة الإدارة",
        "admin_panel"
      );
  }

  await ctx.reply(
    "🚀 نشر تلقائي\n\n" +
    "إدارة ونشر منشوراتك بسهولة من مكان واحد.\n\n" +
    "──────────\n\n" +
    `📦 الباقة: ${vip ? "⭐ VIP" : "🆓 مجاني"}\n` +
    (
      accounts.length
        ? `📱 الحساب: ${
            accounts[0].username
              ? `@${accounts[0].username}`
              : accounts[0].display_name ||
                accounts[0].phone_hint ||
                "مرتبط"
          }\n`
        : "📱 الحساب: غير مرتبط\n"
    ) +
    `📣 حد المجموعات: ${groupLimit}\n\n` +
    "📊 الاستخدام\n" +
    `▶️ التشغيلات اليوم: ${displayedUsed} من ${dailyLimit} (متبقي ${dailyRemaining})\n` +
    `🔄 الدورات لكل تشغيل: ${cycleLimit} — انتظار ${cycleDelay} دقيقة بينها\n\n` +
    "──────────\n\n" +
    (
      accounts.length
        ? "✅ حسابك جاهز. اختر الخدمة:"
        : "⚠️ أضف حساب Telegram أولاً:"
    ),
    {
      reply_markup:
        keyboard
    }
  );
}
