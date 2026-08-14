import { Api } from "teleproto";
import { supabase } from "../db/supabase.js";
import { getTelegramClient } from "../telegram/clientManager.js";

interface PendingChatAdd {
  userId: string;
  accountId: string;
  input: string;
  createdAt: number;
}

const pending =
  new Map<number, PendingChatAdd>();

const EXPIRY_MS =
  10 * 60 * 1000;

function cleanup() {
  const now = Date.now();

  for (const [telegramId, item] of pending) {
    if (
      now - item.createdAt >
      EXPIRY_MS
    ) {
      pending.delete(
        telegramId
      );
    }
  }
}

function parseInput(input: string) {
  const value =
    input.trim();

  if (!value) {
    throw new Error(
      "EMPTY_CHAT"
    );
  }

  if (value.startsWith("@")) {
    return {
      type: "username" as const,
      value
    };
  }

  const publicLink =
    value.match(
      /^https?:\/\/t\.me\/([A-Za-z0-9_]{4,})\/?$/i
    );

  if (publicLink) {
    return {
      type: "username" as const,
      value:
        `@${publicLink[1]}`
    };
  }

  const inviteLink =
    value.match(
      /^https?:\/\/t\.me\/(?:\+|joinchat\/)([A-Za-z0-9_-]+)\/?$/i
    );

  if (inviteLink) {
    return {
      type: "invite" as const,
      value:
        inviteLink[1]
    };
  }

  throw new Error(
    "INVALID_CHAT_INPUT"
  );
}

export function setPendingChatAdd(
  telegramId: number,
  data: {
    userId: string;
    accountId: string;
    input: string;
  }
) {
  cleanup();

  pending.set(
    telegramId,
    {
      ...data,
      createdAt:
        Date.now()
    }
  );
}

export function getPendingChatAdd(
  telegramId: number
) {
  cleanup();

  return (
    pending.get(
      telegramId
    ) ?? null
  );
}

export function clearPendingChatAdd(
  telegramId: number
) {
  pending.delete(
    telegramId
  );
}

async function saveGroup(
  userId: string,
  accountId: string,
  entity: any
) {
  if (!entity?.id) {
    throw new Error(
      "CHAT_NOT_FOUND"
    );
  }

  const telegramChatId =
    String(entity.id);

  const title =
    entity.title ||
    entity.username ||
    "مجموعة بدون اسم";

  const username =
    typeof entity.username ===
      "string" &&
    entity.username
      ? `@${entity.username}`
      : null;

  const {
    data: group,
    error
  } = await supabase
    .from("groups")
    .upsert(
      {
        telegram_chat_id:
          telegramChatId,
        title,
        username,
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
    !group
  ) {
    throw new Error(
      error?.message ||
      "GROUP_SAVE_FAILED"
    );
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
          group.id,
        is_active:
          true,
        source:
          "manual"
      },
      {
        onConflict:
          "user_id,telegram_account_id,group_id"
      }
    );

  return {
    groupId:
      group.id,
    telegramChatId,
    title,
    username
  };
}

export async function prepareChatAdd(
  telegramId: number,
  userId: string,
  accountId: string,
  input: string
) {
  const parsed =
    parseInput(input);

  setPendingChatAdd(
    telegramId,
    {
      userId,
      accountId,
      input:
        parsed.value
    }
  );

  const client =
    await getTelegramClient(
      accountId
    );

  if (
    parsed.type ===
    "username"
  ) {
    const entity =
      await client.getEntity(
        parsed.value
      );

    if (!entity) {
      throw new Error(
        "CHAT_NOT_FOUND"
      );
    }

    return {
      type:
        "public" as const,

      title:
        (entity as any)
          .title ||
        (entity as any)
          .username ||
        parsed.value,

      username:
        (entity as any)
          .username
          ? `@${(entity as any).username}`
          : null
    };
  }

  return {
    type:
      "invite" as const,

    title:
      "رابط دعوة Telegram",

    username:
      null
  };
}

export async function confirmChatAdd(
  telegramId: number
) {
  const item =
    getPendingChatAdd(
      telegramId
    );

  if (!item) {
    throw new Error(
      "NO_PENDING_CHAT"
    );
  }

  const parsed =
    parseInput(
      item.input
    );

  const client =
    await getTelegramClient(
      item.accountId
    );

  let entity:
    any = null;

  const joined =
    false;

  if (
    parsed.type ===
    "invite"
  ) {
    const preview =
      await client.invoke(
        new Api.messages.CheckChatInvite({
          hash:
            parsed.value
        })
      );

    if (
      "chat" in preview &&
      preview.chat
    ) {
      entity =
        preview.chat;
    } else {
      throw new Error(
        "JOIN_MANUALLY_FIRST"
      );
    }
  } else {
    entity =
      await client.getEntity(
        parsed.value
      );

    if (!entity) {
      throw new Error(
        "CHAT_NOT_FOUND"
      );
    }
  }

  if (!entity) {
    throw new Error(
      "CHAT_NOT_FOUND"
    );
  }

  const saved =
    await saveGroup(
      item.userId,
      item.accountId,
      entity
    );

  clearPendingChatAdd(
    telegramId
  );

  return {
    ...saved,
    joined
  };
}

export function cancelChatAdd(
  telegramId: number
) {
  clearPendingChatAdd(
    telegramId
  );
}
