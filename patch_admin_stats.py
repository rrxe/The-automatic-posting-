import sys

path = "src/bot/adminExtras.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old1 = '''import {
  findUser,
  grantVip,
  revokeVip,
  addAdmin,
  removeAdmin,
  getAdmins,
  getStats
} from "../services/adminManagement.js";
'''

new1 = '''import {
  findUser,
  grantVip,
  revokeVip,
  addAdmin,
  removeAdmin,
  getAdmins,
  getStats
} from "../services/adminManagement.js";

import {
  getPublishQueueStats
} from "../services/publishQueue.js";

import {
  getActiveTelegramClientCount
} from "../telegram/clientManager.js";
'''

old2 = '''  if (
    action === "admin_stats"
  ) {
    const stats =
      await getStats();

    await ctx.answerCallbackQuery();

    await ctx.reply(
      "📊 إحصائيات المشروع\\n\\n" +
        `👥 المستخدمون: ${stats.users}\\n` +
        `⭐ VIP: ${stats.vip}\\n` +
        `📱 الحسابات: ${stats.accounts}\\n` +
        `📣 المجموعات اليدوية: ${stats.groups}\\n` +
        `🚀 عمليات النشر: ${stats.runs}`,
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "↩️ لوحة الإدارة",
              "admin_panel"
            )
      }
    );

    return true;'''

new2 = '''  if (
    action === "admin_stats"
  ) {
    const stats =
      await getStats();

    const queueStats =
      getPublishQueueStats();

    const activeClients =
      getActiveTelegramClientCount();

    await ctx.answerCallbackQuery();

    await ctx.reply(
      "📊 إحصائيات المشروع\\n\\n" +
        `👥 المستخدمون: ${stats.users}\\n` +
        `⭐ VIP: ${stats.vip}\\n` +
        `📱 الحسابات: ${stats.accounts}\\n` +
        `📣 المجموعات اليدوية: ${stats.groups}\\n` +
        `🚀 عمليات النشر: ${stats.runs}\\n\\n` +
        "⚙️ الموارد الحية:\\n" +
        `🔄 تشغيلات شغالة الآن: ${queueStats.running} / ${queueStats.maxConcurrent}\\n` +
        `⏳ تشغيلات بالطابور: ${queueStats.queued}\\n` +
        `📡 اتصالات Telegram مفتوحة: ${activeClients}`,
      {
        reply_markup:
          new InlineKeyboard()
            .text(
              "↩️ لوحة الإدارة",
              "admin_panel"
            )
      }
    );

    return true;'''

for old, new, name in [(old1, new1, "استيراد الدوال"), (old2, new2, "شاشة الإحصائيات")]:
    count = content.count(old)
    if count != 1:
        print(f"FAILED: '{name}' found {count} times (expected 1). Aborting, no changes written.")
        sys.exit(1)
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("تم تحديث adminExtras.ts بنجاح")
