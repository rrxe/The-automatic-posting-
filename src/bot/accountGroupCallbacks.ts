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
      "أمثلة:\n" +
      "@MyGroup\n" +
      "https://t.me/MyGroup\n\n" +
      "للمجموعات الخاصة:\n" +
      "https://t.me/+XXXXXXXX\n\n" +
      "بعد إرسال الرابط سأتحقق منه أولاً."
    );

    return true;
  }

  // تأكيد إضافة المجموعة
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

      await ctx.answerCallbackQuery({
        text: "✅ تمت إضافة المجموعة."
      });

      await ctx.reply(
        "✅ تمت إضافة المجموعة بنجاح.\n\n" +
        `📣 ${result.title}\n` +
        `🔗 ${result.username || result.telegramChatId}\n\n` +
        (
          result.joined
            ? "✅ تم الانضمام بالحساب وإضافة المجموعة."
            : "✅ المجموعة أصبحت متاحة للحساب."
        ),
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
        text: "❌ تعذر إضافة المجموعة.",
        show_alert: true
      });

      await ctx.reply(
        message === "CHAT_NOT_FOUND"
          ? "❌ لم أجد المجموعة أو الرابط غير صالح."
          : message === "JOIN_MANUALLY_FIRST"
          ? "⚠️ الحساب لسا مو منضم لهذه المجموعة.\n\n" +
            "انضم أولاً يدوياً من تطبيق Telegram بنفس الحساب، وبعدين ارجع أضفها هنا — البوت ما يحاول الانضمام تلقائياً."
          : "❌ تعذر إضافة المجموعة.\n\n" +
            "تأكد من صحة الرابط وأن الحساب عضو فيها بالفعل."
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
