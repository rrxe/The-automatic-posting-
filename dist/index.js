import { run } from "@grammyjs/runner";
import { registerOfficialTelegramAuth } from "./web/officialTelegramAuth.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { bot } from "./bot/index.js";
import { env } from "./config/env.js";
import { reconcileStuckPublishRuns } from "./services/publishControl.js";
import { startIdleClientSweeper, warmTelegramAccounts } from "./telegram/clientManager.js";
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
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
/*
 * لا نستخدم AbortSignal هنا لأن نسخة grammY/runner
 * الموجودة بالمشروع تستخدم نوع AbortSignal مختلف.
 *
 * عميل bot نفسه عنده timeoutSeconds = 15،
 * لذلك الطلب لن يبقى معلقاً للأبد.
 */
async function deleteWebhookSafely() {
    try {
        await bot.api.deleteWebhook({
            drop_pending_updates: true
        });
        console.log("Telegram webhook deleted successfully.");
        return true;
    }
    catch (error) {
        console.error("WEBHOOK DELETE FAILED — continuing startup:", error instanceof Error
            ? error.message
            : String(error));
        return false;
    }
}
/*
 * تشغيل Telegram Bot API في حلقة مستقلة.
 *
 * إذا Telegram غير متاح:
 * - لا يسقط Node
 * - لا يغلق HTTP server
 * - يعيد المحاولة تلقائياً
 */
async function startTelegramBot() {
    let attempt = 0;
    while (true) {
        attempt += 1;
        try {
            console.log(`Telegram startup attempt #${attempt}...`);
            /*
             * حذف webhook ليس شرطاً أن ينجح حتى نواصل
             * محاولة تهيئة البوت.
             */
            await deleteWebhookSafely();
            /*
             * bot.init() يعمل getMe.
             * عميل Bot مضبوط على timeout = 15 ثانية.
             */
            await bot.init();
            console.log(`Telegram bot started: @${bot.botInfo.username}`);
            /*
             * في runner:
             * fetch موجود داخل runner.fetch
             */
            run(bot, {
                runner: {
                    fetch: {
                        timeout: 30
                    },
                    retryInterval: 3000,
                    maxRetryTime: 24 * 60 * 60 * 1000
                }
            });
            console.log("Telegram update runner started successfully.");
            return;
        }
        catch (error) {
            console.error(`TELEGRAM STARTUP FAILED (attempt #${attempt}) — retrying in 5 seconds:`, error instanceof Error
                ? error.message
                : String(error));
            await sleep(5000);
        }
    }
}
async function main() {
    console.log("Starting Storm...");
    /*
     * شغّل HTTP server فوراً.
     * Telegram لا يستطيع إسقاط خدمة الويب.
     */
    app.listen(env.PORT, () => {
        console.log(`API running on port ${env.PORT}`);
    });
    /*
     * تنظيف عمليات النشر العالقة من التشغيل السابق.
     */
    try {
        const reconciled = await reconcileStuckPublishRuns();
        if (reconciled > 0) {
            console.log(`Reconciled ${reconciled} stuck publish run(s) from previous process.`);
        }
    }
    catch (error) {
        console.error("PUBLISH RECONCILIATION ERROR:", error instanceof Error
            ? error.message
            : String(error));
    }
    startIdleClientSweeper();
    /*
     * أولاً نبدأ Bot API.
     * الحسابات الشخصية لا نعطيها فرصة لتأخير /start.
     */
    await startTelegramBot();
    /*
     * بعد نجاح Bot API فقط،
     * نبدأ warmup للحسابات الشخصية في الخلفية.
     *
     * الجلسات المنتهية يتم تخطيها من clientManager.
     */
    void warmTelegramAccounts().catch((error) => {
        console.error("ACCOUNT WARMUP STARTUP ERROR:", error);
    });
}
main().catch((error) => {
    /*
     * لا نستخدم process.exit(1)
     * بسبب مشكلة Telegram.
     *
     * startTelegramBot لديه retry داخلي.
     */
    console.error("FATAL ERROR:", error instanceof Error
        ? error.message
        : String(error));
});
