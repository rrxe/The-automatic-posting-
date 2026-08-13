import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions/index.js";

import { env } from "../config/env.js";
import { supabase } from "../db/supabase.js";
import { encrypt } from "../utils/crypto.js";
import {
  clearUserAction,
  setUserAction
} from "../services/userActions.js";

interface PendingLogin {
  client: TelegramClient;
  stormUserId: string;
  phone: string;

  status:
    | "waiting_code"
    | "waiting_password"
    | "completed"
    | "failed";

  codeResolver:
    ((code: string) => void) | null;

  passwordResolver:
    ((password: string) => void) | null;

  waitResolver:
    ((result: LoginStepResult) => void) | null;

  error: Error | null;

  isCodeViaApp: boolean | null;

  startedAt: number;
}

export type LoginStepResult =
  | {
      status: "password";
    }
  | {
      status: "completed";
      account: unknown;
    }
  | {
      status: "failed";
      error: Error;
    };

const pendingLogins =
  new Map<number, PendingLogin>();

function assertTelegramConfig() {
  if (
    !env.TELEGRAM_API_ID ||
    !env.TELEGRAM_API_HASH
  ) {
    throw new Error(
      "TELEGRAM_API_NOT_CONFIGURED"
    );
  }

  if (!env.SESSION_ENCRYPTION_KEY) {
    throw new Error(
      "SESSION_ENCRYPTION_KEY_NOT_CONFIGURED"
    );
  }
}

function normalizePhone(
  input: string
): string {
  let phone = input
    .trim()
    .replace(/[\s()-]/g, "");

  if (phone.startsWith("00")) {
    phone =
      "+" + phone.slice(2);
  }

  if (!phone.startsWith("+")) {
    phone = "+" + phone;
  }

  /*
   * Accept international phone numbers.
   * No country is hard-coded here.
   */
  if (
    !/^\+[1-9]\d{7,14}$/.test(
      phone
    )
  ) {
    throw new Error(
      "INVALID_PHONE"
    );
  }

  return phone;
}

function normalizeCode(
  input: string
): string {
  const arabic =
    "٠١٢٣٤٥٦٧٨٩";

  const persian =
    "۰۱۲۳۴۵۶۷۸۹";

  return input
    .trim()
    .replace(/[٠-٩]/g, (char) =>
      String(
        arabic.indexOf(char)
      )
    )
    .replace(/[۰-۹]/g, (char) =>
      String(
        persian.indexOf(char)
      )
    )
    .replace(/[\s.-]/g, "");
}

