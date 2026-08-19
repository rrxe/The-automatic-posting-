import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types/bot.js";

import {
  accountPanel,
  accountView,
  syncGroups,
  showGroups,
  toggleGroup,
  removeAccount
} from "./accountGroups.js";

import { startCreatePost } from "./postFlow.js";

import {
  startPublishFlow
} from "./messageComposer.js";
import { sendDashboard } from "./dashboard.js";

import {
  getUserByTelegramId
} from "../services/users.js";

import {
  setUserAction,
  clearUserAction
} from "../services/userActions.js";

import {
  prepareChatAdd,
  confirmChatAdd,
  clearPendingChatAdd
} from "../services/chatAdd.js";

import {
  showManualGroups,
  toggleManualGroup,
  detachManualGroup
} from "./manualGroups.js";

export async function handleAccountGroupCallback(
  ctx: BotContext
): Promise<boolean> {
  const action = ctx.callbackQuery?.data;

  if (!action) {
    return false;
  }

  // الرئيسية
  if (action === "dashboard") {
    await ctx.answerCallbackQuery();
    await sendDashboard(ctx);
    return true;
  }

  // الحسابات
  if (action === "account") {
    await ctx.answerCallbackQuery();
    await accountPanel(ctx);
    return true;
  }

  if (action === "groups") {
    await ctx.answerCallbackQuery();
    await accountPanel(ctx);
    return true;
  }

  // إنشاء منشور
  if (action === "create_message") {
    await ctx.answerCallbackQuery();
    await startCreatePost(ctx);
    return true;
  }

  // عرض حساب
  if (action.startsWith("av:")) {
    await ctx.answerCallbackQuery();

    await accountView(
      ctx,
      action.slice(3)
    );

    return true;
  }

  // عرض مجموعات الحساب
  if (action.startsWith("ag:")) {
    await ctx.answerCallbackQuery();

    await showGroups(
      ctx,
      action.slice(3)
    );

    return true;
  }

  // تحديث المجموعات
  if (action.startsWith("as:")) {
    await syncGroups(
      ctx,
      action.slice(3)
    );

    return true;
  }

  // اختيار مجموعة
  if (action.startsWith("gt:")) {
    const parts = action.split(":");

    const accountId = parts[1];
    const index = Number(parts[2]);

    await toggleGroup(
      ctx,
      accountId,
      index
    );

    return true;
  }

  // إزالة الحساب
  if (action.startsWith("ar:")) {
    await removeAccount(
      ctx,
      action.slice(3)
    );

    return true;
  }

  // زر تشغيل النشر
  if (action.startsWith("run:")) {
    await startPublishFlow(ctx);
    return true;
  }

  // =======================================================
  // إضافة مجموعة
  // =======================================================

  if (action.startsWith("ac:")) {
    if (!ctx.from) {
      return true;
    }

    const accountId =
      action.slice(3);

    const user =
      await getUserByTelegramId(
        ctx.from.id
      );

    if (!user) {
      return true;
    }

    await setUserAction(
      ctx.from.id,
      `add_chat:${accountId}`
    );

    await ctx.answerCallbackQuery();

    await ctx.reply(
      "➕ إضافة مجموعة\n\n" +
      "أرسل Username المجموعة أو رابط Telegram.\n\n" +
      "تقدر ترسل أكثر من واحد دفعة وحدة — رابط أو Username بكل سطر:\n\n" +
      "مثال:\n" +
      "@Group1\n" +
      "https://t.me/Group2\n" +
      "https://t.me/+XXXXXXXX\n\n" +
      "بعد الإرسال بتحقق من كل واحدة وأعرض عليك ملخص قبل ما أضيف أي شي فعلياً."
    );

    return true;
  }

  // تأكيد إضافة المجموعات
  if (action === "chat_confirm") {
    if (!ctx.from) {
      return true;
    }

    try {
      const result =
        await confirmChatAdd(
          ctx.from.id
        );

      await clearUserAction(
        ctx.from.id
      );

      const total =
        result.activated.length +
        result.addedInactive.length;

      let message =
        `✅ تمت إضافة ${total} وجهة.\n\n`;

      if (result.activated.length) {
        message +=
          `✅ مفعّلة للنشر (${result.activated.length}):\n` +
          result.activated
            .map((g) => `• ${g.title}`)
            .join("\n") +
          "\n\n";
      }

      if (result.addedInactive.length) {
        message +=
          `⏸ أُضيفت بدون تفعيل — وصلت حد باقتك (${result.addedInactive.length}):\n` +
          result.addedInactive
            .map((g) => `• ${g.title}`)
            .join("\n") +
          "\n\nتقدر تفعّلها لاحقاً من «📣 مجموعاتي» بعد ما توقف وجهة ثانية.\n\n";
      }

      await ctx.answerCallbackQuery({
        text: "✅ تم."
      });

      await ctx.reply(
        message,
        {
          reply_markup:
            new InlineKeyboard()
              .text(
                "⚙️ حسابي",
                "account"
              )
              .row()
              .text(
                "🏠 الرئيسية",
                "dashboard"
              )
        }
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "";

      clearPendingChatAdd(
        ctx.from.id
      );

      await clearUserAction(
        ctx.from.id
      );

      await ctx.answerCallbackQuery({
        text: "❌ تعذر إضافة المجموعات.",
        show_alert: true
      });

      await ctx.reply(
        message === "NO_PENDING_CHAT"
          ? "⚠️ انتهت صلاحية المعاينة. أرسل الروابط من جديد."
          : "❌ تعذر إضافة المجموعات.\n\nحاول مرة أخرى."
      );
    }

    return true;
  }

  // إلغاء إضافة المجموعة
  if (action === "chat_cancel") {
    if (ctx.from) {
      clearPendingChatAdd(
        ctx.from.id
      );

      await clearUserAction(
        ctx.from.id
      );
    }

    await ctx.answerCallbackQuery({
      text: "تم الإلغاء."
    });

    await ctx.reply(
      "🗑 تم إلغاء إضافة المجموعة.",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "⚙️ حسابي",
              "account"
            )
            .row()
            .text(
              "🏠 الرئيسية",
              "dashboard"
            )
      }
    );

    return true;
  }

  if (
    action.startsWith("mg:")
  ) {
    const parts =
      action.split(":");

    await toggleManualGroup(
      ctx,
      parts[1],
      Number(parts[2])
    );

    return true;
  }

  if (
    action.startsWith("md:")
  ) {
    const parts =
      action.split(":");

    await detachManualGroup(
      ctx,
      parts[1],
      Number(parts[2])
    );

    return true;
  }

  return false;
}
