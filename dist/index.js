import { run } from "@grammyjs/runner";
import { registerOfficialTelegramAuth } from "./web/officialTelegramAuth.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { bot } from "./bot/index.js";
import { env } from "./config/env.js";
import { reconcileStuckPublishRuns } from "./services/publishControl.js";
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

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function deleteWebhookSafely() {
    let timer = null;

    try {
        const timeoutPromise = new Promise((resolve) => {
            timer = setTimeout(() => {
                console.warn(
                    "WEBHOOK DELETE TIMEOUT — continuing startup."
                );
                resolve();
            }, 8000);
        });

        const deletePromise = bot.api
            .deleteWebhook({
                drop_pending_updates: true
            })
            .then(() => {
                console.log(
                    "Telegram webhook deleted successfully."
                );
            })
            .catch((error) => {
                console.error(
                    "WEBHOOK DELETE FAILED — continuing without crashing:",
                    error instanceof Error
                        ? error.message
                        : String(error)
                );
            });

        await Promise.race([
            deletePromise,
            timeoutPromise
        ]);
    }
    finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

async function startTelegramBot() {
    let attempt = 0;

    while (true) {
        attempt += 1;

        try {
            console.log(
                `Telegram startup attempt #${attempt}...`
            );

            await deleteWebhookSafely();

            await bot.init();

            console.log(
                `Telegram bot started: @${bot.botInfo.username}`
            );

            run(bot);

            console.log(
                "Telegram update runner started successfully."
            );

            return;
        }
        catch (error) {
            console.error(
                `TELEGRAM STARTUP FAILED (attempt #${attempt}) — retrying in 10 seconds:`,
                error instanceof Error
                    ? error.message
                    : String(error)
            );

            await sleep(10000);
        }
    }
}

async function main() {
    console.log("Starting Storm...");

    app.listen(env.PORT, () => {
        console.log(
            `API running on port ${env.PORT}`
        );
    });

    try {
        const reconciled =
            await reconcileStuckPublishRuns();

        if (reconciled > 0) {
            console.log(
                `Reconciled ${reconciled} stuck publish run(s) from previous process.`
            );
        }
    }
    catch (error) {
        console.error(
            "PUBLISH RECONCILIATION ERROR:",
            error instanceof Error
                ? error.message
                : String(error)
        );
    }

    startIdleClientSweeper();

    void warmTelegramAccounts().catch((error) => {
        console.error(
            "ACCOUNT WARMUP STARTUP ERROR:",
            error
        );
    });

    void startTelegramBot();
}

main().catch((error) => {
    console.error(
        "FATAL ERROR:",
        error
    );
});
