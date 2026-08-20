import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types/bot.js";

import {
  getUserByTelegramId
} from "../services/users.js";

import {
  getUserTelegramAccounts
} from "../telegram/clientManager.js";

import {
  getAppSettings
} from "../services/settings.js";

import {
  setUserAction,
  clearUserAction
} from "../services/userActions.js";

import { supabase } from "../db/supabase.js";

const SIGNATURE =
  "نشر تلقائي: @postrush_bot";

function isVip(user: any) {
  return (
    user?.plan === "vip" &&
    !!user.vip_expires_at &&
    new Date(user.vip_expires_at) > new Date()
  );
}

/*
 * ==============================
 * إنشاء منشور
 * ==============================
 */

export async function startMessageComposer(
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
    await ctx.answerCallbackQuery()
      .catch(() => {});

    await ctx.reply(
      "✍️ المنشورات\n\n" +
      "لا يوجد حساب Telegram مرتبط.\n\n" +
      "أضف حسابك أولاً.",
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

  // حساب واحد = لا نسأل المستخدم عن الحساب.
  if (accounts.length === 1) {
    const accountId =
      accounts[0].id;

    await ctx.answerCallbackQuery()
      .catch(() => {});

    await ctx.reply(
      "✍️ المنشورات\n\n" +
      "اختر الخدمة التي تريدها:",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "➕ إضافة منشور",
              `mnew:${accountId}`
            )
            .row()
            .text(
              "🗂 إدارة المنشورات",
              `mm:${accountId}`
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

  // إذا كان هناك أكثر من حساب نبقي اختيار الحساب.
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
        `mc:${account.id}`
      )
      .row();
  }

  keyboard.text(
    "🏠 الرئيسية",
    "dashboard"
  );

  await ctx.answerCallbackQuery()
    .catch(() => {});

  await ctx.reply(
    "✍️ المنشورات\n\n" +
    "اختر الحساب:",
    {
      reply_markup:
        keyboard
    }
  );
}

export async function chooseMessageAccount(
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
    await ctx.answerCallbackQuery({
      text:
        "❌ الحساب غير موجود.",
      show_alert: true
    });

    return;
  }

  await ctx.answerCallbackQuery();

  const name =
    account.username
      ? `@${account.username}`
      : account.display_name ||
        account.phone_hint ||
        "الحساب";

  await ctx.reply(
    "✍️ المنشورات\n\n" +
    `📱 الحساب: ${name}\n\n` +
    "اختر الخدمة التي تريدها:",
    {
      reply_markup:
        new InlineKeyboard()
          .text(
            "➕ إضافة منشور",
            `mnew:${accountId}`
          )
          .row()
          .text(
            "🗂 إدارة المنشورات",
            `mm:${accountId}`
          )
          .row()
          .text(
            "🏠 الرئيسية",
            "dashboard"
          )
    }
  );
}

export async function startNewMessage(
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

  const exists =
    accounts.some(
      (account) =>
        account.id === accountId
    );

  if (!exists) {
    await ctx.answerCallbackQuery({
      text:
        "❌ الحساب غير موجود.",
      show_alert: true
    });

    return;
  }

  await setUserAction(
    ctx.from.id,
    `message_content:${accountId}`
  );

  const settings =
    await getAppSettings();

  const limit =
    isVip(user)
      ? settings.vip_message_limit
      : settings.free_message_limit;

  await ctx.answerCallbackQuery();

  await ctx.reply(
    "✍️ إنشاء منشور جديد\n\n" +
    `📦 الباقة: ${
      isVip(user)
        ? "⭐ VIP"
        : "🆓 مجاني"
    }\n` +
    `🔢 الحد: ${limit} حرف\n\n` +
    "أرسل نص المنشور الآن.\n\n" +
    "التوقيع يُضاف تلقائياً:\n" +
    "نشر تلقائي: @postrush_bot",
    {
      reply_markup:
        new InlineKeyboard()
          .text(
            "↩️ رجوع",
            `mc:${accountId}`
          )
          .row()
          .text(
            "🏠 الرئيسية",
            "dashboard"
          )
    }
  );
}

