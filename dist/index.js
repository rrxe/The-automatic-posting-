import express from "express";
import cors from "cors";
import helmet from "helmet";
import { bot } from "./bot/index.js";
import { env } from "./config/env.js";
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
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
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    bot.start({
        onStart: (info) => {
            console.log(`Telegram bot started: @${info.username}`);
        }
    });
    app.listen(env.PORT, () => {
        console.log(`API running on port ${env.PORT}`);
    });
}
main().catch((error) => {
    console.error("FATAL ERROR:", error);
    process.exit(1);
});