async function saveTelegramAccount(
  pending: PendingLogin
) {
  const me =
    await pending.client.getMe();

  if (
    !me ||
    !("id" in me)
  ) {
    throw new Error(
      "LOGIN_FAILED"
    );
  }

  const session =
    pending.client.session.save();

  if (!session) {
    throw new Error(
      "SESSION_SAVE_FAILED"
    );
  }

  const encrypted =
    encrypt(session);

  const telegramUserId =
    Number(me.id);

  const username =
    "username" in me &&
    me.username
      ? String(me.username)
      : null;

  const displayName =
    [
      "firstName" in me
        ? me.firstName
        : null,
      "lastName" in me
        ? me.lastName
        : null
    ]
      .filter(Boolean)
      .join(" ") || null;

  const phoneHint =
    pending.phone.length >= 4
      ? `••••${pending.phone.slice(-4)}`
      : "••••";

  const {
    data,
    error
  } = await supabase
    .from(
      "telegram_accounts"
    )
    .insert({
      user_id:
        pending.stormUserId,

      telegram_user_id:
        telegramUserId,

      phone_hint:
        phoneHint,

      session_encrypted:
        encrypted,

      is_active:
        true,

      display_name:
        displayName,

      username,

      last_connected_at:
        new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) {
    if (
      error.code === "23505"
    ) {
      throw new Error(
        "ACCOUNT_ALREADY_LINKED"
      );
    }

    throw new Error(
      error.message
    );
  }

  return data;
}

function finishWait(
  telegramId: number,
  result: LoginStepResult
) {
  const pending =
    pendingLogins.get(
      telegramId
    );

  if (!pending) {
    return;
  }

  const resolver =
    pending.waitResolver;

  pending.waitResolver =
    null;

  resolver?.(result);
}

export async function beginLogin(
  stormUserId: string,
  telegramId: number,
  phone: string
) {
  assertTelegramConfig();

  cancelLogin(
    telegramId
  );

  const cleanPhone =
    normalizePhone(phone);

  const client =
    new TelegramClient(
      new StringSession(""),
      env.TELEGRAM_API_ID,
      env.TELEGRAM_API_HASH,
      {
        connectionRetries: 5
      }
    );

  await client.connect();

  const pending =
    {} as PendingLogin;

  pending.client =
    client;

  pending.stormUserId =
    stormUserId;

  pending.phone =
    cleanPhone;

  pending.status =
    "waiting_code";

  pending.codeResolver =
    null;

  pending.passwordResolver =
    null;

  pending.waitResolver =
    null;

  pending.error =
    null;

  pending.isCodeViaApp =
    null;

  pending.startedAt =
    Date.now();

  pendingLogins.set(
    telegramId,
    pending
  );

  console.log(
    "TELEGRAM LOGIN START:",
    {
      telegramId,
      phonePrefix:
        cleanPhone.slice(
          0,
          Math.min(
            5,
            cleanPhone.length
          )
        ),
      phoneLength:
        cleanPhone.length
    }
  );

  client
    .start({
      phoneNumber:
        async () =>
          cleanPhone,

      forceSMS:
        false,

      phoneCode:
        async (
          isCodeViaApp?: boolean
        ) => {
          pending.status =
            "waiting_code";

          pending.isCodeViaApp =
            Boolean(
              isCodeViaApp
            );

          console.log(
            "TELEGRAM LOGIN CODE REQUESTED:",
            {
              telegramId,

              isCodeViaApp:
                Boolean(
                  isCodeViaApp
                ),

              delivery:
                isCodeViaApp
                  ? "telegram_app"
                  : "sms_or_non_app"
            }
          );

          /*
           * Do not expose the actual code
           * in logs.
           */
          return new Promise<string>(
            (resolve) => {
              pending.codeResolver =
                resolve;
            }
          );
        },

      password:
        async () => {
          pending.status =
            "waiting_password";

          await setUserAction(
            telegramId,
            "telegram_password"
          );

          console.log(
            "TELEGRAM 2FA PASSWORD REQUESTED:",
            telegramId
          );

          finishWait(
            telegramId,
            {
              status:
                "password"
            }
          );

          return new Promise<string>(
            (resolve) => {
              pending.passwordResolver =
                resolve;
            }
          );
        },

      /*
       * Some Telegram accounts can require
       * email verification instead of a phone
       * code. We don't fake or bypass this.
       *
       * Returning a clear error is safer than
       * hanging the login forever.
       */
      emailAddress:
        async () => {
          throw new Error(
            "TELEGRAM_EMAIL_VERIFICATION_REQUIRED"
          );
        },

      emailVerification:
        async () => {
          throw new Error(
            "TELEGRAM_EMAIL_VERIFICATION_REQUIRED"
          );
        },

      onError:
        async (
          error: Error
        ) => {
          pending.error =
            error;

          console.error(
            "TELEGRAM LOGIN FLOW ERROR:",
            {
              telegramId,
              message:
                error.message,
              name:
                error.name
            }
          );

          return false;
        }
    })
    .then(
      async () => {
        try {
          const account =
            await saveTelegramAccount(
              pending
            );

          pending.status =
            "completed";

          await clearUserAction(
            telegramId
          );

          finishWait(
            telegramId,
            {
              status:
                "completed",
              account
            }
          );

          console.log(
            "TELEGRAM LOGIN COMPLETED:",
            telegramId
          );
        } catch (error) {
          const finalError =
            error instanceof Error
              ? error
              : new Error(
                  String(error)
                );

          pending.status =
            "failed";

          pending.error =
            finalError;

          await clearUserAction(
            telegramId
          );

          finishWait(
            telegramId,
            {
              status:
                "failed",
              error:
                finalError
            }
          );

          console.error(
            "TELEGRAM SAVE ACCOUNT ERROR:",
            {
              telegramId,
              message:
                finalError.message
            }
          );
        }

        await client
          .disconnect()
          .catch(() => {});

        pendingLogins.delete(
          telegramId
        );
      }
    )
    .catch(
      async (error) => {
        const finalError =
          error instanceof Error
            ? error
            : new Error(
                String(error)
              );

        pending.status =
          "failed";

        pending.error =
          finalError;

        await clearUserAction(
          telegramId
        );

        finishWait(
          telegramId,
          {
            status:
              "failed",
            error:
              finalError
          }
        );

        console.error(
          "TELEGRAM LOGIN FAILED:",
          {
            telegramId,
            message:
              finalError.message,
            name:
              finalError.name
          }
        );

        await client
          .disconnect()
          .catch(() => {});

        pendingLogins.delete(
          telegramId
        );
      }
    );

  /*
   * Wait until teleproto actually asks us
   * for the verification code.
   */
  const startWaitTimeout =
    90_000;

  const startedAt =
    Date.now();

  while (
    pending.codeResolver === null &&
    pending.status ===
      "waiting_code"
  ) {
    if (
      Date.now() -
        startedAt >
      startWaitTimeout
    ) {
      cancelLogin(
        telegramId
      );

      throw new Error(
        "TELEGRAM_CODE_REQUEST_TIMEOUT"
      );
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          25
        )
    );
  }

  return {
    deliveredToApp:
      Boolean(
        pending.isCodeViaApp
      )
  };
}

