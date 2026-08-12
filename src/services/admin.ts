import { supabase } from "../db/supabase.js";

export type AdminRole = "owner" | "admin";

export async function getAdminRole(
  telegramId: number
): Promise<AdminRole | null> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (userError || !user) {
    return null;
  }

  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !admin) {
    return null;
  }

  return admin.role as AdminRole;
}

export async function isAdmin(
  telegramId: number
): Promise<boolean> {
  return (await getAdminRole(telegramId)) !== null;
}

export async function isOwner(
  telegramId: number
): Promise<boolean> {
  return (await getAdminRole(telegramId)) === "owner";
}