export async function handleMessageText(
  ctx: BotContext,
  text: string
) {
  if (!ctx.from) {
    return false;
  }

  const {
    getUserAction
  } = await import(
    "../services/userActions.js"
  );

  const action =
    await getUserAction(
      ctx.from.id
    );

  if (
    !action?.startsWith(
      "message_content:"
    )
  ) {
    return false;
  }

  const accountId =
    action.slice(
      "message_content:".length
    );

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) {
    return true;
  }

  const settings =
    await getAppSettings();

  const limit =
    isVip(user)
      ? settings.vip_message_limit
      : settings.free_message_limit;

  const content =
    text.trim();

  if (!content) {
    await ctx.reply(
      "❌ المنشور لا يمكن أن يكون فارغاً."
    );

    return true;
  }

  if (
    content.length >
    limit
  ) {
    await ctx.reply(
      `❌ المنشور أطول من الحد.\n\n` +
      `🔢 الحد: ${limit}\n` +
      `📝 الحالي: ${content.length}`
    );

    return true;
  }

  const {
    data,
    error
  } = await supabase
    .from("messages")
    .insert({
      user_id:
        user.id,
      telegram_account_id:
        accountId,
      content,
      signature_enabled:
        true,
      status:
        "draft",
      send_mode:
        "manual"
    })
    .select(
      "id"
    )
    .single();

  if (error || !data) {
    console.error(
      "MESSAGE SAVE ERROR:",
      error?.message
    );

    await ctx.reply(
      "❌ تعذر حفظ المنشور."
    );

    return true;
  }

  await clearUserAction(
    ctx.from.id
  );

  await ctx.reply(
    "✅ تم حفظ المنشور بنجاح.\n\n" +
    "المنشور محفوظ ولن يتم نشره الآن.\n\n" +
    "التوقيع:\n" +
    SIGNATURE,
    {
      reply_markup:
        new InlineKeyboard()
          .text(
            "➕ إضافة منشور آخر",
            `mnew:${accountId}`
          )
          .row()
          .text(
            "🗂 إدارة المنشورات",
            `mm:${accountId}`
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

/*
 * ==============================
 * تشغيل المنشورات المحفوظة
 * ==============================
 */

export async function startPublishFlow(
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
      "▶️ تشغيل النشر\n\n" +
      "لا يوجد حساب Telegram مرتبط.",
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
    await showSavedMessages(ctx, accounts[0].id);
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
        `rp:${account.id}`
      )
      .row();
  }

  keyboard.text(
    "🏠 الرئيسية",
    "dashboard"
  );

  await ctx.answerCallbackQuery()
    .catch(() => {});

  await ctx.reply(
    "▶️ تشغيل النشر\n\n" +
    "اختر الحساب:",
    {
      reply_markup:
        keyboard
    }
  );
}

export async function showSavedMessages(
  ctx: BotContext,
  accountId: string
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const {
    data,
    error
  } = await supabase
    .from("messages")
    .select(
      "id,content,created_at,status"
    )
    .eq(
      "user_id",
      user.id
    )
    .eq(
      "telegram_account_id",
      accountId
    )
    .neq(
      "status",
      "deleted"
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(20);

  if (error) {
    await ctx.reply(
      "❌ تعذر تحميل المنشورات.",
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

  if (!data?.length) {
    await ctx.reply(
      "📭 لا توجد منشورات محفوظة لهذا الحساب.",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "✍️ إنشاء منشور جديد",
              `mnew:${accountId}`
            )
            .row()
            .text(
              "↩️ رجوع",
              "create_message"
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

  const keyboard =
    new InlineKeyboard();

  data.forEach(
    (message, index) => {
      const preview =
        message.content
          .replace(/\n/g, " ")
          .slice(0, 45);

      /*
       * التشغيل:
       * زر واحد فقط للمنشور.
       * لا يوجد حذف هنا.
       */
      keyboard
        .text(
          `▶️ ${index + 1}. ${preview}`,
          `pm:${message.id}`
        )
        .row();
    }
  );

  keyboard
    .text(
      "↩️ رجوع",
      "run_publish"
    )
    .row()
    .text(
      "🏠 الرئيسية",
      "dashboard"
    );

  await ctx.reply(
    "▶️ تشغيل النشر\n\n" +
    "اختر المنشور الذي تريد تشغيله:",
    {
      reply_markup:
        keyboard
    }
  );
}

export async function confirmDeleteSavedMessage(
  ctx: BotContext,
  messageId: string
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const {
    data: message,
    error
  } = await supabase
    .from("messages")
    .select(
      "id,content,telegram_account_id"
    )
    .eq(
      "id",
      messageId
    )
    .eq(
      "user_id",
      user.id
    )
    .neq(
      "status",
      "deleted"
    )
    .maybeSingle();

  if (error || !message) {
    await ctx.answerCallbackQuery({
      text: "❌ المنشور غير موجود.",
      show_alert: true
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const preview =
    String(message.content)
      .replace(/\n/g, " ")
      .slice(0, 180);

  await ctx.reply(
    "🗑 حذف المنشور\n\n" +
      "هل تريد حذف هذا المنشور؟\n\n" +
      preview +
      (

        String(message.content).length > 180
          ? "…"
          : ""
      ),
    {
      reply_markup:
        new InlineKeyboard()
          .text(
            "✅ نعم، احذف",
            `mdel:${message.id}`
          )
          .text(
            "❌ إلغاء",
            `mm:${message.telegram_account_id}`
          )
          .row()
          .text(
            "🏠 الرئيسية",
            "dashboard"
          )
    }
  );
}

export async function deleteSavedMessage(
  ctx: BotContext,
  messageId: string
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const {
    data: existingMessage,
    error: lookupError
  } = await supabase
    .from("messages")
    .select("id,telegram_account_id")
    .eq("id", messageId)
    .eq("user_id", user.id)
    .neq("status", "deleted")
    .maybeSingle();

  if (lookupError || !existingMessage) {
    await ctx.answerCallbackQuery({
      text: "❌ المنشور غير موجود أو محذوف بالفعل.",
      show_alert: true
    });
    return;
  }

  /*
   * Soft delete:
   * لا نحذف السجل فعليًا من قاعدة البيانات.
   * فقط نضع status = deleted.
   */
  const {
    data,
    error
  } = await supabase
    .from("messages")
    .update({
      status: "deleted"
    })
    .eq(
      "id",
      messageId
    )
    .eq(
      "user_id",
      user.id
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "DELETE MESSAGE ERROR:",
      error.message
    );

    await ctx.answerCallbackQuery({
      text:
        "❌ تعذر حذف المنشور.",
      show_alert: true
    });

    return;
  }

  if (!data) {
    await ctx.answerCallbackQuery({
      text:
        "❌ المنشور غير موجود.",
      show_alert: true
    });

    return;
  }

  await ctx.answerCallbackQuery({
    text:
      "✅ تم حذف المنشور."
  });

  if (existingMessage.telegram_account_id) {
    await showMyMessages(
      ctx,
      existingMessage.telegram_account_id
    );
    return;
  }

  await ctx.reply(
    "✅ تم حذف المنشور.",
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

export async function chooseSavedMessage(
  ctx: BotContext,
  messageId: string
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const {
    data: message,
    error
  } = await supabase
    .from("messages")
    .select(
      "id,content,telegram_account_id"
    )
    .eq(
      "id",
      messageId
    )
    .eq(
      "user_id",
      user.id
    )
    .single();

  if (
    error ||
    !message
  ) {
    await ctx.answerCallbackQuery({
      text:
        "❌ المنشور غير موجود.",
      show_alert:
        true
    });

    return;
  }

  /*
   * فقط الوجهات التي أضافها المستخدم.
   * لا نستخدم dialogs الخاصة بالحساب.
   */
  const {
    data:
      groups,
    error:
      groupError
  } = await supabase
    .from("user_groups")
    .select(`
      group_id,
      is_active,
      groups (
        title,
        username
      )
    `)
    .eq(
      "user_id",
      user.id
    )
    .eq(
      "telegram_account_id",
      message.telegram_account_id
    )
    .eq(
      "source",
      "manual"
    )
    .order(
      "created_at",
      {
        ascending:
          true
      }
    );

  if (
    groupError
  ) {
    await ctx.answerCallbackQuery({
      text:
        "❌ تعذر تحميل مجموعاتك.",
      show_alert:
        true
    });

    return;
  }

  if (
    !groups?.length
  ) {
    await ctx.answerCallbackQuery({
      text:
        "❌ لا توجد مجموعات مضافة.",
      show_alert:
        true
    });

    await ctx.reply(
      "📣 لا توجد مجموعات مضافة لهذا الحساب.\n\n" +
      "اضغط «➕ إضافة مجموعة» لإضافة وجهة.",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "➕ إضافة مجموعة",
              `ac:${message.telegram_account_id}`
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

  const selectedGroups =
    groups.filter(
      (group: any) =>
        group.is_active
    );

  await ctx.answerCallbackQuery();

  await ctx.reply(
    "🚀 مراجعة النشر\n\n" +
    `📝 المنشور:\n${message.content}\n\n` +
    "التوقيع:\n" +
    SIGNATURE +
    "\n\n" +
    `📣 الوجهات المضافة: ${groups.length}\n` +
    `✅ المختارة: ${selectedGroups.length}\n\n` +
    "يمكنك تغيير الوجهات من «مجموعاتي».",
    {
      reply_markup:
        new InlineKeyboard()
          .text(
            "🚀 نشر الآن",
            `publish_saved:${message.id}`
          )
          .row()
          .text(
            "📣 مجموعاتي",
            `ag:${message.telegram_account_id}`
          )
          .row()
          .text(
            "↩️ المنشورات",
            `rp:${message.telegram_account_id}`
          )
          .row()
          .text(
            "🏠 الرئيسية",
            "dashboard"
          )
    }
  );
}

export async function showMyMessages(
  ctx: BotContext,
  accountId: string
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const {
    data,
    error
  } = await supabase
    .from("messages")
    .select(
      "id,content,created_at,status"
    )
    .eq(
      "user_id",
      user.id
    )
    .eq(
      "telegram_account_id",
      accountId
    )
    .neq(
      "status",
      "deleted"
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(20);

  if (error) {
    console.error(
      "SHOW MY MESSAGES ERROR:",
      error.message
    );

    await ctx.reply(
      "❌ تعذر تحميل المنشورات.",
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

  if (!data?.length) {
    await ctx.reply(
      "🗂 إدارة المنشورات\n\n" +
      "لا توجد منشورات محفوظة لهذا الحساب.",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "➕ إضافة منشور",
              `mnew:${accountId}`
            )
            .row()
            .text(
              "↩️ رجوع",
              "create_message"
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

  const keyboard =
    new InlineKeyboard();

  /*
   * مهم جداً:
   * لا نستخدم محتوى المنشور داخل زر Telegram.
   * نستخدم اسم ثابت فقط لتجنب مشكلة UTF-8.
   */

  for (
    const [index, message]
    of data.entries()
  ) {
    keyboard
      .text(
        `منشور ${index + 1}`,
        `mview:${message.id}`
      )
      .text(
        "🗑 حذف",
        `mdel:${message.id}`
      )
      .row();
  }

  keyboard
    .text(
      "➕ إضافة منشور",
      `mnew:${accountId}`
    )
    .row()
    .text(
      "🏠 الرئيسية",
      "dashboard"
    );

  await ctx.reply(
    "🗂 إدارة المنشورات\n\n" +
    `📚 عدد المنشورات: ${data.length}\n\n` +
    "اختر المنشور لعرضه، أو اضغط حذف لإزالته.",
    {
      reply_markup:
        keyboard
    }
  );
}

export async function viewMyMessage(
  ctx: BotContext,
  messageId: string
) {
  if (!ctx.from) return;

  const user =
    await getUserByTelegramId(
      ctx.from.id
    );

  if (!user) return;

  const {
    data: message,
    error
  } = await supabase
    .from("messages")
    .select(
      "id,content,telegram_account_id,status"
    )
    .eq(
      "id",
      messageId
    )
    .eq(
      "user_id",
      user.id
    )
    .single();

  if (
    error ||
    !message
  ) {
    await ctx.answerCallbackQuery({
      text:
        "❌ المنشور غير موجود.",
      show_alert: true
    });

    return;
  }

  await ctx.answerCallbackQuery();

  await ctx.reply(
    "📝 تفاصيل المنشور\n\n" +
    "────────────\n" +
    message.content +
    "\n────────────\n\n" +
    "التوقيع:\n" +
    "نشر تلقائي: @postrush_bot",
    {
      reply_markup:
        new InlineKeyboard()
          .text(
            "▶️ تشغيل",
            `pm:${message.id}`
          )
          .row()
          .text(
            "🗑 حذف",
            `mdel:${message.id}`
          )
          .row()
          .text(
            "↩️ إدارة المنشورات",
            `mm:${message.telegram_account_id}`
          )
          .text(
            "🏠 الرئيسية",
            "dashboard"
          )
    }
  );
}

export async function startMyMessages(
  ctx: BotContext
) {
  if (!ctx.from) return;

  await ctx.answerCallbackQuery().catch(() => {});

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
      "📝 منشوراتي\n\n" +
      "لا يوجد حساب Telegram مرتبط.",
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
    await showMyMessages(ctx, accounts[0].id);
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
        `mmc:${account.id}`
      )
      .row();
  }

  keyboard.text(
    "🏠 الرئيسية",
    "dashboard"
  );

  await ctx.answerCallbackQuery()
    .catch(() => {});

  await ctx.reply(
    "📝 منشوراتي\n\n" +
    "اختر الحساب:",
    {
      reply_markup:
        keyboard
    }
  );
}
