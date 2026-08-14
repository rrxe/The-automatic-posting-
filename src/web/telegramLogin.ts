import type { Application, Request } from "express";

import {
  beginLogin,
  submitLoginCode,
  submitLoginPassword,
  cancelLogin
} from "../telegram/auth.js";

import {
  getWebTelegramLoginSession,
  deleteWebTelegramLoginToken
} from "../services/webTelegramLogin.js";

function getToken(
  req: Request
) {
  return String(
    req.body?.token ??
    req.query?.token ??
    ""
  ).trim();
}

function html() {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storm — ربط حساب Telegram</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  background:
    linear-gradient(135deg, #07111f, #10233a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.card {
  width: 100%;
  max-width: 460px;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 22px;
  padding: 28px;
  backdrop-filter: blur(18px);
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
}

.logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: #229ed9;
  font-size: 30px;
}

h1 {
  text-align: center;
  margin: 0 0 8px;
}

.subtitle {
  text-align: center;
  opacity: .75;
  margin-bottom: 25px;
  line-height: 1.6;
}

.step {
  display: none;
}

.step.active {
  display: block;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 700;
}

input {
  width: 100%;
  border: 1px solid rgba(255,255,255,.15);
  background: rgba(0,0,0,.25);
  color: #fff;
  border-radius: 13px;
  padding: 14px;
  font-size: 17px;
  outline: none;
  direction: ltr;
}

input:focus {
  border-color: #229ed9;
}

button {
  width: 100%;
  border: 0;
  border-radius: 13px;
  padding: 14px;
  margin-top: 14px;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  background: #229ed9;
  color: #fff;
}

button:disabled {
  opacity: .5;
  cursor: wait;
}

.notice {
  margin-top: 16px;
  padding: 13px;
  border-radius: 13px;
  background: rgba(255,255,255,.06);
  line-height: 1.6;
}

.error {
  color: #ffb4b4;
}

.success {
  color: #a7f3c2;
}

.code {
  text-align: center;
  letter-spacing: 8px;
  font-size: 26px;
}

.small {
  font-size: 13px;
  opacity: .7;
  margin-top: 12px;
  line-height: 1.6;
}

.hidden {
  display: none !important;
}
</style>
</head>

<body>

<div class="card">

  <div class="logo">⚡</div>

  <h1>ربط حساب Telegram</h1>

  <div class="subtitle">
    سجّل حساب Telegram ليتم استخدامه في Storm.
    <br>
    بيانات الدخول تتم معالجتها عبر خادم Storm.
  </div>

  <div id="step-phone" class="step active">
    <label>رقم الهاتف</label>

    <input
      id="phone"
      type="tel"
      placeholder="+964..."
      autocomplete="tel"
    >

    <button id="startBtn">
      إرسال رمز Telegram
    </button>

    <div class="small">
      استخدم الصيغة الدولية مثل +964...
      Telegram هي التي تحدد طريقة وصول الرمز.
    </div>
  </div>

  <div id="step-code" class="step">

    <label>رمز Telegram</label>

    <input
      id="code"
      class="code"
      inputmode="numeric"
      autocomplete="one-time-code"
      placeholder="•••••"
    >

    <button id="codeBtn">
      التحقق من الرمز
    </button>

    <div id="delivery" class="notice"></div>

    <div class="small">
      لا تعيد طلب الكود عدة مرات متتالية.
      Telegram قد تفرض مهلة انتظار عند تكرار الطلب.
    </div>
  </div>

  <div id="step-password" class="step">

    <label>كلمة مرور التحقق بخطوتين</label>

    <input
      id="password"
      type="password"
      autocomplete="current-password"
      placeholder="2FA password"
    >

    <button id="passwordBtn">
      إكمال تسجيل الدخول
    </button>

    <div class="small">
      كلمة المرور تُرسل إلى خادم Storm لإكمال تسجيل الدخول
      ولا يتم حفظها في قاعدة البيانات.
    </div>
  </div>

  <div id="step-success" class="step">

    <div class="notice success">
      🎉 تم ربط حساب Telegram بنجاح.
      <br><br>
      يمكنك العودة إلى بوت Storm.
    </div>

  </div>

  <div id="status" class="notice hidden"></div>

</div>

