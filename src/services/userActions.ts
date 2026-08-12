import { supabase } from "../db/supabase.js";

export async function setUserAction(
  telegramId: number,
  action: string
) {
  const { error } =
    await supabase
      .from("user_actions")
      .upsert({
        telegram_id:
          telegramId,
        action,
        expires_at:
          new Date(
            Date.now() +
              10 * 60 * 1000
          ).toISOString()
      });

  if (error) {
    throw new Error(
      error.message
    );
  }
}

export async function getUserAction(
  telegramId: number
) {
  const { data, error } =
    await supabase
      .from("user_actions")
      .select(
        "action, expires_at"
      )
      .eq(
        "telegram_id",
        telegramId
      )
      .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (
    new Date(
      data.expires_at
    ) <= new Date()
  ) {
    await clearUserAction(
      telegramId
    );

    return null;
  }

  return data.action;
}

export async function clearUserAction(
  telegramId: number
) {
  await supabase
    .from("user_actions")
    .delete()
    .eq(
      "telegram_id",
      telegramId
    );
}
