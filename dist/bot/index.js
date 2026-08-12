import { Bot } from "grammy";
import { env } from "../config/env.js";
import { handleStart } from "./start.js";
import { handleCallbacks } from "./callbacks.js";
import { handleAdminText } from "./adminText.js";
import { handleMessageText } from "./messageComposer.js";
export const bot = new Bot(env.BOT_TOKEN);
bot.command("start", async (ctx) => {
    try {
        await handleStart(ctx);
    }
    catch (error) {
        console.error("START ERROR:", error);
        await ctx.reply("❌ حدث خطأ أثناء تشغيل الحساب.");
    }
});
bot.on("callback_query:data", async (ctx) => {
    try {
        await handleCallbacks(ctx);
    }
    catch (error) {
        console.error("CALLBACK ERROR:", error);
        try {
            await ctx.answerCallbackQuery({
                text: "حدث خطأ، حاول مرة أخرى.",
                show_alert: true
            });
        }
        catch { }
    }
});
bot.on("message:text", async (ctx, next) => {
    try {
        /*
         * أولاً نعطي نظام إنشاء المنشورات
         * فرصة لمعالجة الرسالة.
         *
         * إذا كان المستخدم في وضع كتابة منشور،
         * سيتم حفظ المنشور ولن نرسله لباقي handlers.
         */
        const handled = await handleMessageText(ctx, ctx.message.text);
        if (handled) {
            return;
        }
        /*
         * إذا لم تكن الرسالة منشوراً،
         * نمررها إلى نظام الإدارة.
         */
        await handleAdminText(ctx);
    }
    catch (error) {
        console.error("TEXT HANDLER ERROR:", error);
    }
    await next();
});
bot.catch((error) => {
    console.error("BOT ERROR:", error);
});
