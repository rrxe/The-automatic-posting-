import { run } from "@grammyjs/runner";
import { registerOfficialTelegramAuth } from "./web/officialTelegramAuth.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { bot } from "./bot/index.js";
import { env } from "./config/env.js";

import {
  reconcileStuckPublishRuns
} from "./services/publishControl.js";

import {
  startIdleClientSweeper,
  warmTelegramAccounts
} from "./telegram/clientManager.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
registerOfficialTelegramAuth(app);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Storm",
    status: "running"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    bot: "online"
  });
});

/*
 * نمنع انتظار deleteWebhook لوقت طويل.
 *
 * مهم:
 * لا نستخدم AbortSignal هنا بسبب اختلاف نوع AbortSignal
 * في نسخة grammY/abort-controller الموجودة بالمشروع.
 *
 * bot نفسه مضبوط على timeoutSeconds = 15.
 */
async function deleteWebhookSafely() {
  try {
    await bot.api.deleteWebhook({
      drop_pending_updates: true
    });

    console.log(
      "Telegram webhook deleted successfully."
    );

    return true;
  } catch (error) {
    console.error(
      "WEBHOOK DELETE FAILED — continuing startup:",
      error instanceof Error
        ? error.message
        : String(error)
    );

    return false;
  }
}

function sleep(ms: number) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        ms
      );
    }
  );
}

/*
 * تشغيل Telegram.
 *
 * إذا Telegram API متاح:
 *   يبدأ فوراً.
 *
 * إذا يوجد ETIMEDOUT:
 *   لا يسقط Node.
 *   يعيد المحاولة كل 5 ثواني.
 */
async function startTelegramBot() {
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      console.log(
        `Telegram startup attempt #${attempt}...`
      );

      /*
       * نحاول إزالة الـwebhook.
       *
       * الفشل هنا لا يمنعنا من محاولة bot.init().
       */
      await deleteWebhookSafely();

      /*
       * getMe
       */
      await bot.init();

      console.log(
        `Telegram bot started: @${bot.botInfo.username}`
      );

      /*
       * Long polling.
       *
       * نستخدم run() مثل مشروعك الأصلي.
       */
      run(bot);

      console.log(
        "Telegram update runner started successfully."
      );

      return;
    } catch (error) {
      console.error(
        `TELEGRAM STARTUP FAILED (attempt #${attempt}) — retrying in 5 seconds:`,
        error instanceof Error
          ? error.message
          : String(error)
      );

      await sleep(5000);
    }
  }
}

async function main() {
  console.log(
    "Starting Storm..."
  );

  /*
   * HTTP server يبدأ أولاً.
   */
  app.listen(
    env.PORT,
    () => {
      console.log(
        `API running on port ${env.PORT}`
      );
    }
  );

  /*
   * استعادة عمليات النشر العالقة.
   */
  try {
    const reconciled =
      await reconcileStuckPublishRuns();

    if (reconciled > 0) {
      console.log(
        `Reconciled ${reconciled} stuck publish run(s) from previous process.`
      );
    }
  } catch (error) {
    console.error(
      "PUBLISH RECONCILIATION ERROR:",
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  /*
   * تشغيل مراقبة الحسابات الخاملة.
   */
  startIdleClientSweeper();

  /*
   * مهم:
   * لا ننتظر warmTelegramAccounts قبل تشغيل البوت.
   */
  void warmTelegramAccounts()
    .catch((error) => {
      console.error(
        "ACCOUNT WARMUP STARTUP ERROR:",
        error
      );
    });

  /*
   * تشغيل Telegram.
   */
  await startTelegramBot();
}

main().catch(
  (error) => {
    /*
     * لا نعمل process.exit(1).
     *
     * لو Telegram غير متاح، startTelegramBot()
     * عنده إعادة محاولة داخلية.
     */
    console.error(
      "FATAL ERROR:",
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
);
