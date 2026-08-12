import { supabase } from "../db/supabase.js";

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
