import { InlineKeyboard } from "grammy";
import { getUserByTelegramId } from "../services/users.js";
import { getUserTelegramAccounts } from "../telegram/clientManager.js";
import { getAccountGroups } from "../services/groups.js";
import { getAppSettings } from "../services/settings.js";
import { createDraft, getLatestDraft, getDraft, updateDraftContent, toggleDraftGroup, deleteDraft, markDraftUsed } from "../services/postDrafts.js";
import { createPublishRun, executePublishCycles } from "../services/publish.js";
import { enqueuePublish } from "../services/publishQueue.js";
import { setUserAction, clearUserAction } from "../services/userActions.js";
function isVip(user) {
    return (user?.plan === "vip" &&
        !!user?.vip_expires_at &&
        new Date(user.vip_expires_at) > new Date());
}
function preview(content, signature, enabled) {
    return enabled
        ? `${content}\n\n${signature}`
        : content;
}
export async function startCreatePost(ctx, preferredAccountId) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const accounts = await getUserTelegramAccounts(user.id);
    if (!accounts.length) {
        await ctx.reply("✍️ إنشاء منشور\n\n" +
            "أضف حساب Telegram أولاً.", {
            reply_markup: new InlineKeyboard()
                .text("➕ إضافة حساب", "account_add")
                .row()
                .text("🏠 الرئيسية", "dashboard")
        });
        return;
    }
    if (preferredAccountId) {
        const exists = accounts.some((a) => a.id ===
            preferredAccountId);
        if (exists) {
            await choosePostAccount(ctx, preferredAccountId);
            return;
        }
    }
    const keyboard = new InlineKeyboard();
    for (const account of accounts) {
        const name = account.username
            ? `@${account.username}`
            : account.display_name ||
                account.phone_hint ||
                "الحساب";
        keyboard
            .text(`📱 ${name}`, `pa:${account.id}`)
            .row();
    }
    keyboard.text("🏠 الرئيسية", "dashboard");
    await ctx.reply("✍️ تشغيل النشر\n\n" +
        "اختر الحساب الذي تريد استخدامه:", {
        reply_markup: keyboard
    });
}
export async function choosePostAccount(ctx, accountId) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const accounts = await getUserTelegramAccounts(user.id);
    const exists = accounts.some((a) => a.id === accountId);
    if (!exists) {
        await ctx.answerCallbackQuery({
            text: "❌ الحساب غير موجود.",
            show_alert: true
        });
        return;
    }
    /*
     * نحذف المسودات القديمة
     * للمستخدم حتى لا نضغط على
     * Draft قديم.
     */
    await clearUserAction(ctx.from.id);
    const previous = await getLatestDraft(user.id);
    if (previous) {
        await deleteDraft(user.id, previous.id);
    }
    const draft = await createDraft(user.id, accountId);
    await setUserAction(ctx.from.id, "post_content");
    const settings = await getAppSettings();
    const limit = isVip(user)
        ? settings.vip_message_limit
        : settings.free_message_limit;
    await ctx.answerCallbackQuery();
    await ctx.reply("✍️ إنشاء منشور\n\n" +
        `📦 الباقة: ${isVip(user)
            ? "⭐ VIP"
            : "🆓 مجاني"}\n` +
        `🔢 الحد: ${limit} حرف\n\n` +
        "أرسل نص المنشور الآن.\n\n" +
        "زر «رجوع» متاح من الرسالة التالية.", {
        reply_markup: new InlineKeyboard()
            .text("❌ إلغاء", `pc:${draft.id}`)
            .row()
            .text("🏠 الرئيسية", "dashboard")
    });
}
export async function handlePostText(ctx, text) {
    if (!ctx.from)
        return false;
    const action = await import("../services/userActions.js").then(({ getUserAction }) => getUserAction(ctx.from.id));
    if (action !==
        "post_content") {
        return false;
    }
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return true;
    const draft = await getLatestDraft(user.id);
    if (!draft) {
        await clearUserAction(ctx.from.id);
        await ctx.reply("❌ انتهت جلسة إنشاء المنشور.", {
            reply_markup: new InlineKeyboard()
                .text("✍️ إنشاء منشور", "create_message")
                .row()
                .text("🏠 الرئيسية", "dashboard")
        });
        return true;
    }
    const settings = await getAppSettings();
    const limit = isVip(user)
        ? settings.vip_message_limit
        : settings.free_message_limit;
    const content = text.trim();
    if (!content) {
        await ctx.reply("❌ أرسل نصاً غير فارغ.");
        return true;
    }
    if (content.length >
        limit) {
        await ctx.reply(`❌ الرسالة أطول من الحد.\n\n` +
            `🔢 الحد: ${limit}\n` +
            `📝 الحالي: ${content.length}`);
        return true;
    }
    await updateDraftContent(user.id, draft.id, content);
    await clearUserAction(ctx.from.id);
    await showPostPreview(ctx, draft.id);
    return true;
}
export async function showPostPreview(ctx, draftId) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const draft = await getDraft(user.id, draftId);
    const settings = await getAppSettings();
    const selected = Array.isArray(draft.selected_group_ids)
        ? draft.selected_group_ids.length
        : 0;
    await ctx.reply("👀 معاينة المنشور\n\n" +
        "────────────\n" +
        preview(draft.content, settings.signature, draft.signature_enabled) +
        "\n────────────\n\n" +
        `📣 المجموعات: ${selected}`, {
        reply_markup: new InlineKeyboard()
            .text("📣 اختيار المجموعات", `pg:${draft.id}`)
            .row()
            .text(draft.signature_enabled
            ? "✖️ إخفاء التوقيع"
            : "✅ إظهار التوقيع", `ps:${draft.id}`)
            .row()
            .text("✏️ تعديل", `pe:${draft.id}`)
            .text("🗑 إلغاء", `pc:${draft.id}`)
            .row()
            .text("🏠 الرئيسية", "dashboard")
    });
}
export async function showPostGroups(ctx, draftId) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const draft = await getDraft(user.id, draftId);
    const rows = await getAccountGroups(user.id, draft.telegram_account_id);
    const selected = new Set(Array.isArray(draft.selected_group_ids)
        ? draft.selected_group_ids
        : []);
    const settings = await getAppSettings();
    const limit = isVip(user)
        ? settings.vip_group_limit
        : settings.free_group_limit;
    if (!rows.length) {
        await ctx.reply("📣 اختيار المجموعات\n\n" +
            "لا توجد مجموعات أو قنوات متاحة لهذا الحساب.\n\n" +
            "ارجع إلى حسابك واضغط تحديث.", {
            reply_markup: new InlineKeyboard()
                .text("🔄 تحديث المجموعات", `as:${draft.telegram_account_id}`)
                .row()
                .text("↩️ المعاينة", `pp:${draft.id}`)
                .row()
                .text("🏠 الرئيسية", "dashboard")
        });
        return;
    }
    const keyboard = new InlineKeyboard();
    rows.forEach((row, index) => {
        const group = row.groups;
        if (!group)
            return;
        const checked = selected.has(group.id)
            ? "✅"
            : "⬜";
        keyboard
            .text(`${checked} ${group.title ||
            group.username ||
            "بدون اسم"}`, `pt:${draft.id}:${index}`)
            .row();
    });
    keyboard
        .text("✅ تم", `pd:${draft.id}`)
        .row()
        .text("↩️ المعاينة", `pp:${draft.id}`)
        .text("🏠 الرئيسية", "dashboard");
    await ctx.reply("📣 اختيار المجموعات والقنوات\n\n" +
        `✅ المختارة: ${selected.size} / ${limit}\n` +
        `📋 المتاحة: ${rows.length}\n\n` +
        "اضغط على العنصر لإضافته أو إزالته.", {
        reply_markup: keyboard
    });
}
export async function togglePostGroup(ctx, draftId, index) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const draft = await getDraft(user.id, draftId);
    const rows = await getAccountGroups(user.id, draft.telegram_account_id);
    const row = rows[index];
    if (!row) {
        await ctx.answerCallbackQuery({
            text: "❌ العنصر غير موجود.",
            show_alert: true
        });
        return;
    }
    try {
        await toggleDraftGroup(user.id, draftId, row.group_id);
        await ctx.answerCallbackQuery({
            text: "✅ تم تحديث الاختيار."
        });
        await showPostGroups(ctx, draftId);
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "";
        if (message.includes("GROUP_LIMIT")) {
            await ctx.answerCallbackQuery({
                text: "⚠️ وصلت إلى حد الباقة.",
                show_alert: true
            });
            return;
        }
        await ctx.answerCallbackQuery({
            text: "❌ تعذر تعديل الاختيار.",
            show_alert: true
        });
    }
}
export async function confirmPostGroups(ctx, draftId) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const draft = await getDraft(user.id, draftId);
    const selected = Array.isArray(draft.selected_group_ids)
        ? draft.selected_group_ids
        : [];
    if (!selected.length) {
        await ctx.answerCallbackQuery({
            text: "❌ اختر مجموعة واحدة على الأقل.",
            show_alert: true
        });
        return;
    }
    await ctx.answerCallbackQuery();
    await ctx.reply("✅ تم اختيار الوجهات.\n\n" +
        `📣 العدد: ${selected.length}\n\n` +
        "اضغط نشر عندما تكون جاهزاً.", {
        reply_markup: new InlineKeyboard()
            .text("👀 المعاينة", `pp:${draft.id}`)
            .row()
            .text("🚀 نشر الآن", `px:${draft.id}`)
            .row()
            .text("🗑 إلغاء", `pc:${draft.id}`)
            .row()
            .text("🏠 الرئيسية", "dashboard")
    });
}
export async function publishPost(ctx, draftId) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const draft = await getDraft(user.id, draftId);
    const selected = Array.isArray(draft.selected_group_ids)
        ? draft.selected_group_ids
        : [];
    if (!selected.length) {
        await ctx.answerCallbackQuery({
            text: "❌ لم تختر أي وجهة.",
            show_alert: true
        });
        return;
    }
    try {
        const run = await createPublishRun(user.id, draft.telegram_account_id, draft.id, selected);
        await ctx.answerCallbackQuery({
            text: "🚀 بدأ النشر."
        });
        await ctx.reply("🚀 جاري النشر\n\n" +
            `📣 الوجهات: ${run.targetCount}\n\n` +
            "يمكنك إيقاف العملية الحالية من الزر أدناه.", {
            reply_markup: new InlineKeyboard()
                .text("⏹ إيقاف", `stop:${run.runId}`)
                .row()
                .text("🏠 الرئيسية", "dashboard")
        });
        /*
         * مهم: لا ننتظر (await) انتهاء عملية النشر هنا. النشر قد يستغرق عدة
         * دورات مع دقائق انتظار بينها، وانتظاره مباشرة داخل معالج الرسالة كان
         * يجمّد البوت بالكامل (ويُعطّل زر «⏹ إيقاف» نفسه، لأن البوت لا يستطيع
         * معالجة ضغطة الإيقاف قبل انتهاء الانتظار). ننفّذها في الخلفية عبر نفس
         * طابور publishQueue المستخدم في تدفق النشر الآخر، ونرسل نتيجتها كرسالة
         * منفصلة عند الانتهاء.
         */
        void enqueuePublish(() => executePublishCycles(user.id, draft.telegram_account_id, run.runId))
            .then(async (result) => {
            try {
                await markDraftUsed(user.id, draft.id);
                await ctx.reply("✅ انتهت العملية\n\n" +
                    `✅ نجح: ${result.success}\n` +
                    `❌ فشل: ${result.failed}`, {
                    reply_markup: new InlineKeyboard()
                        .text("📊 سجل النشر", "publish_history")
                        .row()
                        .text("🏠 الرئيسية", "dashboard")
                });
            }
            catch (error) {
                console.error("PUBLISH FINISH MESSAGE ERROR:", error);
            }
        })
            .catch(async (error) => {
            console.error("BACKGROUND PUBLISH ERROR:", error);
            try {
                await ctx.reply("❌ توقف تشغيل النشر بسبب خطأ.\n\n" +
                    (error instanceof Error ? error.message : String(error)), {
                    reply_markup: new InlineKeyboard()
                        .text("📊 سجل النشر", "publish_history")
                        .row()
                        .text("🏠 الرئيسية", "dashboard")
                });
            }
            catch { }
        });
    }
    catch (error) {
        console.error("PUBLISH ERROR:", error);
        await ctx.answerCallbackQuery({
            text: "❌ تعذر تنفيذ العملية.",
            show_alert: true
        }).catch(() => { });
        await ctx.reply("❌ تعذر تنفيذ النشر.", {
            reply_markup: new InlineKeyboard()
                .text("↩️ الرئيسية", "dashboard")
        });
    }
}
export async function cancelPost(ctx, draftId) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    await deleteDraft(user.id, draftId);
    await clearUserAction(ctx.from.id);
    await ctx.answerCallbackQuery({
        text: "✅ تم الإلغاء."
    });
    await ctx.reply("🗑 تم إلغاء المنشور.", {
        reply_markup: new InlineKeyboard()
            .text("🏠 الرئيسية", "dashboard")
    });
}
export async function postHistory(ctx) {
    if (!ctx.from)
        return;
    const user = await getUserByTelegramId(ctx.from.id);
    if (!user)
        return;
    const { supabase } = await import("../db/supabase.js");
    const { data, error } = await supabase
        .from("publish_runs")
        .select(`
      id,
      status,
      target_count,
      success_count,
      failed_count,
      created_at,
      messages (
        content
      )
    `)
        .eq("user_id", user.id)
        .order("created_at", {
        ascending: false
    })
        .limit(10);
    if (error) {
        await ctx.reply("❌ تعذر تحميل سجل النشر.", {
            reply_markup: new InlineKeyboard()
                .text("🏠 الرئيسية", "dashboard")
        });
        return;
    }
    if (!data?.length) {
        await ctx.reply("📊 سجل النشر\n\n" +
            "لا توجد عمليات حتى الآن.", {
            reply_markup: new InlineKeyboard()
                .text("✍️ إنشاء منشور", "create_message")
                .row()
                .text("🏠 الرئيسية", "dashboard")
        });
        return;
    }
    let text = "📊 سجل النشر\n\n";
    for (const [index, run] of data.entries()) {
        const message = Array.isArray(run.messages)
            ? run.messages[0]
            : run.messages;
        const previewText = String(message?.content ||
            "")
            .replace(/\n/g, " ")
            .slice(0, 45);
        text +=
            `${index + 1}. ${previewText}\n` +
                `📌 ${run.status}\n` +
                `✅ ${run.success_count}/${run.target_count}\n` +
                `❌ ${run.failed_count}\n\n`;
    }
    await ctx.reply(text, {
        reply_markup: new InlineKeyboard()
            .text("✍️ منشور جديد", "create_message")
            .row()
            .text("🏠 الرئيسية", "dashboard")
    });
}
