import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types/bot.js";
import { env } from "../config/env.js";
import { getOrCreateUser, attachReferral, ensureOwnerAdmin } from "../services/users.js";
import { checkAllRequiredChannels } from "../services/membership.js";
import { confirmReferral, processReferralRewards } from "../services/referrals.js";
import { getAppSettings } from "../services/settings.js";
import { bot } from "./index.js";
import { sendDashboard } from "./dashboard.js";
import { cancelAllActions } from "../services/actionManager.js";

function parseReferral(match: unknown): number | null {
  const value = String(match ?? "").trim();

  if (!value) return null;

  const normalized = value.startsWith("ref_")
    ? value.slice(4)
    : value;

  if (!/^\d+$/.test(normalized)) return null;

  const id = Number(normalized);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function buildMembershipKeyboard(
  results: Awaited<
    ReturnType<typeof checkAllRequiredChannels>
  >["results"]
) {
  const keyboard = new InlineKeyboard();

  for (const item of results) {
    const url =
      item.channel.invite_url ||
      (item.channel.username
        ? `https://t.me/${item.channel.username.replace(/^@/, "")}`
        : null);

    if (url) {
      keyboard
        .url(
          `📢 ${item.channel.title || item.channel.username || "القناة"}`,
          url
        )
        .row();
    }
  }

  keyboard.text("✅ تحقق من الاشتراك", "check_membership");

  return keyboard;
}

export async function handleStart(ctx: BotContext) {
  if (!ctx.from) return;

  await cancelAllActions(ctx.from.id);

  const user = await getOrCreateUser({
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name
  });

  await ensureOwnerAdmin(ctx.from.id);

  const referralId = parseReferral(ctx.match);

  if (referralId) {
    await attachReferral(user, referralId);
  }

  const membership = await checkAllRequiredChannels(
    bot,
    ctx.from.id
  );

  if (!membership.complete) {
    const joined = membership.results.filter(
      (item) => item.joined
    ).length;

    await ctx.reply(
      "🔒 الاشتراك مطلوب للمتابعة\n\n" +
        "اشترك في جميع القنوات المطلوبة، ثم اضغط على زر التحقق.\n\n" +
        `✅ تم الاشتراك: ${joined}/${membership.results.length}`,
      {
        reply_markup: buildMembershipKeyboard(
          membership.results
        )
      }
    );

    return;
  }

  const referralCount = await confirmReferral(user);

  if (user.referred_by) {
    await processReferralRewards(
      user.referred_by,
      referralCount
    );
  }

  const fresh = await getOrCreateUser({
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name
  });

  const settings = await getAppSettings();

  const activeVip =
    !!fresh.vip_expires_at &&
    new Date(fresh.vip_expires_at) > new Date();

  await sendDashboard(ctx);
}
