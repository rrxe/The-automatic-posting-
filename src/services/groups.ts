import { supabase } from "../db/supabase.js";
import {
  getTelegramClient
} from "../telegram/clientManager.js";
import {
  getAppSettings
} from "./settings.js";

function toIdString(
  value: unknown
): string {
  return typeof value === "bigint"
    ? value.toString()
    : String(value);
}

function isSelectableEntity(
  entity: any
): boolean {
  if (!entity) {
    return false;
  }

  /*
   * مجموعات Telegram العادية.
   */
  if (
    entity.className === "Chat"
  ) {
    return true;
  }

  /*
   * Supergroups.
   */
  if (
    entity.className === "Channel" &&
    entity.megagroup === true
  ) {
    return true;
  }

  /*
   * القنوات التي يملك المستخدم
   * صلاحية التعامل معها.
   */
  if (
    entity.className === "Channel" &&
    entity.broadcast === true &&
    entity.adminRights
  ) {
    return true;
  }

  return false;
}

function getTitle(
  entity: any
): string {
  return (
    entity?.title ||
    (entity?.username
      ? `@${entity.username}`
      : null) ||
    "بدون اسم"
  );
}

function getUsername(
  entity: any
): string | null {
  if (
    typeof entity?.username ===
    "string" &&
    entity.username
  ) {
    return `@${entity.username}`;
  }

  return null;
}

export async function syncAccountGroups(
  userId: string,
  accountId: string
) {
  const client =
    await getTelegramClient(
      accountId
    );

  const dialogs: Array<{
    telegramChatId: string;
    title: string;
    username: string | null;
  }> = [];

  for await (
    const dialog of client.iterDialogs({
      limit: 500
    })
  ) {
    const entity: any =
      dialog?.entity;

    if (
      !isSelectableEntity(entity)
    ) {
      continue;
    }

    if (!entity?.id) {
      continue;
    }

    dialogs.push({
      telegramChatId:
        toIdString(entity.id),
      title:
        getTitle(entity),
      username:
        getUsername(entity)
    });
  }

  for (const group of dialogs) {
    const {
      data: saved,
      error
    } = await supabase
      .from("groups")
      .upsert(
        {
          telegram_chat_id:
            group.telegramChatId,
          title:
            group.title,
          username:
            group.username,
          is_active:
            true
        },
        {
          onConflict:
            "telegram_chat_id"
        }
      )
      .select("id")
      .single();

    if (
      error ||
      !saved
    ) {
      console.error(
        "GROUP SAVE ERROR:",
        error?.message
      );
      continue;
    }

    await supabase
      .from("user_groups")
      .upsert(
        {
          user_id:
            userId,
          telegram_account_id:
            accountId,
          group_id:
            saved.id
        },
        {
          onConflict:
            "user_id,telegram_account_id,group_id"
        }
      );
  }

  return dialogs.length;
}

export async function getAccountGroups(
  userId: string,
  accountId: string
) {
  const {
    data,
    error
  } = await supabase
    .from("user_groups")
    .select(`
      id,
      group_id,
      is_active,
      groups (
        id,
        telegram_chat_id,
        title,
        username
      )
    `)
    .eq(
      "user_id",
      userId
    )
    .eq(
      "telegram_account_id",
      accountId
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return data ?? [];
}

export async function getSelectedGroups(
  userId: string,
  accountId: string
) {
  const {
    data,
    error
  } = await supabase
    .from("user_groups")
    .select(`
      id,
      group_id,
      is_active,
      groups (
        id,
        telegram_chat_id,
        title,
        username
      )
    `)
    .eq(
      "user_id",
      userId
    )
    .eq(
      "telegram_account_id",
      accountId
    )
    .eq(
      "is_active",
      true
    );

  if (error) {
    throw new Error(
      error.message
    );
  }

  return data ?? [];
}

export async function toggleGroupSelection(
  userId: string,
  accountId: string,
  userGroupId: string
) {
  const {
    data: row,
    error
  } = await supabase
    .from("user_groups")
    .select(
      "id, is_active"
    )
    .eq(
      "id",
      userGroupId
    )
    .eq(
      "user_id",
      userId
    )
    .eq(
      "telegram_account_id",
      accountId
    )
    .single();

  if (
    error ||
    !row
  ) {
    throw new Error(
      "GROUP_SELECTION_NOT_FOUND"
    );
  }

  if (!row.is_active) {
    const settings =
      await getAppSettings();

    const {
      data: user
    } = await supabase
      .from("users")
      .select(
        "plan, vip_expires_at"
      )
      .eq(
        "id",
        userId
      )
      .single();

    const vipActive =
      user?.plan === "vip" &&
      !!user.vip_expires_at &&
      new Date(
        user.vip_expires_at
      ) > new Date();

    const limit =
      vipActive
        ? settings.vip_group_limit
        : settings.free_group_limit;

    const {
      count
    } = await supabase
      .from("user_groups")
      .select(
        "id",
        {
          count:
            "exact",
          head:
            true
        }
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "telegram_account_id",
        accountId
      )
      .eq(
        "is_active",
        true
      );

    if (
      (count ?? 0) >=
      limit
    ) {
      throw new Error(
        "GROUP_LIMIT_REACHED"
      );
    }
  }

  const nextValue =
    !row.is_active;

  const {
    error:
      updateError
  } = await supabase
    .from("user_groups")
    .update({
      is_active:
        nextValue
    })
    .eq(
      "id",
      row.id
    )
    .eq(
      "user_id",
      userId
    )
    .eq(
      "telegram_account_id",
      accountId
    );

  if (updateError) {
    throw new Error(
      updateError.message
    );
  }

  return nextValue;
}
