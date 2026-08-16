import { Bot, GrammyError } from "grammy";
import type { BotContext } from "../types/bot.js";
import { supabase } from "../db/supabase.js";

export interface BroadcastContent {
  type: "text" | "photo";
  text?: string;
  photoFileId?: string;
  caption?: string;
}

export interface BroadcastResult {
  total: number;
  sent: number;
  blocked: number;
  failed: number;
}

const PAGE_SIZE = 1000;

/*
 * جلب Telegram ID لكل المستخدمين، صفحة بصفحة، حتى لا نحمّل كل الجدول
 * دفعة وحدة إذا كبر عدد المستخدمين مستقبلاً.
 */
export async function getAllUserTelegramIds(): Promise<number[]> {
  const ids: number[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("users")
      .select("telegram_id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      if (typeof row.telegram_id === "number") {
        ids.push(row.telegram_id);
      }
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return ids;
}

export async function getUserCount(): Promise<number> {
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function sendOne(
  bot: Bot<BotContext>,
  telegramId: number,
  content: BroadcastContent
) {
  if (content.type === "photo" && content.photoFileId) {
    await bot.api.sendPhoto(telegramId, content.photoFileId, {
      caption: content.caption || undefined
    });
  } else {
    await bot.api.sendMessage(telegramId, content.text || "");
  }
}

/*
 * لا تُستدعى هذه الدالة بـ await مباشرة داخل معالج رسالة/زر — البث لعدد
 * كبير من المستخدمين قد يأخذ دقائق، وانتظاره مباشرة يجمّد البوت (نفس
 * الخطأ الذي حصل مع النشر قبل إصلاحه). شغّلها بالخلفية (.then/.catch)
 * وأرسل نتيجتها كرسالة منفصلة عند الانتهاء.
 */
export async function runBroadcast(
  bot: Bot<BotContext>,
  content: BroadcastContent,
  onProgress?: (sent: number, total: number) => void
): Promise<BroadcastResult> {
  const ids = await getAllUserTelegramIds();

  let sent = 0;
  let blocked = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    const telegramId = ids[i];

    try {
      await sendOne(bot, telegramId, content);
      sent++;
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 429) {
        /*
         * تجاوزنا حد Telegram — ننتظر المدة التي تطلبها Telegram بالضبط
         * (retry_after) ثم نعيد المحاولة مرة واحدة لهذا المستخدم فقط.
         */
        const retryAfterMs = (error.parameters?.retry_after ?? 2) * 1000;
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));

        try {
          await sendOne(bot, telegramId, content);
          sent++;
        } catch {
          failed++;
        }
      } else if (
        error instanceof GrammyError &&
        (error.error_code === 403 || error.error_code === 400)
      ) {
        /*
         * 403: المستخدم حظر البوت أو حذف حسابه.
         * 400: محادثة غير موجودة (نفس الحالة عملياً). متوقعة وليست خطأ حقيقي.
         */
        blocked++;
      } else {
        failed++;
        console.error("BROADCAST SEND ERROR:", {
          telegramId,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    onProgress?.(sent + blocked + failed, ids.length);

    /*
     * تأخير بسيط بين كل رسالتين لتفادي حدود Telegram (نحو 30 رسالة/ثانية
     * لمحادثات مختلفة).
     */
    if (i < ids.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  }

  await
supabase.from("audit_logs").insert({
    actor_user_id: null,
    action: "broadcast",
    target_user_id: null,
    metadata: { total: ids.length, sent, blocked, failed }
  });

  return { total: ids.length, sent, blocked, failed };
}
