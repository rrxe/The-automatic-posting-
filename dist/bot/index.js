import { Bot } from "grammy";
import { sequentialize } from "@grammyjs/runner";
import { env } from "../config/env.js";
import { handleStart } from "./start.js";
import { handleCallbacks } from "./callbacks.js";
import { handleAdminText } from "./adminText.js";
import { handleMessageText } from "./messageComposer.js";
import { handleBroadcastPhoto } from "./broadcast.js";
export const bot = new Bot(env.BOT_TOKEN);
/*
 * نُشغّل البوت عبر run() من @grammyjs/runner (انظر index.ts) بدل bot.start()
 * لمعالجة التحديثات بالتوازي، حتى لا يُجمّد مستخدم واحد عالق البوت بالكامل
 * لبقية المستخدمين. sequentialize هنا تحافظ فقط على ترتيب رسائل *نفس*
 * المستخدم/المحادثة، وتسمح بمعالجة مستخدمين مختلفين في نفس الوقت.
 */
bot.use(sequentialize((ctx) => {
    const chat = ctx.chat?.id.toString();
    const user = ctx.from?.id.toString();
    return [chat, user].filter((v) => Boolean(v));
}));
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
bot.on("message:photo", async (ctx) => {
    try {
        /*
         * حالياً الاستخدام الوحيد للصور بالبوت هو تركيب رسالة جماعية
         * (قسم الإدارة). أي صورة تصل خارج هذا السياق تُتجاهل بصمت.
         */
        await handleBroadcastPhoto(ctx);
    }
    catch (error) {
        console.error("PHOTO HANDLER ERROR:", error);
    }
});
bot.catch((error) => {
    console.error("BOT ERROR:", error);
});
