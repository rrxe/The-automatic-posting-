import sys

path = "src/bot/callbacks.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old1 = '''    if (!message) {
      await ctx.answerCallbackQuery({
        text:
          "❌ المنشور غير موجود.",
        show_alert:
          true
      });

      return;
    }

    const {
      data: groups
    } = await supabase
      .from("user_groups")'''

new1 = '''    if (!message) {
      await ctx.answerCallbackQuery({
        text:
          "❌ المنشور غير موجود.",
        show_alert:
          true
      });

      return;
    }

    const {
      hasActiveRun
    } = await import(
      "../services/publishControl.js"
    );

    const alreadyRunning =
      await hasActiveRun(
        user.id,
        message.telegram_account_id
      );

    if (alreadyRunning) {
      await ctx.answerCallbackQuery({
        text:
          "⚠️ يوجد تشغيل قيد التنفيذ بالفعل لهذا الحساب. أوقفه أولاً قبل بدء تشغيل جديد.",
        show_alert:
          true
      });

      return;
    }

    const {
      data: groups
    } = await supabase
      .from("user_groups")'''

old2 = '''      await ctx.reply(
        "🚀 بدأ التشغيل\\n\\n" +
        `🔄 الدورات: ${cycleLimit}\\n` +
        `⏱ الانتظار بين الدورات: ${delay} دقائق\\n` +
        `📣 الوجهات: ${groups.length}\\n\\n` +
        "كل دورة ترسل إلى جميع الوجهات المختارة.",
        {
          reply_markup:
            new InlineKeyboard()
              .text(
                "🏠 الرئيسية",
                "dashboard"
              )
        }
      );'''

new2 = '''      await ctx.reply(
        "🚀 بدأ التشغيل\\n\\n" +
        `🔄 الدورات: ${cycleLimit}\\n` +
        `⏱ الانتظار بين الدورات: ${delay} دقائق\\n` +
        `📣 الوجهات: ${groups.length}\\n\\n` +
        "كل دورة ترسل إلى جميع الوجهات المختارة.\\n" +
        "يمكنك إيقاف العملية الحالية من الزر أدناه.",
        {
          reply_markup:
            new InlineKeyboard()
              .text(
                "⏹ إيقاف",
                `stop:${run.runId}`
              )
              .row()
              .text(
                "🏠 الرئيسية",
                "dashboard"
              )
        }
      );'''

for old, new, name in [(old1, new1, "منع التشغيل المزدوج"), (old2, new2, "زر الإيقاف")]:
    count = content.count(old)
    if count != 1:
        print(f"FAILED: '{name}' found {count} times (expected 1). Aborting, no changes written.")
        sys.exit(1)
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("تم تطبيق التعديلين بنجاح على callbacks.ts")
