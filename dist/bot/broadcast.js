import { InlineKeyboard } from "grammy";
import { bot } from "./index.js";
import { isAdmin } from "../services/admin.js";
import { getAdminAction, clearAdminAction } from "../services/adminChannels.js";
import { startAdminActionExclusive } from "../services/actionManager.js";
import { runBroadcast, getUserCount } from "../services/broadcast.js";
/*
 * حالة مؤقتة في الذاكرة (نفس نمط pendingLogins / pendingChatAdd) —
 * معاينة الرسالة قبل الإرسال الفعلي لكل المستخدمين.
 */
const pendingBroadcasts = new Map();
const EXPIRY_MS = 15 * 60 * 1000;
function setPending(telegramId, content) {
    pendingBroadcasts.set(telegramId, { content, createdAt: Date.now() });
}
function getPending(telegramId) {
    const item = pendingBroadcasts.get(telegramId);
    if (!item)
        return null;
    if (Date.now() - item.createdAt > EXPIRY_MS) {
        pendingBroadcasts.delete(telegramId);
        return null;
    }
    return item;
}
function clearPending(telegramId) {
    pendingBroadcasts.delete(telegramId);
}
const MAX_TEXT_LENGTH = 4096;
const MAX_CAPTION_LENGTH = 1024;
export async function startBroadcastCompose(ctx) {
    if (!ctx.from)
        return;
    if (!(await isAdmin(ctx.from.id))) {
        await ctx.answerCallbackQuery({
            text: "⛔ هذا القسم للمشرفين فقط.",
            show_alert: true
        });
        return;
    }
    clearPending(ctx.from.id);
    await startAdminActionExclusive(ctx.from.id, "broadcast_compose");
    await ctx.answerCallbackQuery();
    await ctx.reply("📢 رسالة جماعية\n\n" +
        "أرسل الرسالة التي تريد إرسالها لكل مستخدمي البوت.\n\n" +
        "✏️ نص فقط، أو 🖼 صورة مع تسمية توضيحية (اختيارية).\n\n" +
        "راح أعرض عليك معاينة قبل الإرسال — ما تنرسل تلقائياً.");
}
async function showPreview(ctx, telegramId, content) {
    setPending(telegramId, content);
    await clearAdminAction(telegramId);
    if (content.type === "photo" && content.photoFileId) {
        await ctx.replyWithPhoto(content.photoFileId, {
            caption: content.caption || undefined
        });
    }
    else {
        await ctx.reply(content.text || "");
    }
    const count = await getUserCount();
    await ctx.reply("👆 هذه معاينة الرسالة تماماً كما راح تصل للمستخدمين.\n\n" +
        `📢 سيتم الإرسال لعدد ${count} مستخدم.\n\n` +
        "متأكد من الإرسال؟", {
        reply_markup: new InlineKeyboard()
            .text("✅ إرسال للجميع", "broadcast_confirm")
            .row()
            .text("❌ إلغاء", "broadcast_cancel")
    });
}
/*
 * يُستدعى من adminText.ts فقط بعد ما يتأكد إن adminAction === "broadcast_compose"
 * (نفس نمط الفروع الأخرى بنفس الملف)، فلا حاجة لإعادة التحقق هنا.
 */
export async function handleBroadcastComposeText(ctx, text) {
    if (!ctx.from)
        return;
    const trimmed = text.trim();
    if (!trimmed) {
        await ctx.reply("❌ أرسل نصاً غير فارغ.");
        return;
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
        await ctx.reply(`❌ النص أطول من الحد المسموح (${MAX_TEXT_LENGTH} حرف).`);
        return;
    }
    await showPreview(ctx, ctx.from.id, { type: "text", text: trimmed });
}
/*
 * هذا المعالج الوحيد لرسائل الصور بالبوت حالياً، لذلك يتحقق بنفسه من
 * adminAction (لا يوجد راوتر آخر يمرّر له الصور).
 */
export async function handleBroadcastPhoto(ctx) {
    if (!ctx.from || !ctx.message?.photo?.length)
        return false;
    const action = await getAdminAction(ctx.from.id);
    if (action !== "broadcast_compose")
        return false;
    const caption = ctx.message.caption?.trim() || "";
    if (caption.length > MAX_CAPTION_LENGTH) {
        await ctx.reply(`❌ التسمية التوضيحية أطول من الحد المسموح (${MAX_CAPTION_LENGTH} حرف).`);
        return true;
    }
    const largest = ctx.message.photo[ctx.message.photo.length - 1];
    await showPreview(ctx, ctx.from.id, {
        type: "photo",
        photoFileId: largest.file_id,
        caption
    });
    return true;
}
export async function confirmBroadcast(ctx) {
    if (!ctx.from)
        return;
    if (!(await isAdmin(ctx.from.id))) {
        await ctx.answerCallbackQuery({
            text: "⛔ هذا القسم للمشرفين فقط.",
            show_alert: true
        });
        return;
    }
    const pending = getPending(ctx.from.id);
    if (!pending) {
        await ctx.answerCallbackQuery({
            text: "⚠️ لا توجد رسالة معلّقة (على الأغلب انتهت صلاحيتها، أعد المحاولة).",
            show_alert: true
        });
        return;
    }
    clearPending(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "🚀 بدأ الإرسال..." });
    await ctx.reply("🚀 بدأ إرسال الرسالة الجماعية بالخلفية.\n\n" +
        "ما راح يجمّد البوت — راح أرسل لك تقريراً كاملاً هنا فور الانتهاء.");
    /*
     * لا await مباشر هنا بنفس سبب إصلاح النشر: البث لعدد كبير من المستخدمين
     * قد يأخذ دقائق، فتشغيله بالخلفية يخلي البوت يستمر يخدم بقية المستخدمين
     * بشكل طبيعي أثناء الإرسال.
     */
    void runBroadcast(bot, pending.content)
        .then(async (result) => {
        try {
            await ctx.reply("✅ اكتمل الإرسال الجماعي\n\n" +
                `👥 الإجمالي: ${result.total}\n` +
                `✅ وصلت: ${result.sent}\n` +
                `🚫 حاظرين البوت: ${result.blocked}\n` +
                `❌ فشلت: ${result.failed}`);
        }
        catch (error) {
            console.error("BROADCAST REPORT ERROR:", error);
        }
    })
        .catch(async (error) => {
        console.error("BROADCAST RUN ERROR:", error);
        try {
            await ctx.reply("❌ توقف الإرسال الجماعي بسبب خطأ.\n\n" +
                (error instanceof Error ? error.message : String(error)));
        }
        catch { }
    });
}
export async function cancelBroadcast(ctx) {
    if (!ctx.from)
        return;
    clearPending(ctx.from.id);
    await clearAdminAction(ctx.from.id);
    await ctx.answerCallbackQuery({ text: "تم الإلغاء." });
    await ctx.reply("🗑 تم إلغاء الرسالة الجماعية.");
}
