import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types/bot.js";

import {
  getUserByTelegramId
} from "../services/users.js";

import {
  getUserTelegramAccounts,
  removeTelegramAccount
} from "../telegram/clientManager.js";

import {
  getAppSettings
} from "../services/settings.js";

import {
  getDailyPublishCount
} from "../services/posts.js";

import {
  showManualGroups,
  toggleManualGroup
} from "./manualGroups.js";

export async function accountPanel(
  ctx: BotContext
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const accounts =
    await getUserTelegramAccounts(
      user.id
    );

  if (!accounts.length) {
    await ctx.reply(
      "⚙️ حساباتي\n\n" +
      "لا يوجد حساب Telegram مرتبط حالياً.\n\n" +
      "أضف حسابك للبدء.",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "➕ إضافة حساب",
              "account_add"
            )
            .row()
            .text(
              "🏠 الرئيسية",
              "dashboard"
            )
      }
    );

    return;
  }

  if (accounts.length === 1) {
    await accountView(
      ctx,
      accounts[0].id
    );
    return;
  }

  const keyboard =
    new InlineKeyboard();

  for (
    const account of accounts
  ) {
    const name =
      account.username
        ? `@${account.username}`
        : account.display_name ||
          account.phone_hint ||
          "الحساب";

    keyboard
      .text(
        `📱 ${name}`,
        `av:${account.id}`
      )
      .row();
  }

  keyboard
    .text(
      "🏠 الرئيسية",
      "dashboard"
    );

  await ctx.reply(
    "⚙️ حساباتي\n\n" +
    `📱 الحسابات المرتبطة: ${accounts.length}\n\n` +
    "اختر الحساب الذي تريد إدارته:",
    {
      reply_markup:
        keyboard
    }
  );
}

export async function accountView(
  ctx: BotContext,
  accountId: string
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const accounts =
    await getUserTelegramAccounts(
      user.id
    );

  const account =
    accounts.find(
      (item) =>
        item.id === accountId
    );

  if (!account) {
    await ctx.reply(
      "❌ الحساب غير موجود.",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "🏠 الرئيسية",
              "dashboard"
            )
      }
    );

    return;
  }

  const settings =
    await getAppSettings();

  const vip =
    user.plan === "vip" &&
    !!user.vip_expires_at &&
    new Date(
      user.vip_expires_at
    ) > new Date();

  /*
   * عدد عمليات التشغيل التي بدأها
   * المستخدم خلال اليوم الحالي.
   */
  const dailyLimit =
    vip
      ? settings.vip_daily_runs
      : settings.free_daily_runs;

  const dailyUsed =
    await getDailyPublishCount(
      user.id
    );

  const dailyRemaining =
    Math.max(
      0,
      dailyLimit - dailyUsed
    );

  /*
   * الحد الأقصى للدورات في عملية التشغيل الواحدة.
   */
  const cycleLimit =
    vip
      ? settings.vip_cycle_limit
      : settings.free_cycle_limit;

  const cycleDelay =
    vip
      ? settings.vip_cycle_delay_minutes
      : settings.free_cycle_delay_minutes;

  await ctx.reply(
    "⚙️ حسابي\n\n" +
    `👤 الحساب: ${
      account.username
        ? `@${account.username}`
        : account.display_name ||
          "بدون اسم"
    }\n` +
    `📞 الهاتف: ${
      account.phone_hint ||
      "مخفي"
    }\n\n` +

    `📦 الباقة: ${
      vip
        ? "⭐ VIP"
        : "🆓 مجاني"
    }\n` +

    `▶️ التشغيلات: ${
      dailyUsed
    } / ${
      dailyLimit
    }\n` +

    `⏳ المتبقي: ${
      dailyRemaining
    }\n` +

    `🔄 حد الدورات: ${
      cycleLimit
    }\n` +

    `⏱ الانتظار بين الدورات: ${
      cycleDelay
    } دقيقة\n\n` +

    "اختر ما تريد:",
    {
      reply_markup:
        new InlineKeyboard()
          .text(
            "▶️ تشغيل النشر",
            `run:${account.id}`
          )
          .row()
          .text(
            "📣 مجموعاتي",
            `ag:${account.id}`
          )
          .row()
          .text(
            "➕ إضافة مجموعة",
            `ac:${account.id}`
          )
          .row()
          .text(
            "🗑 إزالة الحساب",
            `ar:${account.id}`
          )
          .row()
          .text(
            "🏠 الرئيسية",
            "dashboard"
          )
    }
  );
}

export async function showGroups(
  ctx: BotContext,
  accountId: string
) {
  await showManualGroups(
    ctx,
    accountId
  );
}

export async function syncGroups(
  ctx: BotContext,
  accountId: string
) {
  await ctx.answerCallbackQuery({
    text:
      "ℹ️ هذه القائمة تعرض المجموعات المضافة يدوياً فقط."
  }).catch(() => {});

  await showManualGroups(
    ctx,
    accountId
  );
}

export async function toggleGroup(
  ctx: BotContext,
  accountId: string,
  index: number
) {
  await toggleManualGroup(
    ctx,
    accountId,
    index
  );
}

export async function removeAccount(
  ctx: BotContext,
  accountId: string
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  await removeTelegramAccount(
    accountId,
    user.id
  );

  await ctx.answerCallbackQuery({
    text:
      "✅ تمت إزالة الحساب."
  }).catch(() => {});

  await accountPanel(
    ctx
  );
}
