import { Api } from "teleproto";
import { supabase } from "../db/supabase.js";
import { getTelegramClient } from "../telegram/clientManager.js";
import { getAppSettings } from "./settings.js";

interface ResolvedChatItem {
  input: string;
  entity: any;
  title: string;
  username: string | null;
}

interface PendingChatAdd {
  userId: string;
  accountId: string;
  items: ResolvedChatItem[];
  createdAt: number;
}

const pending = new Map<number, PendingChatAdd>();

const EXPIRY_MS = 10 * 60 * 1000;

/*
 * حد أقصى لعدد الروابط بكل دفعة — يحمي من حلقة طويلة جداً من طلبات
 * Telegram دفعة وحدة، ويعطي فرصة لتقسيم عدد كبير من الروابط عبر أكثر
 * من رسالة.
 */
const MAX_LINES_PER_BATCH = 20;

/*
 * تأخير بسيط بين فحص كل رابط والي بعده.
 */
const RESOLVE_DELAY_MS = 350;

function cleanup() {
  const now = Date.now();

  for (const [telegramId, item] of pending) {
    if (now - item.createdAt > EXPIRY_MS) {
      pending.delete(telegramId);
    }
  }
}

function parseInput(rawLine: string) {
  const value = rawLine.trim();

  if (!value) {
    throw new Error("EMPTY_CHAT");
  }

  if (value.startsWith("@")) {
    return { type: "username" as const, value };
  }

  const publicLink = value.match(
    /^https?:\/\/t\.me\/([A-Za-z0-9_]{4,})\/?$/i
  );

  if (publicLink) {
    return { type: "username" as const, value: `@${publicLink[1]}` };
  }

  const inviteLink = value.match(
    /^https?:\/\/t\.me\/(?:\+|joinchat\/)([A-Za-z0-9_-]+)\/?$/i
  );

  if (inviteLink) {
    return { type: "invite" as const, value: inviteLink[1] };
  }

  throw new Error("INVALID_CHAT_INPUT");
}

function failureLabel(reason: string) {
  const labels: Record<string, string> = {
    EMPTY_CHAT: "سطر فارغ",
    INVALID_CHAT_INPUT: "رابط/معرّف غير صالح",
    CHAT_NOT_FOUND: "لم يتم العثور عليها",
    JOIN_MANUALLY_FIRST: "الحساب غير منضم لها — انضم يدوياً أولاً"
  };

  return labels[reason] || "تعذر التحقق منها";
}

async function resolveOneLine(
  client: any,
  rawLine: string
): Promise<ResolvedChatItem> {
  const parsed = parseInput(rawLine);

  if (parsed.type === "invite") {
    const preview = await client.invoke(
      new Api.messages.CheckChatInvite({ hash: parsed.value })
    );

    if ("chat" in preview && preview.chat) {
      const entity = preview.chat as any;

      return {
        input: rawLine.trim(),
        entity,
        title: entity.title || "رابط دعوة",
        username: null
      };
    }

    throw new Error("JOIN_MANUALLY_FIRST");
  }

  const entity = await client.getEntity(parsed.value);

  if (!entity) {
    throw new Error("CHAT_NOT_FOUND");
  }

  return {
    input: rawLine.trim(),
    entity,
    title: (entity as any).title || (entity as any).username || parsed.value,
    username: (entity as any).username ? `@${(entity as any).username}` : null
  };
}

export function getPendingChatAdd(telegramId: number) {
  cleanup();
  return pending.get(telegramId) ?? null;
}

export function clearPendingChatAdd(telegramId: number) {
  pending.delete(telegramId);
}

export interface BulkChatAddSummary {
  resolved: { title: string; username: string | null }[];
  failed: { input: string; reason: string }[];
  truncated: number;
}

/*
 * يقبل سطراً واحداً أو عدة أسطر (رابط/Username لكل سطر). يتحقق من كل
 * واحد على حدة (بدون حفظ أي شيء بعد)، ويخزّن الصالح منها مؤقتاً بانتظار
 * تأكيدك عبر confirmChatAdd.
 */
