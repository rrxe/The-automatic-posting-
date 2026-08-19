import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types/bot.js";

import {
  getAppSettings
} from "../services/settings.js";

export async function showPublicVip(
  ctx: BotContext
) {
  const settings =
    await getAppSettings();

  await ctx.reply(
    "⭐ باقة VIP\n\n" +
    `💰 السعر: ${settings.vip_price_usdt} USDT / 30 يوم\n` +
    `📣 حد المجموعات: ${settings.vip_group_limit}\n` +
    `📱 الحسابات: ${settings.vip_account_limit}\n` +
    `📝 حد المنشور: ${settings.vip_message_limit} حرف\n` +
    `▶️ التشغيلات اليومية: ${settings.vip_daily_runs}\n` +
    `🔄 الدورات لكل تشغيل: ${settings.vip_cycle_limit}\n` +
    `⏱ الانتظار بين الدورات: ${settings.vip_cycle_delay_minutes} دقائق\n` +
    `⏳ التأخير بين الرسائل: ${settings.message_delay_minutes} دقائق\n\n` +
    "🎁 مكافآت الإحالات:\n" +
    `7 إحالات → VIP ${settings.referral_7_vip_days} أيام\n` +
    `15 إحالة → VIP ${settings.referral_20_vip_days} أيام\n\n` +
    "💳 للشراء أو الاستفسار تواصل مع:\n" +
    "@ncryptix\n" +
    "أو\n" +
    "@BIG4REALL",
    {
      reply_markup:
        new InlineKeyboard()
          .url(
            "💬 تواصل مع @ncryptix",
            "https://t.me/ncryptix"
          )
          .row()
          .url(
            "💬 تواصل مع @BIG4REALL",
            "https://t.me/BIG4REALL"
          )
          .row()
          .text(
            "🏠 الرئيسية",
            "dashboard"
          )
    }
  );
}
