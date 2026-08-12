import {
  getAdminAction,
  clearAdminAction
} from "./adminChannels.js";

import {
  getUserAction,
  setUserAction,
  clearUserAction
} from "./userActions.js";

import {
  cancelLogin
} from "../telegram/auth.js";

export async function cancelAllActions(
  telegramId: number
) {
  cancelLogin(telegramId);

  await Promise.all([
    clearUserAction(telegramId),
    clearAdminAction(telegramId)
  ]);
}

export async function startUserActionExclusive(
  telegramId: number,
  action: string
) {
  await cancelAllActions(telegramId);

  await setUserAction(
    telegramId,
    action
  );
}

export async function startAdminActionExclusive(
  telegramId: number,
  action: string
) {
  await cancelAllActions(telegramId);

  await setAdminAction(
    telegramId,
    action
  );
}

async function setAdminAction(
  telegramId: number,
  action: string
) {
  const { supabase } = await import("../db/supabase.js");

  const { error } = await supabase
    .from("admin_sessions")
    .upsert({
      telegram_id: telegramId,
      action,
      expires_at: new Date(
        Date.now() + 10 * 60 * 1000
      ).toISOString()
    });

  if (error) {
    throw new Error(
      `Failed to set admin action: ${error.message}`
    );
  }
}

export async function getCurrentAction(
  telegramId: number
) {
  const userAction =
    await getUserAction(telegramId);

  if (userAction) {
    return {
      type: "user" as const,
      action: userAction
    };
  }

  const adminAction =
    await getAdminAction(telegramId);

  if (adminAction) {
    return {
      type: "admin" as const,
      action: adminAction
    };
  }

  return null;
}
