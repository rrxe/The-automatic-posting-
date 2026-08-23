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

async function main() {
  console.log("Starting Storm...");

  const reconciled =
    await reconcileStuckPublishRuns();

  if (reconciled > 0) {
    console.log(
      `Reconciled ${reconciled} stuck publish run(s) from previous process.`
    );
  }

  startIdleClientSweeper();

  /*
   * لا نعيد تشغيل أي حسابات Telegram شخصية
   * عند إعادة تشغيل السيرفر.
   *
   * الحسابات تبقى محفوظة في قاعدة البيانات،
   * لكن الاتصال بها يبدأ فقط عند الحاجة الفعلية.
   */

  await bot.api.deleteWebhook({
    drop_pending_updates: true
  });

  /*
   * نستخدم run() من @grammyjs/runner لمعالجة
   * تحديثات Telegram بشكل متوازٍ.
   */
  await bot.init();

  console.log(
    `Telegram bot started: @${bot.botInfo.username}`
  );

  run(bot);

  app.listen(
    env.PORT,
    () => {
      console.log(
        `API running on port ${env.PORT}`
      );
    }
  );
}

main().catch((error) => {
  console.error(
    "FATAL ERROR:",
    error
  );

  process.exit(1);
});
