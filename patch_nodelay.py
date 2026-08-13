import sys

path = "src/bot/callbacks.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old1 = '''  if (
    action?.startsWith("pdelay:")
  ) {
    const parts =
      action.split(":");

    const messageId =
      parts[1];

    const delay =
      Number(parts[2]);

    if (
      ![2, 5, 7].includes(
        delay
      )
    ) {
      await ctx.answerCallbackQuery({
        text:
          "❌ قيمة التأخير غير صالحة.",
        show_alert:
          true
      });

      return;
    }

    const {
      getUserByTelegramId
    } = await import(
      "../services/users.js"
    );

    const {
      getAppSettings
    } = await import(
      "../services/settings.js"
    );

    const {
      supabase
    } = await import(
      "../db/supabase.js"
    );

    const {
      getUserTelegramAccounts
    } = await import(
      "../telegram/clientManager.js"
    );

    const user =
      await getUserByTelegramId(
        ctx.from.id
      );

    if (!user) {
      return;
    }

    const {
      data: message
    } = await supabase
      .from("messages")
      .select(
        "id, content, telegram_account_id"
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

    if (!message) {
      await ctx.answerCallbackQuery({
        text:
          "❌ المنشور غير موجود.",
        show_alert:
          true
      });

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

    const cycleLimit =
      vip
        ? settings.vip_cycle_limit
        : settings.free_cycle_limit;

    const accounts =
      await getUserTelegramAccounts(
        user.id
      );

    const account =
      accounts.find(
        (item) =>
          item.id ===
          message.telegram_account_id
      );

    const accountName =
      account?.username
        ? `@${account.username}`
        : account?.display_name ||
          account?.phone_hint ||
          "الحساب";

    await ctx.answerCallbackQuery({
      text:
        `✅ تم اختيار ${delay} دقائق.`
    });

    await ctx.reply(
      "🚀 إعداد التشغيل\\n\\n" +
      `📱 الحساب: ${accountName}\\n` +
      `📝 المنشور: ${String(message.content).slice(0, 80)}\\n\\n` +
      `🔄 عدد الدورات: ${cycleLimit}\\n` +
      `⏱ الانتظار بين الدورات: ${delay} دقائق\\n\\n` +
      "كل دورة ترسل المنشور إلى جميع الوجهات المختارة.",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              `2 دقائق${delay === 2 ? " ✅" : ""}`,
              `pdelay:${messageId}:2`
            )
            .text(
              `5 دقائق${delay === 5 ? " ✅" : ""}`,
              `pdelay:${messageId}:5`
            )
            .text(
              `7 دقائق${delay === 7 ? " ✅" : ""}`,
              `pdelay:${messageId}:7`
            )
            .row()
            .text(
              "🚀 بدء التشغيل",
              `pstart:${messageId}:${delay}`
            )
            .row()
            .text(
              "↩️ المنشور",
              `pm:${messageId}`
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

  if (
    action?.startsWith("pstart:")
  ) {'''

new1 = '''  if (
    action?.startsWith("pstart:")
  ) {'''

old2 = '''    const delay =
      Number(parts[2]);

    if (
      ![2, 5, 7].includes(
        delay
      )
    ) {
      await ctx.answerCallbackQuery({
        text:
          "❌ قيمة التأخير غير صالحة.",
        show_alert:
          true
      });

      return;
    }

    const {
      getUserByTelegramId
    } = await import(
      "../services/users.js"'''

new2 = '''    const delay =
      Number(parts[2]);

    if (
      !Number.isFinite(delay) ||
      delay <= 0
    ) {
      await ctx.answerCallbackQuery({
        text:
          "❌ قيمة التأخير غير صالحة.",
        show_alert:
          true
      });

      return;
    }

    const {
      getUserByTelegramId
    } = await import(
      "../services/users.js"'''

old3 = '''    await ctx.reply(
      "🚀 إعداد التشغيل\\n\\n" +
      `📱 الحساب: ${accountName}\\n` +
      `📝 المنشور: ${String(message.content).slice(0, 80)}\\n\\n` +
      `🔄 عدد الدورات: ${cycleLimit}\\n\\n` +
      `⏱ الانتظار بين الدورات: ${defaultDelay} دقائق\\n\\n` +
      "اختر الانتظار بين الدورات:",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              `2 دقائق${defaultDelay === 2 ? " ✅" : ""}`,
              `pdelay:${messageId}:2`
            )
            .text(
              `5 دقائق${defaultDelay === 5 ? " ✅" : ""}`,
              `pdelay:${messageId}:5`
            )
            .text(
              `7 دقائق${defaultDelay === 7 ? " ✅" : ""}`,
              `pdelay:${messageId}:7`
            )
            .row()
            .text(
              "🚀 بدء التشغيل",
              `pstart:${messageId}:${defaultDelay}`
            )
            .row()
            .text(
              "↩️ المنشور",
              `pm:${messageId}`
            )
            .row()
            .text(
              "🏠 الرئيسية",
              "dashboard"
            )
      }
    );

    return;
  }'''

new3 = '''    await ctx.reply(
      "🚀 إعداد التشغيل\\n\\n" +
      `📱 الحساب: ${accountName}\\n` +
      `📝 المنشور: ${String(message.content).slice(0, 80)}\\n\\n` +
      `🔄 عدد الدورات: ${cycleLimit}\\n` +
      `⏱ الانتظار بين الدورات: ${defaultDelay} دقائق\\n\\n` +
      "كل دورة ترسل المنشور إلى جميع الوجهات المختارة.",
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "🚀 بدء التشغيل",
              `pstart:${messageId}:${defaultDelay}`
            )
            .row()
            .text(
              "↩️ المنشور",
              `pm:${messageId}`
            )
            .row()
            .text(
              "🏠 الرئيسية",
              "dashboard"
            )
      }
    );

    return;
  }'''

for old, new, name in [(old1, new1, "حذف شاشة pdelay"), (old2, new2, "تصحيح فحص delay"), (old3, new3, "حذف أزرار الشاشة الثانية")]:
    count = content.count(old)
    if count != 1:
        print(f"FAILED: '{name}' found {count} times (expected 1). Aborting, no changes written.")
        sys.exit(1)
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("تم حذف اختيار التأخير من المستخدم بنجاح")
