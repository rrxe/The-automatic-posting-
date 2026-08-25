import { Bot } from "grammy";
import { sequentialize } from "@grammyjs/runner";
import { env } from "../config/env.js";
import { handleStart } from "./start.js";
import { handleCallbacks } from "./callbacks.js";
import { handleAdminText } from "./adminText.js";
import { handleMessageText } from "./messageComposer.js";
import { handleBroadcastPhoto } from "./broadcast.js";
/*
 * Telegram Bot API timeout.
 *
 * مهم:
 * لا نستخدم Proxy.
 * فقط نمنع طلبات Bot API من البقاء معلقة وقتًا طويلاً.
 */
export const bot = new Bot(env.BOT_TOKEN, {
    client: {
        timeoutSeconds: 40
    }
});
/*
 * نحافظ على ترتيب تحديثات نفس المحادثة،
 * بدون تجميد المستخدمين الآخرين.
 */
bot.use(sequentialize((ctx) => {
    const chat = ctx.chat?.id.toString();
    const user = ctx.from?.id.toString();
    return [
        chat,
        user
    ].filter((v) => Boolean(v));
}));
/*
 * /start
 */
bot.command("start", async (ctx) => {
    try {
        await handleStart(ctx);
    }
    catch (error) {
        console.error("START ERROR:", error);
        try {
            await ctx.reply("❌ حدث خطأ أثناء تشغيل الحساب.");
        }
        catch { }
    }
});
/*
 * أزرار Telegram
 */
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
/*
 * الرسائل النصية
 */
bot.on("message:text", async (ctx, next) => {
    try {
        const handled = await handleMessageText(ctx, ctx.message.text);
        if (handled) {
            return;
        }
        await handleAdminText(ctx);
    }
    catch (error) {
        console.error("TEXT HANDLER ERROR:", error);
    }
    await next();
});
/*
 * الصور
 */
bot.on("message:photo", async (ctx) => {
    try {
        await handleBroadcastPhoto(ctx);
    }
    catch (error) {
        console.error("PHOTO HANDLER ERROR:", error);
    }
});
/*
 * أخطاء البوت العامة
 */
bot.catch((error) => {
    console.error("BOT ERROR:", error);
});
