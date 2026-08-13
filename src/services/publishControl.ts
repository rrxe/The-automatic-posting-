import { supabase } from "../db/supabase.js";

export async function getActiveRunForUser(
  userId: string
) {
  const { data, error } =
    await supabase
      .from("publish_runs")
      .select("id, telegram_account_id, status, created_at")
      .eq("user_id", userId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function hasActiveRun(
  userId: string,
  accountId?: string
) {
  let query = supabase
    .from("publish_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pending", "running"]);

  if (accountId) {
    query = query.eq("telegram_account_id", accountId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function stopPublishRun(
  userId: string,
  runId: string
) {
  const { data, error } =
    await supabase
      .from("publish_runs")
      .update({
        status: "cancelled",
        finished_at:
          new Date().toISOString()
      })
      .eq("id", runId)
      .eq("user_id", userId)
      .in(
        "status",
        ["pending", "running"]
      )
      .select("id")
      .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  return Boolean(data);
}

export async function reconcileStuckPublishRuns() {
  const { data, error } =
    await supabase
      .from("publish_runs")
      .update({
        status: "failed",
        finished_at:
          new Date().toISOString()
      })
      .in(
        "status",
        ["pending", "running"]
      )
      .select("id");

  if (error) {
    console.error(
      "RECONCILE STUCK RUNS ERROR:",
      error.message
    );

    return 0;
  }

  return data?.length ?? 0;
}
