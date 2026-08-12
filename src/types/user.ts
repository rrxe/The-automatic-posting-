export type UserPlan = "free" | "vip";

export interface AppUser {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  language: string;
  plan: UserPlan;
  vip_expires_at: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}