<script>
(() => {

  const params =
    new URLSearchParams(
      location.search
    );

  const token =
    params.get("token");

  if (!token) {
    showStatus(
      "رابط التسجيل غير صالح.",
      true
    );
    return;
  }

  history.replaceState(
    {},
    document.title,
    location.pathname
  );

  const phoneStep =
    document.getElementById(
      "step-phone"
    );

  const codeStep =
    document.getElementById(
      "step-code"
    );

  const passwordStep =
    document.getElementById(
      "step-password"
    );

  const successStep =
    document.getElementById(
      "step-success"
    );

  const status =
    document.getElementById(
      "status"
    );

  const phone =
    document.getElementById(
      "phone"
    );

  const code =
    document.getElementById(
      "code"
    );

  const password =
    document.getElementById(
      "password"
    );

  function showStatus(
    message,
    error = false
  ) {
    status.textContent =
      message;

    status.className =
      "notice " +
      (error
        ? "error"
        : "success");

    status.classList.remove(
      "hidden"
    );
  }

  function hideStatus() {
    status.classList.add(
      "hidden"
    );
  }

  function showStep(
    step
  ) {
    [
      phoneStep,
      codeStep,
      passwordStep,
      successStep
    ].forEach(
      el =>
        el.classList.remove(
          "active"
        )
    );

    step.classList.add(
      "active"
    );
  }

  async function request(
    url,
    body
  ) {
    const response =
      await fetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              token,
              ...body
            })
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({
            ok: false
          })
        );

    if (
      !response.ok ||
      !data.ok
    ) {
      throw new Error(
        data.error ||
        "حدث خطأ غير متوقع."
      );
    }

    return data;
  }

  document
    .getElementById(
      "startBtn"
    )
    .addEventListener(
      "click",
      async () => {
        const value =
          phone.value.trim();

        if (!value) {
          showStatus(
            "أدخل رقم الهاتف.",
            true
          );
          return;
        }

        const btn =
          document.getElementById(
            "startBtn"
          );

        btn.disabled =
          true;

        hideStatus();

        try {
          const data =
            await request(
              "/api/telegram-login/start",
              {
                phone: value
              }
            );

          showStep(
            codeStep
          );

          if (
            data.deliveredToApp
          ) {
            document
              .getElementById(
                "delivery"
              )
              .textContent =
                "📨 Telegram أرسل الرمز إلى تطبيق Telegram. افحص Telegram على الجهاز الذي يوجد عليه الحساب.";
          } else {
            document
              .getElementById(
                "delivery"
              )
              .textContent =
                "📲 Telegram اختار طريقة تحقق أخرى. افحص SMS أو الوسيلة التي يعرضها Telegram.";
          }

        } catch (error) {
          showStatus(
            error.message ||
            "تعذر بدء تسجيل الدخول.",
            true
          );
        } finally {
          btn.disabled =
            false;
        }
      }
    );

  document
    .getElementById(
      "codeBtn"
    )
    .addEventListener(
      "click",
      async () => {

        const value =
          code.value.trim();

        if (!value) {
          showStatus(
            "أدخل رمز Telegram.",
            true
          );
          return;
        }

        const btn =
          document.getElementById(
            "codeBtn"
          );

        btn.disabled =
          true;

        hideStatus();

        try {
          const data =
            await request(
              "/api/telegram-login/code",
              {
                code: value
              }
            );

          if (
            data.status ===
            "password"
          ) {
            showStep(
              passwordStep
            );
            return;
          }

          showStep(
            successStep
          );

        } catch (error) {
          showStatus(
            error.message ||
            "تعذر التحقق من الرمز.",
            true
          );
        } finally {
          btn.disabled =
            false;
        }
      }
    );

  document
    .getElementById(
      "passwordBtn"
    )
    .addEventListener(
      "click",
      async () => {

        const value =
          password.value;

        if (!value) {
          showStatus(
            "أدخل كلمة مرور 2FA.",
            true
          );
          return;
        }

        const btn =
          document.getElementById(
            "passwordBtn"
          );

        btn.disabled =
          true;

        hideStatus();

        try {
          await request(
            "/api/telegram-login/password",
            {
              password: value
            }
          );

          showStep(
            successStep
          );

        } catch (error) {
          showStatus(
            error.message ||
            "تعذر إكمال تسجيل الدخول.",
            true
          );
        } finally {
          btn.disabled =
            false;
        }
      }
    );

})();
</script>