export async function submitLoginCode(
  telegramId: number,
  code: string
): Promise<LoginStepResult> {
  const pending =
    pendingLogins.get(
      telegramId
    );

  if (!pending) {
    throw new Error(
      "NO_PENDING_LOGIN"
    );
  }

  const normalized =
    normalizeCode(code);

  if (
    !/^\d{3,8}$/.test(
      normalized
    )
  ) {
    throw new Error(
      "PHONE_CODE_INVALID"
    );
  }

  const resolver =
    pending.codeResolver;

  if (!resolver) {
    throw new Error(
      "CODE_NOT_REQUESTED"
    );
  }

  pending.codeResolver =
    null;

  resolver(
    normalized
  );

  /*
   * Wait for:
   *
   * 1. 2FA password
   * 2. successful login
   * 3. login failure
   */
  return new Promise(
    (resolve) => {
      pending.waitResolver =
        resolve;
    }
  );
}

export async function submitLoginPassword(
  telegramId: number,
  password: string
): Promise<LoginStepResult> {
  const pending =
    pendingLogins.get(
      telegramId
    );

  if (!pending) {
    throw new Error(
      "NO_PENDING_LOGIN"
    );
  }

  if (!password.trim()) {
    throw new Error(
      "INVALID_PASSWORD"
    );
  }

  const resolver =
    pending.passwordResolver;

  if (!resolver) {
    throw new Error(
      "PASSWORD_NOT_REQUESTED"
    );
  }

  pending.passwordResolver =
    null;

  resolver(
    password.trim()
  );

  return new Promise(
    (resolve) => {
      pending.waitResolver =
        resolve;
    }
  );
}

export function cancelLogin(
  telegramId: number
) {
  const pending =
    pendingLogins.get(
      telegramId
    );

  if (!pending) {
    return;
  }

  try {
    pending.codeResolver =
      null;

    pending.passwordResolver =
      null;

    pending.waitResolver =
      null;
  } catch {}

  pending.client
    .disconnect()
    .catch(() => {});

  pendingLogins.delete(
    telegramId
  );

  clearUserAction(
    telegramId
  ).catch(() => {});
}

export function hasPendingLogin(
  telegramId: number
) {
  return pendingLogins.has(
    telegramId
  );
}
