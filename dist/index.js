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
async function main() {
    console.log("Starting Storm...");
    const reconciled = await reconcileStuckPublishRuns();
    if (reconciled > 0) {
        console.log(`Reconciled ${reconciled} stuck publish run(s) from previous process.`);
    }
    startIdleClientSweeper();
    /*
     * يعيد الاتصال بكل الحسابات النشطة عند تشغيل السيرفر — هذا الاستدعاء
     * كان ناقصاً (الدالة موجودة أصلاً بالكود لكن غير مستخدمة). فائدته الآن:
     * أي حساب مربوط مسبقاً يلتقط بصمة الجهاز الجديدة (Linux/Web) فور إعادة
     * تشغيل السيرفر، بدل ما ينتظر أول عملية نشر تلقائية تعيد الاتصال به.
     * بالخلفية (بدون await) حتى لا يؤخر جاهزية السيرفر والبوت.
     */
    void warmTelegramAccounts().catch((error) => {
        console.error("ACCOUNT WARMUP STARTUP ERROR:", error);
    });
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    /*
     * مهم: نستخدم run() من @grammyjs/runner بدل bot.start() لمعالجة تحديثات
     * Telegram بالتوازي. كانت bot.start() (وهي المكتبة الأساسية في grammy)
     * تعالج التحديثات بالتتابع: طلب واحد "عالق" (مثل تسجيل دخول ينتظر بلا
     * نهاية) كان يمنع البوت بالكامل عن معالجة أي رسالة من أي مستخدم آخر إلى
     * أن ينتهي. run() يعالج كل محادثة بشكل مستقل ومتوازٍ.
     */
    await bot.init();
    console.log(`Telegram bot started: @${bot.botInfo.username}`);
    run(bot);
    app.listen(env.PORT, () => {
        console.log(`API running on port ${env.PORT}`);
    });
}
main().catch((error) => {
    console.error("FATAL ERROR:", error);
    process.exit(1);
});
