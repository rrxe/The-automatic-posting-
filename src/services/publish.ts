import { supabase } from "../db/supabase.js";

import {
  getTelegramClient
} from "../telegram/clientManager.js";

import {
  getAppSettings
} from "./settings.js";

import {
  buildPreview
} from "./posts.js";

function errorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isFloodWait(
  error: unknown
) {
  const message =
    errorMessage(error);

  return (
    message.includes("FLOOD_WAIT") ||
    message.includes("FloodWait")
  );
}

function sleep(
  minutes: number
) {
  const ms =
    Math.max(0, minutes) *
    60 *
    1000;

  return new Promise<void>(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

async function resolveTargetEntity(
  client: any,
  group: {
    telegram_chat_id: string | number;
    username?: string | null;
    title?: string | null;
  }
) {
  if (
    group.username &&
    typeof group.username === "string"
  ) {
    const username =
      group.username
        .replace(/^@/, "")
        .trim();

    if (username) {
      return await client.getInputEntity(
        `@${username}`
      );
    }
  }

  const rawId =
    String(
      group.telegram_chat_id
    );

  if (!rawId) {
    throw new Error(
      "TELEGRAM_TARGET_ID_MISSING"
    );
  }

  try {
    const entity =
      await client.getEntity(
        BigInt(rawId)
      );

    return await client.getInputEntity(
      entity
    );
  } catch (firstError) {
    const numericId =
      Number(rawId);

    if (
      Number.isSafeInteger(
        numericId
      )
    ) {
      try {
        const entity =
          await client.getEntity(
            numericId
          );

        return await client.getInputEntity(
          entity
        );
      } catch {
        throw firstError;
      }
    }

    throw firstError;
  }
}

export async function createPublishRun(
  userId: string,
  accountId: string,
  messageId: string,
  selectedGroupIds: string[]
) {
  if (
    !selectedGroupIds.length
  ) {
    throw new Error(
      "NO_SELECTED_GROUPS"
    );
  }

  const {
    data: message,
    error: messageError
  } = await supabase
    .from("messages")
    .select(`
      id,
      content,
      signature_enabled
    `)
    .eq(
      "id",
      messageId
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
    messageError ||
    !message
  ) {
    throw new Error(
      "MESSAGE_NOT_FOUND"
    );
  }

  const {
    data: groups,
    error: groupsError
  } = await supabase
    .from("user_groups")
    .select(`
      group_id,
      is_active,
      source,
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
      "source",
      "manual"
    )
    .eq(
      "is_active",
      true
    )
    .in(
      "group_id",
      selectedGroupIds
    );

  if (groupsError) {
    throw new Error(
      groupsError.message
    );
  }

  if (
    !groups?.length
  ) {
    throw new Error(
      "NO_SELECTED_GROUPS"
    );
  }

  const {
    data: run,
    error: runError
  } = await supabase
    .from("publish_runs")
    .insert({
      user_id:
        userId,
      telegram_account_id:
        accountId,
      message_id:
        messageId,
      status:
        "pending",
      target_count:
        groups.length
    })
    .select("*")
    .single();

  if (
    runError ||
    !run
  ) {
    throw new Error(
      runError?.message ||
      "PUBLISH_RUN_CREATE_FAILED"
    );
  }

  const targets =
    groups.map(
      (row: any) => ({
        run_id:
          run.id,
        group_id:
          row.group_id,
        status:
          "pending"
      })
    );

  const {
    error: targetError
  } = await supabase
    .from(
      "publish_run_targets"
    )
    .insert(targets);

  if (targetError) {
    await supabase
      .from("publish_runs")
      .delete()
      .eq(
        "id",
        run.id
      );

    throw new Error(
      targetError.message
    );
  }

  const settings =
    await getAppSettings();

  const text =
    buildPreview(
      message.content,
      settings.signature,
      true
    );

  return {
    runId:
      run.id,
    targetCount:
      groups.length,
    message:
      text
  };
}

export async function executePublishCycles(
  userId: string,
  accountId: string,
  runId: string,
  cycleLimitOverride?: number,
  cycleDelayOverride?: number
) {
  const client =
    await getTelegramClient(
      accountId
    );

  const {
    data: run,
    error: runError
  } = await supabase
    .from("publish_runs")
    .select(`
      id,
      status,
      message_id,
      telegram_account_id
    `)
    .eq(
      "id",
      runId
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
    runError ||
    !run
  ) {
    throw new Error(
      "RUN_NOT_FOUND"
    );
  }

  if (
    run.status !==
    "pending"
  ) {
    throw new Error(
      "RUN_NOT_PENDING"
    );
  }

  const {
    data: message,
    error: messageError
  } = await supabase
    .from("messages")
    .select(`
      content,
      signature_enabled
    `)
    .eq(
      "id",
      run.message_id
    )
    .single();

  if (
    messageError ||
    !message
  ) {
    throw new Error(
      "MESSAGE_NOT_FOUND"
    );
  }

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

  const vip =
    user?.plan === "vip" &&
    !!user.vip_expires_at &&
    new Date(
      user.vip_expires_at
    ) > new Date();

  const configuredCycleLimit =
    vip
      ? settings.vip_cycle_limit
      : settings.free_cycle_limit;

  const configuredCycleDelay =
    vip
      ? settings.vip_cycle_delay_minutes
      : settings.free_cycle_delay_minutes;

  const cycleLimit =
    typeof cycleLimitOverride === "number" &&
    cycleLimitOverride > 0
      ? Math.min(
          Math.floor(cycleLimitOverride),
          configuredCycleLimit
        )
      : configuredCycleLimit;

  const cycleDelay =
    typeof cycleDelayOverride === "number" &&
    cycleDelayOverride >= 0
      ? Math.floor(cycleDelayOverride)
      : configuredCycleDelay;

  const messageDelay =
    settings.message_delay_minutes;

  const text =
    buildPreview(
      message.content,
      settings.signature,
      true
    );

  /*
   * نقرأ الوجهات اليدوية النشطة مرة واحدة.
   * كل دورة تستخدم نفس القائمة.
   */
  const {
    data: targets,
    error: targetsError
  } = await supabase
    .from("publish_run_targets")
    .select(`
      id,
      group_id,
      groups (
        telegram_chat_id,
        title,
        username
      )
    `)
    .eq(
      "run_id",
      runId
    );

  if (targetsError) {
    throw new Error(
      targetsError.message
    );
  }

  if (
    !targets?.length
  ) {
    throw new Error(
      "NO_TARGETS"
    );
  }

  await supabase
    .from("publish_runs")
    .update({
      status:
        "running",
      started_at:
        new Date().toISOString()
    })
    .eq(
      "id",
      runId
    );

  let totalSuccess =
    0;

  let totalFailed =
    0;

  let completedCycles =
    0;

  let stopped =
    false;

  /*
   * كل دورة تمر على جميع الوجهات.
   */
  for (
    let cycle = 1;
    cycle <= cycleLimit;
    cycle++
  ) {
    const {
      data: currentRun
    } = await supabase
      .from("publish_runs")
      .select("status")
      .eq(
        "id",
        runId
      )
      .single();

    if (
      currentRun?.status ===
      "cancelled"
    ) {
      stopped = true;
      break;
    }

    let cycleSuccess =
      0;

    let cycleFailed =
      0;

    for (
      let index = 0;
      index < targets.length;
      index++
    ) {
      const target =
        targets[index];

      const {
        data: currentState
      } = await supabase
        .from("publish_runs")
        .select("status")
        .eq(
          "id",
          runId
        )
        .single();

      if (
        currentState?.status ===
        "cancelled"
      ) {
        stopped = true;
        break;
      }

      const group =
        target.groups as any;

      if (
        !group ||
        !group.telegram_chat_id
      ) {
        cycleFailed++;
        totalFailed++;
        continue;
      }

      try {
        const inputPeer =
          await resolveTargetEntity(
            client,
            {
              telegram_chat_id:
                group.telegram_chat_id,
              username:
                group.username,
              title:
                group.title
            }
          );

        await client.sendMessage(
          inputPeer,
          {
            message:
              text
          }
        );

        cycleSuccess++;
        totalSuccess++;
      } catch (
        error
      ) {
        cycleFailed++;
        totalFailed++;

        console.error(
          "PUBLISH TARGET ERROR:",
          {
            runId,
            cycle,
            targetId:
              target.id,
            title:
              group.title,
            username:
              group.username,
            telegramChatId:
              group.telegram_chat_id,
            error:
              errorMessage(
                error
              )
          }
        );

        if (
          isFloodWait(
            error
          )
        ) {
          await supabase
            .from(
              "publish_runs"
            )
            .update({
              status:
                "cancelled"
            })
            .eq(
              "id",
              runId
            );

          stopped = true;
          break;
        }
      }

      /*
       * تأخير بين الوجهات.
       * لا ننتظر بعد آخر وجهة في الدورة.
       */
      if (
        index <
        targets.length - 1
      ) {
        await sleep(
          messageDelay
        );
      }
    }

    if (stopped) {
      break;
    }

    /*
     * الوصول إلى آخر وجهة يعني أن الدورة اكتملت.
     */
    completedCycles =
      cycle;

    /*
     * حفظ معلومات الدورة في metadata
     * إذا كان العمود موجودًا في المستقبل.
     * حالياً نكتفي بالـlogs.
     */
    console.log(
      `PUBLISH CYCLE ${cycle}/${cycleLimit}: ` +
      `${cycleSuccess} success, ` +
      `${cycleFailed} failed`
    );

    /*
     * لا ننتظر بعد آخر دورة.
     */
    if (
      cycle <
      cycleLimit
    ) {
      await sleep(
        cycleDelay
      );
    }
  }

  const {
    data: finalRun
  } = await supabase
    .from("publish_runs")
    .select("status")
    .eq(
      "id",
      runId
    )
    .single();

  let finalStatus:
    | "completed"
    | "cancelled"
    | "partial"
    | "failed";

  if (
    stopped ||
    finalRun?.status ===
      "cancelled"
  ) {
    finalStatus =
      "cancelled";
  } else if (
    totalSuccess === 0 &&
    totalFailed > 0
  ) {
    finalStatus =
      "failed";
  } else if (
    totalFailed > 0
  ) {
    finalStatus =
      "partial";
  } else {
    finalStatus =
      "completed";
  }

  await supabase
    .from("publish_runs")
    .update({
      status:
        finalStatus,
      success_count:
        totalSuccess,
      failed_count:
        totalFailed,
      finished_at:
        new Date().toISOString()
    })
    .eq(
      "id",
      runId
    );

  return {
    status:
      finalStatus,
    success:
      totalSuccess,
    failed:
      totalFailed,
    completedCycles,
    cycleLimit
  };
}

/*
 * توافق مع الكود القديم.
 * التشغيل القديم أصبح دورة واحدة فقط.
 */
export async function executeSinglePublish(
  userId: string,
  accountId: string,
  runId: string
) {
  const result =
    await executePublishCycles(
      userId,
      accountId,
      runId
    );

  return {
    success:
      result.success,
    failed:
      result.failed,
    status:
      result.status
  };
}
