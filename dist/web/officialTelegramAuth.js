import { consumeTelegramOidcCallback } from "../services/telegramOidc.js";
export function registerOfficialTelegramAuth(app) {
    app.get("/auth/telegram/callback", async (req, res) => {
        try {
            const code = String(req.query.code ??
                "");
            const state = String(req.query.state ??
                "");
            if (!code || !state) {
                res
                    .status(400)
                    .send("Invalid Telegram login callback.");
                return;
            }
            const result = await consumeTelegramOidcCallback(code, state);
            res
                .type("html")
                .send(`
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storm</title>
<style>
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #07111f;
  color: white;
  font-family: system-ui, sans-serif;
}
.card {
  max-width: 420px;
  padding: 30px;
  border-radius: 20px;
  background: #12243a;
  text-align: center;
}
.ok {
  font-size: 52px;
}
</style>
</head>
<body>
<div class="card">
  <div class="ok">✅</div>
  <h2>تم التحقق من Telegram</h2>
  <p>تم تأكيد هوية حسابك في Storm.</p>
  <p>Telegram ID: ${result.telegramId}</p>
  <p>الخطوة التالية هي ربط حساب Telegram عبر QR الرسمي.</p>
</div>
</body>
</html>
          `);
        }
        catch (error) {
            console.error("TELEGRAM OIDC ERROR:", error);
            res
                .status(400)
                .send("تعذر التحقق من Telegram.");
        }
    });
}
