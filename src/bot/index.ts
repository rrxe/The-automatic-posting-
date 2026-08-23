import { Bot } from "grammy";
import { sequentialize } from "@grammyjs/runner";
import { env } from "../config/env.js";

import { handleStart } from "./start.js";
import { handleCallbacks } from "./callbacks.js";
import { handleAdminText } from "./adminText.js";
import {
  handleMessageText
} from "./messageComposer.js";
import { handleBroadcastPhoto } from "./broadcast.js";

import type { BotContext } from "../types/bot.js";

/*
 * مهلة Telegram Bot API.
 *
 * هذا يمنع deleteWebhook / getMe / sendMessage
 * من البقاء معلقة وقت طويل إذا شبكة Telegram غير متاحة.
 */
export const bot =
  new Bot<BotContext>(
    env.BOT_TOKEN,
    {
      client: {
        timeoutSeconds: 15
      }
    }
  );

/*
 * نحافظ على ترتيب رسائل نفس المستخدم/المحادثة،
 * بينما المستخدمون المختلفون يمكن معالجتهم بالتوازي.
 */
bot.use(
  sequentialize((ctx) => {
    const chat =
      ctx.chat?.id.toString();

    const user =
      ctx.from?.id.toString();

    return [
      chat,
      user
    ].filter(
      (v): v is string =>
        Boolean(v)
    );
  })
);

bot.command(
  "start",
  async (ctx) => {
    try {
      await handleStart(ctx);
    } catch (error) {
      console.error(
        "START ERROR:",
        error
      );

      try {
        await ctx.reply(
          "❌ حدث خطأ أثناء تشغيل الحساب."
        );
      } catch {}
    }
  }
);

bot.on(
  "callback_query:data",
  async (ctx) => {
    try {
      await handleCallbacks(ctx);
    } catch (error) {
      console.error(
        "CALLBACK ERROR:",
        error
      );

      try {
        await ctx.answerCallbackQuery({
          text:
            "حدث خطأ، حاول مرة أخرى.",
          show_alert: true
        });
      } catch {}
    }
  }
);

bot.on(
  "message:text",
  async (ctx, next) => {
    try {
      /*
       * أولاً نعطي نظام إنشاء المنشورات
       * فرصة لمعالجة الرسالة.
       */
      const handled =
        await handleMessageText(
          ctx,
          ctx.message.text
        );

      if (handled) {
        return;
      }

      /*
       * إذا لم تكن الرسالة منشوراً،
       * نمررها إلى نظام الإدارة.
       */
      await handleAdminText(ctx);
    } catch (error) {
      console.error(
        "TEXT HANDLER ERROR:",
        error
      );
    }

    await next();
  }
);

bot.on(
  "message:photo",
  async (ctx) => {
    try {
      await handleBroadcastPhoto(ctx);
    } catch (error) {
      console.error(
        "PHOTO HANDLER ERROR:",
        error
      );
    }
  }
);

bot.catch(
  (error) => {
    console.error(
      "BOT ERROR:",
      error
    );
  }
);
