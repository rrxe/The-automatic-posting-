import type { BotContext } from "../types/bot.js";

interface ScreenOptions {
  reply_markup?: any;
  parse_mode?: "HTML" | "MarkdownV2";
  disable_web_page_preview?: boolean;
}

export async function showScreen(
  ctx: BotContext,
  text: string,
  options: ScreenOptions = {}
) {
  /*
   * Callback = صفحة تنقل:
   * نحاول تعديل الرسالة الحالية بدل إرسال رسالة جديدة.
   */
  if (
    ctx.callbackQuery &&
    ctx.callbackQuery.message
  ) {
    try {
      await ctx.api.editMessageText(
        ctx.callbackQuery.message.chat.id,
        ctx.callbackQuery.message.message_id,
        text,
        {
          reply_markup:
            options.reply_markup,
          parse_mode:
            options.parse_mode,
          link_preview_options:
            options.disable_web_page_preview
              ? {
                  is_disabled: true
                }
              : undefined
        }
      );

      return;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      /*
       * إذا كانت الرسالة نفسها لم تتغير
       * أو Telegram رفض التعديل، نرسل رسالة
       * جديدة بدل كسر الشاشة.
       */
      if (
        !message.includes(
          "message is not modified"
        )
      ) {
        console.error(
          "SCREEN EDIT ERROR:",
          error
        );
      }
    }
  }

  /*
   * Message context أو فشل التعديل:
   * reply عادي.
   *
   * هذا مهم جدًا لخطوات:
   * الهاتف / الكود / 2FA / المنشور / المجموعة.
   */
  await ctx.reply(
    text,
    {
      reply_markup:
        options.reply_markup,
      parse_mode:
        options.parse_mode,
      link_preview_options:
        options.disable_web_page_preview
          ? {
              is_disabled: true
            }
          : undefined
    }
  );
}

export async function editScreen(
  ctx: BotContext,
  text: string,
  options: ScreenOptions = {}
) {
  if (
    !ctx.callbackQuery?.message
  ) {
    return showScreen(
      ctx,
      text,
      options
    );
  }

  try {
    await ctx.api.editMessageText(
      ctx.callbackQuery.message.chat.id,
      ctx.callbackQuery.message.message_id,
      text,
      {
        reply_markup:
          options.reply_markup,
        parse_mode:
          options.parse_mode,
        link_preview_options:
          options.disable_web_page_preview
            ? {
                is_disabled: true
              }
            : undefined
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (
      !message.includes(
        "message is not modified"
      )
    ) {
      console.error(
        "EDIT SCREEN ERROR:",
        error
      );
    }
  }
}

export async function deleteCurrentScreen(
  ctx: BotContext
) {
  if (
    !ctx.callbackQuery?.message
  ) {
    return;
  }

  try {
    await ctx.api.deleteMessage(
      ctx.callbackQuery.message.chat.id,
      ctx.callbackQuery.message.message_id
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    /*
     * إذا كانت الرسالة حُذفت مسبقاً
     * أو لم يعد بالإمكان حذفها، لا نوقف البوت.
     */
    if (
      !message.includes(
        "message to delete not found"
      ) &&
      !message.includes(
        "message can't be deleted"
      )
    ) {
      console.error(
        "DELETE SCREEN ERROR:",
        error
      );
    }
  }
}