</body>
</html>`;
}

function safeError(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  if (
    message.includes(
      "FloodWait"
    ) ||
    message.includes(
      "PHONE_NUMBER_FLOOD"
    ) ||
    message.includes(
      "Please wait"
    )
  ) {
    return "Telegram طلب الانتظار قبل إعادة محاولة تسجيل الدخول. انتظر ثم حاول لاحقًا.";
  }

  if (
    message ===
    "INVALID_PHONE"
  ) {
    return "رقم الهاتف غير صحيح. استخدم الصيغة الدولية.";
  }

  if (
    message.includes(
      "PHONE_CODE_INVALID"
    )
  ) {
    return "رمز Telegram غير صحيح.";
  }

  if (
    message.includes(
      "PHONE_CODE_EXPIRED"
    )
  ) {
    return "انتهت صلاحية رمز Telegram. ابدأ تسجيل دخول جديد.";
  }

  if (
    message.includes(
      "PASSWORD_NOT_REQUESTED"
    )
  ) {
    return "كلمة المرور ليست مطلوبة حاليًا.";
  }

  return "تعذر إكمال تسجيل الدخول. حاول مرة أخرى.";
}

export function registerTelegramLoginRoutes(
  app: Application
) {
  app.get(
    "/telegram-login",
    (_req, res) => {
      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      res.type("html").send(
        html()
      );
    }
  );

  app.post(
    "/api/telegram-login/start",
    async (req, res) => {
      const token =
        getToken(req);

      const session =
        getWebTelegramLoginSession(
          token
        );

      if (!session) {
        res
          .status(401)
          .json({
            ok: false,
            error:
              "رابط التسجيل غير صالح أو انتهت صلاحيته."
          });
        return;
      }

      const phone =
        String(
          req.body?.phone ??
          ""
        ).trim();

      if (!phone) {
        res
          .status(400)
          .json({
            ok: false,
            error:
              "أدخل رقم الهاتف."
          });
        return;
      }

      try {
        const result =
          await beginLogin(
            session.userId,
            session.telegramId,
            phone
          );

        res.json({
          ok: true,
          deliveredToApp:
            result.deliveredToApp
        });
      } catch (error) {
        res
          .status(400)
          .json({
            ok: false,
            error:
              safeError(error)
          });
      }
    }
  );

  app.post(
    "/api/telegram-login/code",
    async (req, res) => {
      const token =
        getToken(req);

      const session =
        getWebTelegramLoginSession(
          token
        );

      if (!session) {
        res
          .status(401)
          .json({
            ok: false,
            error:
              "جلسة التسجيل غير صالحة."
          });
        return;
      }

      try {
        const result =
          await submitLoginCode(
            session.telegramId,
            String(
              req.body?.code ??
              ""
            )
          );

        if (
          result.status ===
          "password"
        ) {
          res.json({
            ok: true,
            status:
              "password"
          });
          return;
        }

        if (
          result.status ===
          "completed"
        ) {
          deleteWebTelegramLoginToken(
            token
          );

          res.json({
            ok: true,
            status:
              "completed"
          });
          return;
        }

        throw result.error;

      } catch (error) {
        res
          .status(400)
          .json({
            ok: false,
            error:
              safeError(error)
          });
      }
    }
  );

  app.post(
    "/api/telegram-login/password",
    async (req, res) => {
      const token =
        getToken(req);

      const session =
        getWebTelegramLoginSession(
          token
        );

      if (!session) {
        res
          .status(401)
          .json({
            ok: false,
            error:
              "جلسة التسجيل غير صالحة."
          });
        return;
      }

      try {
        const result =
          await submitLoginPassword(
            session.telegramId,
            String(
              req.body?.password ??
              ""
            )
          );

        if (
          result.status ===
          "completed"
        ) {
          deleteWebTelegramLoginToken(
            token
          );

          res.json({
            ok: true,
            status:
              "completed"
          });
          return;
        }

        if (
          result.status ===
          "failed"
        ) {
          throw result.error;
        }

        res.json({
          ok: true,
          status:
            result.status
        });

      } catch (error) {
        res
          .status(400)
          .json({
            ok: false,
            error:
              safeError(error)
          });
      }
    }
  );

  app.post(
    "/api/telegram-login/cancel",
    (req, res) => {
      const token =
        getToken(req);

      const session =
        getWebTelegramLoginSession(
          token
        );

      if (session) {
        cancelLogin(
          session.telegramId
        );
      }

      deleteWebTelegramLoginToken(
        token
      );

      res.json({
        ok: true
      });
    }
  );
}