export async function prepareChatAdd(
  telegramId: number,
  userId: string,
  accountId: string,
  rawInput: string
): Promise<BulkChatAddSummary> {
  const lines = rawInput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("EMPTY_CHAT");
  }

  const truncated = Math.max(0, lines.length - MAX_LINES_PER_BATCH);
  const batch = lines.slice(0, MAX_LINES_PER_BATCH);

  const client = await getTelegramClient(accountId);

  const resolved: ResolvedChatItem[] = [];
  const failed: { input: string; reason: string }[] = [];

  for (let i = 0; i < batch.length; i++) {
    try {
      resolved.push(await resolveOneLine(client, batch[i]));
    } catch (error) {
      failed.push({
        input: batch[i],
        reason: failureLabel(
          error instanceof Error ? error.message : "UNKNOWN"
        )
      });
    }

    if (i < batch.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RESOLVE_DELAY_MS));
    }
  }

  cleanup();
  pending.set(telegramId, {
    userId,
    accountId,
    items: resolved,
    createdAt: Date.now()
  });

  return {
    resolved: resolved.map((item) => ({
      title: item.title,
      username: item.username
    })),
    failed,
    truncated
  };
}

async function saveGroup(
  userId: string,
  accountId: string,
  entity: any,
  activate: boolean
) {
  const telegramChatId = String(entity.id);
  const title = entity.title || entity.username || "مجموعة بدون اسم";

  const username =
    typeof entity.username === "string" && entity.username
      ? `@${entity.username}`
      : null;

  const { data: group, error } = await supabase
    .from("groups")
    .upsert(
      { telegram_chat_id: telegramChatId, title, username, is_active: true },
      { onConflict: "telegram_chat_id" }
    )
    .select("id")
    .single();

  if (error || !group) {
    throw new Error(error?.message || "GROUP_SAVE_FAILED");
  }

  await supabase.from("user_groups").upsert(
    {
      user_id: userId,
      telegram_account_id: accountId,
      group_id: group.id,
      is_active: activate,
      source: "manual"
    },
    { onConflict: "user_id,telegram_account_id,group_id" }
  );

  return { groupId: group.id, telegramChatId, title, username };
}

export interface ConfirmChatAddResult {
  activated: { title: string; username: string | null }[];
  addedInactive: { title: string; username: string | null }[];
}

export async function confirmChatAdd(
  telegramId: number
): Promise<ConfirmChatAddResult> {
  const item = getPendingChatAdd(telegramId);

  if (!item || !item.items.length) {
    throw new Error("NO_PENDING_CHAT");
  }

  /*
   * نحترم حد المجموعات المفعّلة (free/vip): نضيف كل الروابط الصالحة،
   * لكن نفعّل فقط بقدر ما تبقى من حدك — الباقي يُضاف بدون تفعيل بدل
   * ما نرفضه بالكامل، حتى تقدر تفعّله لاحقاً بعد ما توقف وجهة ثانية.
   */
  const { data: userRow } = await supabase
    .from("users")
    .select("plan, vip_expires_at")
    .eq("id", item.userId)
    .single();

  const vip =
    userRow?.plan === "vip" &&
    !!userRow.vip_expires_at &&
    new Date(userRow.vip_expires_at) > new Date();

  const settings = await getAppSettings();
  const limit = vip ? settings.vip_group_limit : settings.free_group_limit;

  const { count: activeCount } = await supabase
    .from("user_groups")
    .select("id", { count: "exact", head: true })
    .eq("user_id", item.userId)
    .eq("telegram_account_id", item.accountId)
    .eq("source", "manual")
    .eq("is_active", true);

  let remaining = Math.max(0, limit - (activeCount ?? 0));

  const activated: { title: string; username: string | null }[] = [];
  const addedInactive: { title: string; username: string | null }[] = [];

  for (const entry of item.items) {
    const activate = remaining > 0;

    const saved = await saveGroup(
      item.userId,
      item.accountId,
      entry.entity,
      activate
    );

    if (activate) {
      remaining--;
      activated.push({ title: saved.title, username: saved.username });
    } else {
      addedInactive.push({ title: saved.title, username: saved.username });
    }
  }

  clearPendingChatAdd(telegramId);

  return { activated, addedInactive };
}

export function cancelChatAdd(telegramId: number) {
  clearPendingChatAdd(telegramId);
}
