import { supabase } from "../db/supabase.js";

export async function createDraft(
  userId: string,
  accountId: string
) {
  const { data, error } = await supabase
    .from("post_drafts")
    .insert({
      user_id: userId,
      telegram_account_id: accountId,
      content: "",
      signature_enabled: true,
      selected_group_ids: [],
      status: "draft"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getLatestDraft(
  userId: string
) {
  const { data, error } = await supabase
    .from("post_drafts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("updated_at", {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getDraft(
  userId: string,
  draftId: string
) {
  const { data, error } = await supabase
    .from("post_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("DRAFT_NOT_FOUND");
  }

  return data;
}

export async function updateDraftContent(
  userId: string,
  draftId: string,
  content: string
) {
  const { data, error } = await supabase
    .from("post_drafts")
    .update({
      content,
      updated_at: new Date().toISOString()
    })
    .eq("id", draftId)
    .eq("user_id", userId)
    .eq("status", "draft")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "DRAFT_UPDATE_FAILED"
    );
  }

  return data;
}

export async function toggleDraftSignature(
  userId: string,
  draftId: string
) {
  const draft = await getDraft(
    userId,
    draftId
  );

  const { data, error } = await supabase
    .from("post_drafts")
    .update({
      signature_enabled:
        !draft.signature_enabled,
      updated_at: new Date().toISOString()
    })
    .eq("id", draftId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "DRAFT_UPDATE_FAILED"
    );
  }

  return data;
}

export async function toggleDraftGroup(
  userId: string,
  draftId: string,
  groupId: string
) {
  const draft = await getDraft(
    userId,
    draftId
  );

  const selected = Array.isArray(
    draft.selected_group_ids
  )
    ? [...draft.selected_group_ids]
    : [];

  const index =
    selected.indexOf(groupId);

  if (index >= 0) {
    selected.splice(index, 1);
  } else {
    const settings =
      await import("./settings.js")
        .then((m) =>
          m.getAppSettings()
        );

    const {
      data: user
    } = await supabase
      .from("users")
      .select(
        "plan, vip_expires_at"
      )
      .eq("id", userId)
      .single();

    const vip =
      user?.plan === "vip" &&
      !!user.vip_expires_at &&
      new Date(
        user.vip_expires_at
      ) > new Date();

    const limit =
      vip
        ? settings.vip_group_limit
        : settings.free_group_limit;

    if (
      selected.length >=
      limit
    ) {
      throw new Error(
        "GROUP_LIMIT_REACHED"
      );
    }

    selected.push(groupId);
  }

  const { data, error } = await supabase
    .from("post_drafts")
    .update({
      selected_group_ids: selected,
      updated_at: new Date().toISOString()
    })
    .eq("id", draftId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "DRAFT_UPDATE_FAILED"
    );
  }

  return data;
}

export async function deleteDraft(
  userId: string,
  draftId: string
) {
  await supabase
    .from("post_drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", userId);
}

export async function markDraftUsed(
  userId: string,
  draftId: string
) {
  await supabase
    .from("post_drafts")
    .update({
      status: "used",
      updated_at: new Date().toISOString()
    })
    .eq("id", draftId)
    .eq("user_id", userId);
}
