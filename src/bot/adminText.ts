import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types/bot.js";
import {
  getAdminAction,
  clearAdminAction,
  addMandatoryChannel
} from "../services/adminChannels.js";
import {
  updateAppSetting
} from "../services/settings.js";
import {
  isAdmin
} from "../services/admin.js";
import {
  getUserAction,
  clearUserAction,
  setUserAction
} from "../services/userActions.js";
import {
  beginLogin,
  submitLoginCode,
  submitLoginPassword,
  cancelLogin
} from "../telegram/auth.js";
import {
  getUserByTelegramId
} from "../services/users.js";
import {
  handlePostText
} from "./postFlow.js";
import {
  prepareChatAdd
} from "../services/chatAdd.js";

export async function handleAdminText(
  ctx: BotContext
) {
  if (
    !ctx.from ||
    !ctx.message?.text
  ) {
    return;
  }

  const telegramId =
    ctx.from.id;

  const text =
    ctx.message.text.trim();

  /*
   * ================================
   * إنشاء المنشور
   * ================================
   */

  if (
    await handlePostText(
      ctx,
      text
    )
  ) {
    return;
  }

  /*
   * ================================
   * حساب Telegram
   * ================================
   */

  const userAction =
    await getUserAction(
      telegramId
    );

  /*
   * إضافة مجموعة للحساب
   */
  if (
    userAction?.startsWith("add_chat:")
  ) {
    const accountId =
      userAction.slice(
        "add_chat:".length
      );

    try {
      const user =
        await getUserByTelegramId(
          telegramId
        );

      if (!user) {
        await clearUserAction(
          telegramId
        );
        return;
      }

      const result =
        await prepareChatAdd(
          telegramId,
          user.id,
          accountId,
          text
        );

      await ctx.reply(
        "🔎 تم التحقق من الوجهة.\n\n" +
        `📣 ${result.title}` +
        (
          result.username
            ? `\n🔗 ${result.username}`
            : ""
        ) +
        "\n\n" +
        "هل تريد إضافة هذه المجموعة للحساب؟\n" +
        "لن يتم الانضمام إلا بعد تأكيدك.",
        {
          reply_markup:
            new InlineKeyboard()
              .text(
                "✅ إضافة والانضمام",
                "chat_confirm"
              )
              .row()
              .text(
                "❌ إلغاء",
                "chat_cancel"
              )
        }
      );
    } catch (error) {
      await clearUserAction(
        telegramId
      );

      const { cancelChatAdd } =
        await import(
          "../services/chatAdd.js"
        );

      cancelChatAdd(
        telegramId
      );

      const message =
        error instanceof Error
          ? error.message
          : "";

      await ctx.reply(
        message === "INVALID_CHAT_INPUT"
          ? "❌ أرسل Username أو رابط Telegram صحيح."
          : "❌ لم أتمكن من العثور على هذه المجموعة."
      );
    }

    return;
  }

  if (
    userAction ===
    "telegram_web_login"
  ) {
    await ctx.reply(
      "🌐 أكمل تسجيل حساب Telegram من صفحة الويب التي أرسلتها لك."
    );

    return;
  }

  // ===== تسجيل الدخول بالرقم (تم تعديل هذا القسم فقط) =====
  if (
    userAction ===
    "telegram_phone"
  ) {
    try {
      const user =
        await getUserByTelegramId(
          telegramId
        );

      if (!user) {
        await clearUserAction(
          telegramId
        );
        return;
      }

      const loginInfo =
        await beginLogin(
          user.id,
          telegramId,
          text
        );

      /*
       * لا نمسح الحالة.
       * التسجيل مستمر في الخلفية
       * وينتظر الكود.
       */
      await setUserAction(
        telegramId,
        "telegram_code"
      );

      const deliveryMessage =
        loginInfo.deliveredToApp
          ? (
              "📨 تم طلب رمز تسجيل الدخول عبر Telegram.\n\n" +
              "📱 افتح Telegram على الجهاز الذي يوجد عليه الحساب، " +
              "وابحث عن رسالة تسجيل الدخول من Telegram.\n\n" +
              "⚠️ قد لا يصل الرمز عبر SMS في هذه الحالة."
            )
          : (
              "📲 تم طلب رمز تسجيل الدخول.\n\n" +
              "تحقق من SMS وأي وسيلة تحقق يعرضها Telegram لهذا الرقم."
            );

      await ctx.reply(
        deliveryMessage +
        "\n\n" +
        "🔢 عند وصول الرمز أرسله هنا بهذا الشكل:\n" +
        "4 7 0 9 8\n\n" +
        "🔐 لا تشارك رمز Telegram مع أي شخص."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "UNKNOWN";

      cancelLogin(
        telegramId
      );

      await clearUserAction(
        telegramId
      );

      if (
        message ===
        "INVALID_PHONE"
      ) {
        await ctx.reply(
          "❌ رقم الهاتف غير صحيح.\n\n" +
          "مثال:\n" +
          "964******"
        );
        return;
      }

      if (
        message ===
        "TELEGRAM_API_NOT_CONFIGURED"
      ) {
        await ctx.reply(
          "⚠️ تسجيل حساب Telegram غير مفعّل."
        );
        return;
      }

      if (
        message ===
        "TELEGRAM_EMAIL_VERIFICATION_REQUIRED"
      ) {
        await ctx.reply(
          "⚠️ هذا الحساب يتطلب التحقق عبر البريد الإلكتروني، وهو غير مدعوم حالياً.\n" +
          "جرّب حساباً آخر."
        );
        return;
      }

      await ctx.reply(
        "❌ تعذر بدء تسجيل الحساب.\n\n" +
        "حاول مرة أخرى."
      );

      console.error(
        "PHONE LOGIN ERROR:",
        error
      );
    }

    return;
  }

  if (
    userAction ===
    "telegram_code"
  ) {
    try {
      await ctx.reply(
        "⏳ جاري التحقق من رمز Telegram..."
      );

      const result =
        await submitLoginCode(
          telegramId,
          text
        );

      if (
        result.status ===
        "password"
      ) {
        /*
         * auth.ts غيّر الحالة إلى
         * telegram_password.
         */
        await ctx.reply(
          "🔐 الحساب محمي بالتحقق بخطوتين.\n\n" +
          "أرسل الآن كلمة مرور 2FA الخاصة بحسابك.\n\n" +
          "لن يتم حفظ كلمة المرور."
        );

        return;
      }

      if (
        result.status ===
        "completed"
      ) {
        await clearUserAction(
          telegramId
        );

        await ctx.reply(
          "🎉 تم تسجيل حساب Telegram بنجاح!\n\n" +
          "✅ الحساب أصبح مرتبطاً بحسابك في نشر تلقائي."
        );

        return;
      }

      if (
        result.status ===
        "failed"
      ) {
        throw result.error;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message.includes(
          "PHONE_CODE_INVALID"
        )
      ) {
        await ctx.reply(
          "❌ الرمز غير صحيح.\n\n" +
          "أرسله بهذا الشكل:\n" +
          "4 7 0 9 8"
        );

        return;
      }

      if (
        message.includes(
          "PHONE_CODE_EXPIRED"
        )
      ) {
        cancelLogin(
          telegramId
        );

        await clearUserAction(
          telegramId
        );

        await ctx.reply(
          "⏳ انتهت صلاحية رمز Telegram.\n\n" +
          "اضغط «➕ إضافة حساب» واطلب رمزاً جديداً."
        );

        return;
      }

      cancelLogin(
        telegramId
      );

      await clearUserAction(
        telegramId
      );

      await ctx.reply(
        "❌ تعذر تسجيل الدخول.\n\n" +
        "ابدأ عملية إضافة الحساب من جديد."
      );

      console.error(
        "CODE LOGIN ERROR:",
        error
      );
    }

    return;
  }

  if (
    userAction ===
    "telegram_password"
  ) {
    try {
      await ctx.reply(
        "⏳ جاري التحقق من كلمة مرور 2FA..."
      );


      const result =
        await submitLoginPassword(
          telegramId,
          text
        );

      if (
        result.status ===
        "completed"
      ) {
        await clearUserAction(
          telegramId
        );

        await ctx.reply(
          "🎉 تم تسجيل حساب Telegram بنجاح!\n\n" +
          "✅ الحساب أصبح مرتبطاً بحسابك في نشر تلقائي."
        );

        return;
      }

      if (
        result.status ===
        "password"
      ) {
        await ctx.reply(
          "🔐 ما زال الحساب يطلب كلمة مرور 2FA."
        );

        return;
      }

      if (
        result.status ===
        "failed"
      ) {
        throw result.error;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message.includes(
          "PASSWORD_HASH_INVALID"
        )
      ) {
        await ctx.reply(
          "❌ كلمة مرور 2FA غير صحيحة.\n\n" +
          "أرسلها مرة أخرى."
        );

        return;
      }

      cancelLogin(
        telegramId
      );

      await clearUserAction(
        telegramId
      );

      await ctx.reply(
        "❌ تعذر إكمال تسجيل الدخول.\n\n" +
        "ابدأ عملية إضافة الحساب من جديد."
      );

      console.error(
        "2FA ERROR:",
        error
      );
    }

    return;
  }

  /*
   * ================================
   * ADMIN
   * ================================
   */

  if (
    !(await isAdmin(telegramId))
  ) {
    return;
  }

  const adminAction =
    await getAdminAction(
      telegramId
    );

  if (!adminAction) {
    return;
  }

  /*
   * VIP grant — تتم معالجته مباشرة
   * قبل بقية إعدادات النص حتى لا يسقط
   * بصمت بسبب أي setting map آخر.
   */
  if (
    adminAction ===
    "vip_grant"
  ) {
    const parts =
      text
        .trim()
        .split(/\s+/);

    if (
      parts.length < 2
    ) {
      await ctx.reply(
        "❌ الصيغة الصحيحة:\n\n" +
        "Telegram ID + عدد الأيام\n\n" +
        "مثال:\n" +
        "8557464787 30"
      );

      return;
    }

    const targetId =
      Number(
        parts[0]
      );

    const days =
      Number(
        parts[1]
      );

    if (
      !Number.isSafeInteger(
        targetId
      ) ||
      targetId <= 0
    ) {
      await ctx.reply(
        "❌ Telegram ID غير صحيح."
      );

      return;
    }

    if (
      !Number.isInteger(
        days
      ) ||
      days <= 0 ||
      days > 3650
    ) {
      await ctx.reply(
        "❌ عدد الأيام يجب أن يكون بين 1 و3650."
      );

      return;
    }

    try {
      const {
        grantVip
      } = await import(
        "../services/adminManagement.js"
      );

      const expires =
        await grantVip(
          telegramId,
          targetId,
          days
        );

      await clearAdminAction(
        telegramId
      );

      await ctx.reply(
        "✅ تم منح VIP بنجاح.\n\n" +
        `👤 Telegram ID: ${targetId}\n` +
        `⭐ المدة: ${days} يوم\n` +
        `📅 الانتهاء: ${expires.toISOString()}`
      );
    } catch (error) {
      console.error(
        "VIP GRANT ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        message ===
        "USER_NOT_FOUND"
      ) {
        await ctx.reply(
          "❌ المستخدم غير موجود في قاعدة البيانات.\n\n" +
          "يجب أن يبدأ المستخدم البوت أولاً."
        );
      } else {
        await ctx.reply(
          "❌ فشل منح VIP.\n\n" +
          message
        );
      }
    }

    return;
  }

  if (
    adminAction ===
    "add_mandatory_channel"
  ) {
    try {
      const channel =
        await addMandatoryChannel(
          text
        );

      await clearAdminAction(
        telegramId
      );

      await ctx.reply(
        "✅ تمت إضافة القناة بنجاح.\n\n" +
        `📢 ${channel.title || "بدون اسم"}\n` +
        `🔗 ${channel.username || channel.chat_id}`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "UNKNOWN";

      const errors: Record<
        string,
        string
      > = {
        CHANNEL_NOT_FOUND:
          "❌ لم أتمكن من العثور على القناة.",
        NOT_CHANNEL:
          "❌ هذا المعرف ليس قناة.",
        BOT_NOT_IN_CHANNEL:
          "❌ البوت غير موجود في القناة.",
        BOT_NOT_ADMIN:
          "❌ يجب أن يكون البوت مسؤولاً في القناة.",
        CHANNEL_EXISTS:
          "⚠️ هذه القناة مضافة مسبقاً."
      };

      await ctx.reply(
        errors[message] ||
        "❌ حدث خطأ أثناء إضافة القناة."
      );
    }

    return;
  }

  /*
   * ================================
   * إدارة المشرفين
   * ================================
   */

  if (
    adminAction ===
    "admin_add"
  ) {
    if (
      !(await (
        await import("../services/admin.js")
      ).isOwner(telegramId))
    ) {
      await clearAdminAction(
        telegramId
      );

      await ctx.reply(
        "⛔ هذا الخيار للـOwner فقط."
      );

      return;
    }

    const targetTelegramId =
      Number(
        text.trim()
      );

    if (
      !Number.isSafeInteger(
        targetTelegramId
      ) ||
      targetTelegramId <= 0
    ) {
      await ctx.reply(
        "❌ Telegram ID غير صحيح.\n\n" +
        "أرسل ID رقمي صحيح."
      );

      return;
    }

    try {
      const {
        addAdmin
      } = await import(
        "../services/adminManagement.js"
      );

      await addAdmin(
        targetTelegramId
      );

      await clearAdminAction(
        telegramId
      );

      await ctx.reply(
        "✅ تم إضافة المشرف بنجاح.\n\n" +
        `🆔 Telegram ID: ${targetTelegramId}\n` +
        "🛡 الصلاحية: Admin"
      );
    } catch (error) {
      console.error(
        "ADMIN ADD ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message ===
        "USER_NOT_FOUND"
      ) {
        await ctx.reply(
          "❌ لم أجد هذا المستخدم.\n\n" +
          "يجب أن يكون قد بدأ البوت أولاً."
        );
      } else {
        await ctx.reply(
          "❌ تعذر إضافة المشرف.\n\n" +
          message
        );
      }
    }

    return;
  }

  if (
    adminAction ===
    "admin_remove"
  ) {
    if (
      !(await (
        await import("../services/admin.js")
      ).isOwner(telegramId))
    ) {
      await clearAdminAction(
        telegramId
      );

      await ctx.reply(
        "⛔ هذا الخيار للـOwner فقط."
      );

      return;
    }

    const targetTelegramId =
      Number(
        text.trim()
      );

    if (
      !Number.isSafeInteger(
        targetTelegramId
      ) ||
      targetTelegramId <= 0
    ) {
      await ctx.reply(
        "❌ Telegram ID غير صحيح."
      );

      return;
    }

    try {
      const {
        removeAdmin
      } = await import(
        "../services/adminManagement.js"
      );

      await removeAdmin(
        targetTelegramId
      );

      await clearAdminAction(
        telegramId
      );

      await ctx.reply(
        "✅ تمت إزالة المشرف بنجاح.\n\n" +
        `🆔 Telegram ID: ${targetTelegramId}`
      );
    } catch (error) {
      console.error(
        "ADMIN REMOVE ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message ===
        "CANNOT_REMOVE_OWNER"
      ) {
        await ctx.reply(
          "⛔ لا يمكن إزالة الـOwner."
        );
      } else if (
        message ===
        "USER_NOT_FOUND"
      ) {
        await ctx.reply(
          "❌ المستخدم غير موجود."
        );
      } else {
        await ctx.reply(
          "❌ تعذر إزالة المشرف.\n\n" +
          message
        );
      }
    }

    return;
  }

  const settingMap:
    Record<
      string,
      {
        key:
          | "free_group_limit"
          | "vip_group_limit"
          | "free_account_limit"
          | "vip_account_limit"
          | "free_message_limit"
          | "vip_message_limit"
          | "free_daily_runs"
          | "vip_daily_runs"
          | "free_cycle_limit"
          | "vip_cycle_limit"
          | "free_cycle_delay_minutes"
          | "vip_cycle_delay_minutes"
          | "message_delay_minutes"
          | "referral_7_vip_days"
          | "referral_20_vip_days"
          | "vip_price_usdt";
        label: string;
        integer: boolean;
        min: number;
        max: number;
      }
    > = {
      set_free_groups: {
        key: "free_group_limit",
        label: "حد مجموعات Free",
        integer: true,
        min: 1,
        max: 1000
      },

      set_vip_groups: {
        key: "vip_group_limit",
        label: "حد مجموعات VIP",
        integer: true,
        min: 1,
        max: 10000
      },

      set_free_accounts: {
        key: "free_account_limit",
        label: "حد حسابات Free",
        integer: true,
        min: 1,
        max: 50
      },

      set_vip_accounts: {
        key: "vip_account_limit",
        label: "حد حسابات VIP",
        integer: true,
        min: 1,
        max: 100
      },

      set_free_message: {
        key: "free_message_limit",
        label: "حد أحرف منشور Free",
        integer: true,
        min: 1,
        max: 4096
      },

      set_vip_message: {
        key: "vip_message_limit",
        label: "حد أحرف منشور VIP",
        integer: true,
        min: 1,
        max: 4096
      },

      set_free_daily_runs: {
        key: "free_daily_runs",
        label: "التشغيلات اليومية لـ Free",
        integer: true,
        min: 1,
        max: 100
      },

      set_vip_daily_runs: {
        key: "vip_daily_runs",
        label: "التشغيلات اليومية لـ VIP",
        integer: true,

        min: 1,
        max: 100
      },

      set_free_cycles: {
        key: "free_cycle_limit",
        label: "دورات Free لكل تشغيل",
        integer: true,
        min: 1,
        max: 1000
      },

      set_vip_cycles: {
        key: "vip_cycle_limit",
        label: "دورات VIP لكل تشغيل",
        integer: true,
        min: 1,
        max: 10000
      },

      set_free_cycle_delay: {
        key: "free_cycle_delay_minutes",
        label: "انتظار الدورات لـ Free",
        integer: true,
        min: 0,
        max: 1440
      },

      set_vip_cycle_delay: {
        key: "vip_cycle_delay_minutes",
        label: "انتظار الدورات لـ VIP",
        integer: true,
        min: 0,
        max: 1440
      },

      set_message_delay: {
        key: "message_delay_minutes",
        label: "التأخير بين الرسائل",
        integer: true,
        min: 0,
        max: 1440
      },

      set_referral_7: {
        key: "referral_7_vip_days",
        label: "مكافأة 7 إحالات",
        integer: true,
        min: 1,
        max: 3650
      },

      set_referral_20: {
        key: "referral_20_vip_days",
        label: "مكافأة 20 إحالة",
        integer: true,
        min: 1,
        max: 3650
      },

      set_vip_price: {
        key: "vip_price_usdt",
        label: "سعر VIP",
        integer: false,
        min: 0.01,
        max: 100000
      }
    };

  const setting =
    settingMap[adminAction];

  if (setting) {
    const value =
      Number(
        text
          .trim()
          .replace(",", ".")
      );

    if (!Number.isFinite(value)) {
      await ctx.reply(
        "❌ أرسل رقماً صحيحاً."
      );
      return;
    }

    if (
      setting.integer &&
      !Number.isInteger(value)
    ) {
      await ctx.reply(
        "❌ يجب أن يكون الرقم عدداً صحيحاً."
      );
      return;
    }

    if (
      value < setting.min ||
      value > setting.max
    ) {
      await ctx.reply(
        `❌ القيمة يجب أن تكون بين ${setting.min} و ${setting.max}.`
      );
      return;
    }

    try {
      await updateAppSetting(
        setting.key,
        value
      );

      await clearAdminAction(
        telegramId
      );

      await ctx.reply(
        "✅ تم التحديث بنجاح.\n\n" +
        `⚙️ ${setting.label}\n` +
        `🔢 القيمة الجديدة: ${value}`,
        {
          reply_markup:
            new InlineKeyboard()
              .text(
                "⚙️ إعدادات النظام",
                "admin_settings"
              )
              .row()
              .text(
                "👑 لوحة الإدارة",
                "admin_panel"
              )
        }
      );
    } catch (error) {
      console.error(
        "SETTING UPDATE ERROR:",
        error
      );

      await ctx.reply(
        "❌ فشل حفظ الإعداد في قاعدة البيانات."
      );
    }

    return;
  }
}
