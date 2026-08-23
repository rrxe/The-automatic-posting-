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
  startIdleClientSweeper
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/*
 * deleteWebhook:
 * إذا Telegram API غير متاح مؤقتاً،
 * لا نخلي العملية تموت.
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

/*
 * تشغيل Bot API.
 *
 * إذا Telegram غير متاح:
 * نعيد المحاولة كل 5 ثوانٍ.
 *
 * لا warmup للحسابات الشخصية هنا.
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
       * فشل deleteWebhook لا يمنعنا من محاولة bot.init().
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
       * بدء long polling.
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
  console.log("Starting Storm...");

  /*
   * HTTP server يبدأ مباشرة.
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
   * لا نعمل warmTelegramAccounts().
   *
   * الحسابات الشخصية تبقى محفوظة في DB،
   * لكن لا يتم إعادة الاتصال بها بعد Restart.
   */
  startIdleClientSweeper();

  /*
   * نبدأ Bot API فقط.
   */
  await startTelegramBot();
}

main().catch((error) => {
  /*
   * لا نسقط Node بسبب Telegram.
   *
   * startTelegramBot() يعيد المحاولة بنفسه.
   */
  console.error(
    "MAIN ERROR:",
    error instanceof Error
      ? error.message
      : String(error)
  );
});
