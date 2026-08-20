import { InlineKeyboard } from "grammy";
import { bot } from "./index.js";
import { sendDashboard, sendSecurityInfo } from "./dashboard.js";
import { deleteCurrentScreen } from "./ui.js";
import { handleAdminExtraCallback } from "./adminExtras.js";
import { startMessageComposer, startPublishFlow, chooseMessageAccount, startNewMessage, showSavedMessages, chooseSavedMessage, deleteSavedMessage, confirmDeleteSavedMessage, showMyMessages, viewMyMessage } from "./messageComposer.js";
import { showPublicVip } from "./vipPublic.js";
import { showManualGroups, toggleManualGroup, detachManualGroup } from "./manualGroups.js";
import { getUserTelegramAccounts } from "../telegram/clientManager.js";
import { getUserByTelegramId } from "../services/users.js";
import { getAppSettings } from "../services/settings.js";
import { stopPublishRun } from "../services/publishControl.js";
import { choosePostAccount, showPostPreview, showPostGroups, togglePostGroup, confirmPostGroups, publishPost, cancelPost, postHistory } from "./postFlow.js";
import { handleAccountGroupCallback } from "./accountGroupCallbacks.js";
import { showGroups } from "./accountGroups.js";
import { startUserActionExclusive } from "../services/actionManager.js";
import { checkAllRequiredChannels } from "../services/membership.js";
import { getReferralStats } from "../services/referrals.js";
import { clearUserAction } from "../services/userActions.js";
import { setAdminAction, clearAdminAction, getMandatoryChannels, deleteMandatoryChannel } from "../services/adminChannels.js";
import { isAdmin, isOwner } from "../services/admin.js";
import { startBroadcastCompose, confirmBroadcast, cancelBroadcast } from "./broadcast.js";
async function sendAdminPanel(ctx) {
    await ctx.reply("👑 لوحة الإدارة\n\n" + "إدارة كاملة للمستخدمين والاشتراكات والإعدادات:", {
        reply_markup: new InlineKeyboard()
            .text("📢 القنوات الإلزامية", "admin_channels")
            .text("📣 رسالة جماعية", "admin_broadcast")
            .row()
            .text("⭐ إدارة VIP", "admin_vip")
            .text("👥 المستخدمون", "admin_users")
            .row()
            .text("🛡 المشرفون", "admin_admins")
            .text("⚙️ إعدادات النظام", "admin_settings")
            .row()
            .text("📊 الإحصائيات", "admin_stats")
            .row()
            .text("🏠 الرئيسية", "dashboard")
    });
}
async function sendAdminSettings(ctx) {
    const settings = await getAppSettings();
    await ctx.reply("⚙️ إعدادات النظام\n\n" +
        `📣 حد المجاني: ${settings.free_group_limit}\n` +
        `⭐ حد VIP: ${settings.vip_group_limit}\n` +
        `🎁 VIP عند 7 إحالات: ${settings.referral_7_vip_days} أيام\n` +
        `🎁 VIP عند 15 إحالة: ${settings.referral_20_vip_days} أيام\n` +
        `💰 سعر VIP: ${settings.vip_price_usdt} USDT\n\n` +
        "اختر الإعداد الذي تريد تغييره:", {
        reply_markup: new InlineKeyboard()
            .text("📣 حد المجاني", "setting_free_limit")
            .text("⭐ حد VIP", "setting_vip_limit")
            .row()
            .text("🎁 مكافأة 7", "setting_ref7")
            .text("🎁 مكافأة 20", "setting_ref20")
            .row()
            .text("💰 سعر VIP", "setting_price")
            .row()
            .text("↩️ رجوع", "admin_panel")
    });
}
async function sendChannelsPanel(ctx) {
    const channels = await getMandatoryChannels();
    await ctx.reply("📢 القنوات الإلزامية\n\n" + `القنوات الحالية: ${channels.length}`, {
        reply_markup: new InlineKeyboard()
            .text("➕ إضافة قناة", "admin_channel_add")
            .row()
            .text("📋 عرض القنوات", "admin_channel_list")
            .row()
            .text("🗑 حذف قناة", "admin_channel_delete")
            .row()
            .text("↩️ رجوع", "admin_panel")
    });
}
async function showChannelList(ctx) {
    const channels = await getMandatoryChannels();
    if (!channels.length) {
        await ctx.reply("📋 لا توجد قنوات إلزامية.");
        return;
    }
    let text = "📋 القنوات الإلزامية\n\n";
    channels.forEach((channel, index) => {
        text +=
            `${index + 1}. ${channel.title || "بدون اسم"}\n` +
                `🔗 ${channel.username || channel.chat_id}\n\n`;
    });
    await ctx.reply(text);
}
async function showDeleteChannels(ctx) {
    const channels = await getMandatoryChannels();
    if (!channels.length) {
        await ctx.reply("🗑 لا توجد قنوات لحذفها.");
        return;
    }
    const keyboard = new InlineKeyboard();
    for (const channel of channels) {
        keyboard.text(`🗑 ${channel.title || "القناة"}`, `admin_delete_channel:${channel.id}`).row();
    }
    keyboard.text("↩️ رجوع", "admin_channels");
    await ctx.reply("🗑 اختر القناة التي تريد حذفها:", { reply_markup: keyboard });
}
export async function handleCallbacks(ctx) {
    /*
     * كل Callback خاص بالتنقل: نحذف الشاشة السابقة حتى لا تتراكم
     * عشرات رسائل البوت. رسائل الإدخال لا تمر من هنا، لذلك:
     * الهاتف / الكود / 2FA / المنشور / المجموعة تبقى رسائل مستقلة.
     */
    await deleteCurrentScreen(ctx);
    const callback = ctx.callbackQuery;
    if (!callback || !ctx.from) {
        return;
    }
    const action = callback.data;
    if (await handleAdminExtraCallback(ctx)) {
        return;
    }
    if (action === "admin_broadcast") {
        await startBroadcastCompose(ctx);
        return;
    }
    if (action === "broadcast_confirm") {
        await confirmBroadcast(ctx);
        return;
    }
    if (action === "broadcast_cancel") {
        await cancelBroadcast(ctx);
        return;
    }
    if (action === "security_info") {
        await ctx.answerCallbackQuery();
        await sendSecurityInfo(ctx);
        return;
    }
    if (action === "create_message") {
        await startMessageComposer(ctx);
        return;
    }
    if (action === "run_publish") {
        await startPublishFlow(ctx);
        return;
    }
    if (action?.startsWith("mc:")) {
        await chooseMessageAccount(ctx, action.slice(3));
        return;
    }
    if (action?.startsWith("mm:")) {
        await showMyMessages(ctx, action.slice(3));
        return;
    }
    if (action?.startsWith("mmc:")) {
        await showMyMessages(ctx, action.slice(4));
        return;
    }
    if (action?.startsWith("mnew:")) {
        await startNewMessage(ctx, action.slice(5));
        return;
    }
    if (action?.startsWith("rp:")) {
        await showSavedMessages(ctx, action.slice(3));
        return;
    }
    if (action?.startsWith("mview:")) {
        await viewMyMessage(ctx, action.slice(6));
        return;
    }
    if (action?.startsWith("pm:")) {
        await chooseSavedMessage(ctx, action.slice(3));
        return;
    }
    if (action === "vip") {
        await ctx.answerCallbackQuery();
        await showPublicVip(ctx);
        return;
    }
    if (action?.startsWith("mg:")) {
        const parts = action.split(":");
        await toggleManualGroup(ctx, parts[1], Number(parts[2]));
        return;
    }
    if (action?.startsWith("md:")) {
        const parts = action.split(":");
        await detachManualGroup(ctx, parts[1], Number(parts[2]));
        return;
    }
    if (action?.startsWith("mdel:")) {
        await deleteSavedMessage(ctx, action.slice(5));
        return;
    }
    if (action?.startsWith("mconfirm:")) {
        await confirmDeleteSavedMessage(ctx, action.slice(9));
        return;
    }
    if (action?.startsWith("pstart:")) {
        const parts = action.split(":");
        const messageId = parts[1];
        const delay = Number(parts[2]);
        if (!Number.isFinite(delay) || delay <= 0) {
            await ctx.answerCallbackQuery({
                text: "❌ قيمة التأخير غير صالحة.",
                show_alert: true
            });
            return;
        }
        const { getUserByTelegramId } = await import("../services/users.js");
        const { getAppSettings } = await import("../services/settings.js");
        const { supabase } = await import("../db/supabase.js");
        const { createPublishRun, executePublishCycles } = await import("../services/publish.js");
        const { enqueuePublish } = await import("../services/publishQueue.js");
        const user = await getUserByTelegramId(ctx.from.id);
        if (!user) {
            return;
        }
        const { data: message } = await supabase
            .from("messages")
            .select("id, telegram_account_id")
            .eq("id", messageId)
            .eq("user_id", user.id)
            .single();
        if (!message) {
            await ctx.answerCallbackQuery({ text: "❌ المنشور غير موجود.", show_alert: true });
            return;
        }
        const { hasActiveRun } = await import("../services/publishControl.js");
        const alreadyRunning = await hasActiveRun(user.id, message.telegram_account_id);
        if (alreadyRunning) {
            await ctx.answerCallbackQuery({
                text: "⚠️ يوجد تشغيل قيد التنفيذ بالفعل لهذا الحساب. أوقفه أولاً قبل بدء تشغيل جديد.",
                show_alert: true
            });
            return;
        }
        const { data: groups } = await supabase
            .from("user_groups")
            .select("group_id")
            .eq("user_id", user.id)
            .eq("telegram_account_id", message.telegram_account_id)
            .eq("source", "manual")
            .eq("is_active", true);
        if (!groups?.length) {
            await ctx.answerCallbackQuery({
                text: "❌ اختر مجموعة واحدة على الأقل.",
                show_alert: true
            });
            return;
        }
        const settings = await getAppSettings();
        const vip = user.plan === "vip" && !!user.vip_expires_at && new Date(user.vip_expires_at) > new Date();
        const dailyLimit = vip ? settings.vip_daily_runs : settings.free_daily_runs;
        const cycleLimit = vip ? settings.vip_cycle_limit : settings.free_cycle_limit;
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const { count: dailyCount } = await supabase
            .from("publish_runs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", start.toISOString());
        if ((dailyCount ?? 0) >= dailyLimit) {
            await ctx.answerCallbackQuery({
                text: `⚠️ وصلت إلى حد التشغيل اليومي ${dailyLimit}.`,
                show_alert: true
            });
            return;
        }
        try {
            const run = await createPublishRun(user.id, message.telegram_account_id, message.id, groups.map((row) => row.group_id));
            await ctx.answerCallbackQuery({ text: "🚀 بدأ التشغيل." });
            await ctx.reply("🚀 بدأ التشغيل\n\n" +
                `🔄 الدورات: ${cycleLimit}\n` +
                `⏱ الانتظار بين الدورات: ${delay} دقائق\n` +
                `📣 الوجهات: ${groups.length}\n\n` +
                "كل دورة ترسل إلى جميع الوجهات المختارة.\n" +
                "يمكنك إيقاف العملية الحالية من الزر أدناه.", {
                reply_markup: new InlineKeyboard()
                    .text("⏹ إيقاف", `stop:${run.runId}`)
                    .row()
                    .text("🏠 الرئيسية", "dashboard")
            });
            void enqueuePublish(() => executePublishCycles(user.id, message.telegram_account_id, run.runId, cycleLimit, delay))
                .then(async (result) => {
                try {
                    await ctx.reply("🏁 انتهت عملية التشغيل\n\n" +
                        `🔄 الدورات: ${result.completedCycles} / ${result.cycleLimit}\n` +
                        `✅ نجح: ${result.success}\n` +
                        `❌ فشل: ${result.failed}\n\n` +
                        `📌 الحالة: ${result.status}`, {
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
            console.error("PUBLISH START ERROR:", error);
            await ctx
                .answerCallbackQuery({ text: "❌ تعذر بدء التشغيل.", show_alert: true })
                .catch(() => { });
            await ctx.reply("❌ تعذر بدء التشغيل.\n\n" + (error instanceof Error ? error.message : String(error)), {
                reply_markup: new InlineKeyboard().text("🏠 الرئيسية", "dashboard")
            });
        }
        return;
    }
    if (action?.startsWith("publish_saved:")) {
        const messageId = action.slice("publish_saved:".length);
        const { getUserByTelegramId } = await import("../services/users.js");
        const { getAppSettings } = await import("../services/settings.js");
        const { supabase } = await import("../db/supabase.js");
        const { getUserTelegramAccounts } = await import("../telegram/clientManager.js");
        const user = await getUserByTelegramId(ctx.from.id);
        if (!user) {
            return;
        }
        const { data: message, error: messageError } = await supabase
            .from("messages")
            .select("id, content, telegram_account_id")
            .eq("id", messageId)
            .eq("user_id", user.id)
            .single();
        if (messageError || !message) {
            await ctx.answerCallbackQuery({ text: "❌ المنشور غير موجود.", show_alert: true });
            return;
        }
        const { data: groups, error: groupsError } = await supabase
            .from("user_groups")
            .select("group_id")
            .eq("user_id", user.id)
            .eq("telegram_account_id", message.telegram_account_id)
            .eq("source", "manual")
            .eq("is_active", true);
        if (groupsError || !groups?.length) {
            await ctx.answerCallbackQuery({
                text: "❌ اختر مجموعة واحدة على الأقل أولاً.",
                show_alert: true
            });
            return;
        }
        const settings = await getAppSettings();
        const vip = user.plan === "vip" && !!user.vip_expires_at && new Date(user.vip_expires_at) > new Date();
        const dailyLimit = vip ? settings.vip_daily_runs : settings.free_daily_runs;
        const cycleLimit = vip ? settings.vip_cycle_limit : settings.free_cycle_limit;
        const defaultDelay = vip ? settings.vip_cycle_delay_minutes : settings.free_cycle_delay_minutes;
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const { count: dailyCount } = await supabase
            .from("publish_runs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", start.toISOString());
        if ((dailyCount ?? 0) >= dailyLimit) {
            await ctx.answerCallbackQuery({
                text: `⚠️ وصلت إلى حد التشغيل اليومي ${dailyLimit}.`,
                show_alert: true
            });
            return;
        }
        const accounts = await getUserTelegramAccounts(user.id);
        const account = accounts.find((item) => item.id === message.telegram_account_id);
        const accountName = account?.username
            ? `@${account.username}`
            : account?.display_name || account?.phone_hint || "الحساب";
        await ctx.answerCallbackQuery();
        await ctx.reply("🚀 إعداد التشغيل\n\n" +
            `📱 الحساب: ${accountName}\n` +
            `📝 المنشور: ${String(message.content).slice(0, 80)}\n\n` +
            `🔄 عدد الدورات: ${cycleLimit}\n` +
            `⏱ الانتظار بين الدورات: ${defaultDelay} دقائق\n\n` +
            "كل دورة ترسل المنشور إلى جميع الوجهات المختارة.", {
            reply_markup: new InlineKeyboard()
                .text("🚀 بدء التشغيل", `pstart:${messageId}:${defaultDelay}`)
                .row()
                .text("↩️ المنشور", `pm:${messageId}`)
                .row()
                .text("🏠 الرئيسية", "dashboard")
        });
        return;
    }
    if (await handleAccountGroupCallback(ctx)) {
        return;
    }
    /*
     * ac: زر "➕ إضافة مجموعة" يطلع من chooseSavedMessage
     * (messageComposer.ts) وقت ما الحساب ما إله ولا مجموعة مضافة
     * بعد. كان بدون معالج هون، فكان يفلت لآخر default تحت ويطلع
     * "هذا الخيار غير متاح حالياً". هون منبدأ نفس تدفق add_chat:
     * الموجود أصلاً بـ adminText.ts.
     */
    if (action?.startsWith("ac:")) {
        const accountId = action.slice(3);
        await startUserActionExclusive(ctx.from.id, `add_chat:${accountId}`);
        await ctx.answerCallbackQuery();
        await ctx.reply("➕ إضافة مجموعة\n\n" +
            "أرسل Username المجموعة أو رابط الدعوة.\n\n" +
            "مثال:\n" +
            "@MyGroup\n\n" +
            "سيتم التحقق من المجموعة قبل طلب تأكيدك للانضمام.");
        return;
    }
    /*
     * ag: زر "📣 مجموعاتي" من نفس الشاشة (chooseSavedMessage).
     * showManualGroups مستوردة فوق أصلاً من manualGroups.js
     * وما كانت مستخدمة بأي مكان — هاد هو المكان الصحيح إلها،
     * بنفس نمط mg:/md: تحت.
     */
    if (action?.startsWith("ag:")) {
        await showManualGroups(ctx, action.slice(3));
        return;
    }
    /*
     * chat_cancel: زر "❌ إلغاء" يطلع من adminText.ts بعد ما يبعث
     * المستخدم يوزرنيم/رابط المجموعة (شاشة تأكيد إضافة المجموعة).
     * ملاحظة: chat_confirm ("✅ إضافة والانضمام") لسا بدون معالج —
     * لازم أشوف services/chatAdd.ts لأعرف اسم الدالة يلي بتكمل
     * الانضمام الفعلي قبل ما أضيفه، حتى ما أخمّن اسم export مش موجود.
     */
    if (action === "chat_cancel") {
        const { cancelChatAdd } = await import("../services/chatAdd.js");
        cancelChatAdd(ctx.from.id);
        await clearUserAction(ctx.from.id);
        await ctx.answerCallbackQuery();
        await ctx.reply("❌ تم إلغاء إضافة المجموعة.");
        return;
    }
    if (action === "publish_history") {
        await ctx.answerCallbackQuery();
        await postHistory(ctx);
        return;
    }
    if (action?.startsWith("post_account:")) {
        const accountId = action.split(":")[1];
        await choosePostAccount(ctx, accountId);
        return;
    }
    if (action?.startsWith("post_preview:")) {
        const draftId = action.split(":")[1];
        await ctx.answerCallbackQuery();
        await showPostPreview(ctx, draftId);
        return;
    }
    if (action?.startsWith("post_groups:")) {
        const draftId = action.split(":")[1];
        await ctx.answerCallbackQuery();
        await showPostGroups(ctx, draftId);
        return;
    }
    if (action?.startsWith("post_group_toggle:")) {
        const parts = action.split(":");
        await togglePostGroup(ctx, parts[1], Number(parts[2]));
        return;
    }
    if (action?.startsWith("post_groups_done:")) {
        const draftId = action.split(":")[1];
        await confirmPostGroups(ctx, draftId);
        return;
    }
    if (action?.startsWith("post_publish:")) {
        const draftId = action.split(":")[1];
        await publishPost(ctx, draftId);
        return;
    }
    if (action?.startsWith("post_signature:")) {
        const draftId = action.split(":")[1];
        const { getUserByTelegramId } = await import("../services/users.js");
        const { toggleDraftSignature } = await import("../services/postDrafts.js");
        const user = ctx.from ? await getUserByTelegramId(ctx.from.id) : null;
        if (!user)
            return;
        await toggleDraftSignature(user.id, draftId);
        await ctx.answerCallbackQuery({ text: "✅ تم تحديث التوقيع." });
        await showPostPreview(ctx, draftId);
        return;
    }
    /*
     * pe: هو الكولباك الحقيقي يلي بيبعته زر "✏️ تعديل" من
     * showPostPreview (postFlow.ts). "post_edit:" ما كان يبعته
     * حدا فعلياً، فزر التعديل كان يفلت لآخر default ويطلع
     * "هذا الخيار غير متاح حالياً". ضفنا pe: هون مع نفس المعالج.
     */
    if (action?.startsWith("pe:") || action?.startsWith("post_edit:")) {
        await ctx.answerCallbackQuery();
        await import("../services/userActions.js").then(({ setUserAction }) => setUserAction(ctx.from.id, "post_content"));
        await ctx.reply("✏️ أرسل نص المنشور الجديد.");
        return;
    }
    if (action?.startsWith("post_cancel:")) {
        const draftId = action.split(":")[1];
        await cancelPost(ctx, draftId);
        return;
    }
    if (action?.startsWith("admin_delete_channel:")) {
        if (!(await isAdmin(ctx.from.id))) {
            await ctx.answerCallbackQuery({ text: "⛔ غير مسموح.", show_alert: true });
            return;
        }
        const id = action.split(":")[1];
        await deleteMandatoryChannel(id);
        await ctx.answerCallbackQuery({ text: "✅ تم الحذف." });
        await ctx.reply("✅ تم حذف القناة.");
        return;
    }
    if (action === "check_membership") {
        const result = await checkAllRequiredChannels(bot, ctx.from.id);
        if (!result.complete) {
            await ctx.answerCallbackQuery({
                text: "❌ اشترك في جميع القنوات أولاً.",
                show_alert: true
            });
            return;
        }
        await ctx.answerCallbackQuery({ text: "✅ تم التحقق." });
        await ctx.reply("🎉 تم التحقق من اشتراكك بنجاح!");
        return;
    }
    if (action === "admin_panel") {
        if (!(await isAdmin(ctx.from.id))) {
            await ctx.answerCallbackQuery({ text: "⛔ غير مسموح.", show_alert: true });
            return;
        }
        await ctx.answerCallbackQuery();
        await sendAdminPanel(ctx);
        return;
    }
    if (action === "admin_settings") {
        if (!(await isAdmin(ctx.from.id))) {
            await ctx.answerCallbackQuery({ text: "⛔ غير مسموح.", show_alert: true });
            return;
        }
        await ctx.answerCallbackQuery();
        await sendAdminSettings(ctx);
        return;
    }
    const settingsActions = {
        setting_free_limit: "setting_free_limit",
        setting_vip_limit: "setting_vip_limit",
        setting_ref7: "setting_ref7",
        setting_ref20: "setting_ref20",
        setting_price: "setting_price"
    };
    if (action && settingsActions[action]) {
        if (!(await isAdmin(ctx.from.id))) {
            await ctx.answerCallbackQuery({ text: "⛔ غير مسموح.", show_alert: true });
            return;
        }
        await setAdminAction(ctx.from.id, settingsActions[action]);
        await ctx.answerCallbackQuery();
        const messages = {
            setting_free_limit: "📣 أرسل الآن حد المجموعات للمستخدم المجاني.\n\nمثال: 5",
            setting_vip_limit: "⭐ أرسل الآن حد المجموعات لـ VIP.\n\nمثال: 20",
            setting_ref7: "🎁 أرسل عدد أيام VIP التي يحصل عليها المستخدم عند 7 إحالات.",
            setting_ref20: "🎁 أرسل عدد أيام VIP التي يحصل عليها المستخدم عند 15 إحالة.",
            setting_price: "💰 أرسل سعر VIP الشهري بالـ USDT.\n\nمثال: 5"
        };
        await ctx.reply(messages[action]);
        return;
    }
    if (action === "admin_channels") {
        if (!(await isAdmin(ctx.from.id)))
            return;
        await ctx.answerCallbackQuery();
        await sendChannelsPanel(ctx);
        return;
    }
    if (action === "admin_channel_add") {
        if (!(await isAdmin(ctx.from.id)))
            return;
        await setAdminAction(ctx.from.id, "add_mandatory_channel");
        await ctx.answerCallbackQuery();
        await ctx.reply("➕ إضافة قناة إجبارية\n\n" +
            "أرسل Username القناة.\n\n" +
            "مثال:\n" +
            "@MyChannel\n\n" +
            "يجب أن يكون بوت نشر تلقائي مسؤولاً في القناة.");
        return;
    }
    if (action === "admin_channel_list") {
        if (!(await isAdmin(ctx.from.id)))
            return;
        await ctx.answerCallbackQuery();
        await showChannelList(ctx);
        return;
    }
    if (action === "admin_channel_delete") {
        if (!(await isAdmin(ctx.from.id)))
            return;
        await ctx.answerCallbackQuery();
        await showDeleteChannels(ctx);
        return;
    }
    if (action === "admin_vip") {
        if (!(await isAdmin(ctx.from.id)))
            return;
        await ctx.answerCallbackQuery();
        await ctx.reply("⭐ إدارة VIP\n\n" + "الخطوة التالية ستكون البحث عن مستخدم ومنحه أو سحب VIP.");
        return;
    }
    if (action === "admin_users") {
        if (!(await isAdmin(ctx.from.id)))
            return;
        await ctx.answerCallbackQuery();
        await ctx.reply("👥 إدارة المستخدمين\n\n" + "سيتم إضافة البحث وإدارة المستخدمين هنا.");
        return;
    }
    if (action === "admin_stats") {
        if (!(await isAdmin(ctx.from.id)))
            return;
        await ctx.answerCallbackQuery();
        await ctx.reply("📊 الإحصائيات\n\n" + "سيتم إضافة الإحصائيات الحقيقية هنا.");
        return;
    }
    if (action === "admin_admins") {
        if (!(await isOwner(ctx.from.id))) {
            await ctx.answerCallbackQuery({ text: "⛔ هذا القسم للـOwner فقط.", show_alert: true });
            return;
        }
        await ctx.answerCallbackQuery();
        await ctx.reply("🛡 إدارة المشرفين\n\n" + "سيتم هنا إضافة وحذف المشرفين.");
        return;
    }
    if (action === "admin_back") {
        if (!(await isAdmin(ctx.from.id)))
            return;
        await clearAdminAction(ctx.from.id);
        await ctx.answerCallbackQuery();
        await sendAdminPanel(ctx);
        return;
    }
    await ctx.answerCallbackQuery();
    if (action === "dashboard") {
        await sendDashboard(ctx);
        return;
    }
    if (action === "publish_history") {
        await postHistory(ctx);
        return;
    }
    if (action?.startsWith("pa:")) {
        await choosePostAccount(ctx, action.slice(3));
        return;
    }
    if (action?.startsWith("pp:")) {
        await showPostPreview(ctx, action.slice(3));
        return;
    }
    if (action?.startsWith("pg:")) {
        await showPostGroups(ctx, action.slice(3));
        return;
    }
    /*
     * as: زر "🔄 تحديث المجموعات" يطلع من showPostGroups
     * (postFlow.ts) لما ما في مجموعات محفوظة للحساب. بيبعث
     * accountId مش draftId، فما بقدر أعيد استخدام showPostGroups
     * (بتوقع draftId) من دون خطر خطأ جديد. ما كان إله معالج
     * أصلاً فكان يفلت للـ default. لسا محتاج مزامنة فعلية من
     * تليجرام (دالة مش موجودة بـ postFlow.ts) — هون بالحد
     * الأدنى منمنع رسالة "هذا الخيار غير متاح حالياً" ومنوجّه
     * المستخدم لمكان صح.
     */
    if (action?.startsWith("as:")) {
        await ctx.answerCallbackQuery({
            text: "🔄 لتحديث المجموعات ارجع لحسابك من القائمة الرئيسية.",
            show_alert: true
        });
        return;
    }
    if (action?.startsWith("pt:")) {
        const parts = action.split(":");
        await togglePostGroup(ctx, parts[1], Number(parts[2]));
        return;
    }
    if (action?.startsWith("pd:")) {
        await confirmPostGroups(ctx, action.slice(3));
        return;
    }
    if (action?.startsWith("px:")) {
        await publishPost(ctx, action.slice(3));
        return;
    }
    if (action?.startsWith("stop:")) {
        const runId = action.slice(5);
        const { getUserByTelegramId } = await import("../services/users.js");
        const user = await getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        const stopped = await stopPublishRun(user.id, runId);
        /*
         * ملاحظة: الكولباك انرد عليه فعلاً بالسطر العام فوق
         * (await ctx.answerCallbackQuery(); قبل هذا القسم)، فلا نرد عليه
         * مرة ثانية هنا حتى لا يرمي تلغرام خطأ "query already answered".
         * الرسالة تنعرض عبر ctx.reply بدل التوست.
         */
        await ctx.reply(stopped ? "⏹ تم طلب إيقاف عملية النشر." : "ℹ️ لا توجد عملية قيد التشغيل.", {
            reply_markup: new InlineKeyboard().text("🏠 الرئيسية", "dashboard")
        });
        return;
    }
    if (action?.startsWith("ps:")) {
        const draftId = action.slice(3);
        const { getUserByTelegramId } = await import("../services/users.js");
        const { toggleDraftSignature } = await import("../services/postDrafts.js");
        const user = await getUserByTelegramId(ctx.from.id);
        if (!user)
            return;
        await toggleDraftSignature(user.id, draftId);
        await showPostPreview(ctx, draftId);
        return;
    }
    if (action?.startsWith("pc:")) {
        await cancelPost(ctx, action.slice(3));
        return;
    }
    if (action === "my_messages") {
        await startMessageComposer(ctx);
        return;
    }
    switch (action) {
        case "account_add": {
            const user = await getUserByTelegramId(ctx.from.id);
            if (!user) {
                await ctx.reply("❌ تعذر العثور على حسابك.");
                break;
            }
            const accounts = await getUserTelegramAccounts(user.id);
            if (accounts.length >= 1) {
                await ctx
                    .answerCallbackQuery({
                    text: "⚠️ عندك حساب مربوط بالفعل.",
                    show_alert: true
                })
                    .catch(() => { });
                await ctx.reply("⚠️ يُسمح بربط حساب Telegram واحد فقط لكل مستخدم.\n\n" +
                    "لو تريد تربط حساب ثاني، احذف الحساب الحالي أولاً من «⚙️ حسابي».");
                break;
            }
            await startUserActionExclusive(ctx.from.id, "telegram_phone");
            await ctx.reply("➕ إضافة حساب Telegram\n\n" +
                "أرسل رقم الحساب بالصيغة الدولية.\n\n" +
                "مثال:\n964******");
            break;
        }
        case "groups": {
            const user = await getUserByTelegramId(ctx.from.id);
            if (!user)
                break;
            const accounts = await getUserTelegramAccounts(user.id);
            if (!accounts.length) {
                await ctx.reply("📣 مجموعاتي\n\n" +
                    "لا يوجد حساب Telegram مرتبط.\n\n" +
                    "أضف حسابك أولاً.", {
                    reply_markup: new InlineKeyboard()
                        .text("➕ إضافة حساب", "account_add")
                        .row()
                        .text("🏠 الرئيسية", "dashboard")
                });
                break;
            }
            await showGroups(ctx, accounts[0].id);
            break;
        }
        case "vip": {
            const settings = await getAppSettings();
            await ctx.reply("⭐ باقة VIP\n\n" +
                `💰 السعر: ${settings.vip_price_usdt} USDT / 30 يوم\n` +
                `📣 حد المجموعات: ${settings.vip_group_limit}\n\n` +
                `🎁 7 إحالات → VIP ${settings.referral_7_vip_days} أيام\n` +
                `🎁 15 إحالة → VIP ${settings.referral_20_vip_days} أيام`);
            break;
        }
        case "referrals": {
            const user = await getUserByTelegramId(ctx.from.id);
            if (!user)
                return;
            const stats = await getReferralStats(user.id);
            const settings = await getAppSettings();
            const me = await bot.api.getMe();
            const referralLink = `https://t.me/${me.username}?start=ref_${ctx.from.id}`;
            await ctx.reply("👥 نظام الإحالات\n\n" +
                `👤 الإحالات المؤكدة: ${stats.count}\n\n` +
                "🎁 المكافآت:\n" +
                `• 7 إحالات → VIP ${settings.referral_7_vip_days} أيام\n` +
                `• 15 إحالة → VIP ${settings.referral_20_vip_days} أيام\n\n` +
                "🔗 رابط دعوتك:\n" +
                referralLink, {
                reply_markup: new InlineKeyboard().url("📤 مشاركة رابط الدعوة", referralLink)
            });
            break;
        }
        case "account":
            await ctx.reply("⚙️ حسابك\n\n" +
                `🆔 المعرّف: ${ctx.from.id}\n` +
                `👤 المستخدم: ${ctx.from.username ? `@${ctx.from.username}` : "غير محدد"}`);
            break;
        default:
            /*
             * أي كولباك ما إله معالج بيوصل هون. منسجله بالـ log
             * قبل ما نرد بالرسالة العامة، حتى لو صار نفس المشكلة
             * مرة ثانية (كل ما زر جديد يضاف بدون معالج) نعرف بالضبط
             * شو نص الكولباك يلي ما تعرف عليه من اللوجز مباشرة،
             * بدل ما نراجع كل الملف من الأول.
             */
            console.error("UNHANDLED CALLBACK ACTION:", action);
            await ctx.reply("⚠️ هذا الخيار غير متاح حالياً.\n\n" +
                "🔍 معرّف الزر: `" + action + "`\n\n" +
                "ابعت هالنص لصاحب البوت حتى يصلحه.", { parse_mode: "Markdown" });
    }
}
