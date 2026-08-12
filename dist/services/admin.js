import { supabase } from "../db/supabase.js";
export async function getAdminRole(telegramId) {
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
    return admin.role;
}
export async function isAdmin(telegramId) {
    return (await getAdminRole(telegramId)) !== null;
}
export async function isOwner(telegramId) {
    return (await getAdminRole(telegramId)) === "owner";
}
