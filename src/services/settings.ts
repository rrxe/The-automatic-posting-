import { supabase } from "../db/supabase.js";

export interface AppSettings {
  free_group_limit: number;
  vip_group_limit: number;

  free_account_limit: number;
  vip_account_limit: number;

  free_message_limit: number;
  vip_message_limit: number;

  free_daily_runs: number;
  vip_daily_runs: number;

  free_cycle_limit: number;
  vip_cycle_limit: number;

  free_cycle_delay_minutes: number;
  vip_cycle_delay_minutes: number;

  message_delay_minutes: number;

  referral_7_vip_days: number;
  referral_20_vip_days: number;

  vip_price_usdt: number;

  signature: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  free_group_limit: 5,
  vip_group_limit: 20,

  free_account_limit: 2,
  vip_account_limit: 5,

  free_message_limit: 100,
  vip_message_limit: 500,

  free_daily_runs: 4,
  vip_daily_runs: 4,

  free_cycle_limit: 10,
  vip_cycle_limit: 50,

  free_cycle_delay_minutes: 5,
  vip_cycle_delay_minutes: 2,

  message_delay_minutes: 2,

  referral_7_vip_days: 3,
  referral_20_vip_days: 7,

  vip_price_usdt: 5,

  signature:
    "نشر تلقائي: @postrush_bot"
};

export async function getAppSettings(): Promise<AppSettings> {
  const {
    data,
    error
  } = await supabase
    .from("mandatory_settings")
    .select(`
      free_group_limit,
      vip_group_limit,
      free_account_limit,
      vip_account_limit,
      free_message_limit,
      vip_message_limit,
      free_daily_runs,
      vip_daily_runs,
      free_cycle_limit,
      vip_cycle_limit,
      free_cycle_delay_minutes,
      vip_cycle_delay_minutes,
      message_delay_minutes,
      referral_7_vip_days,
      referral_20_vip_days,
      vip_price_usdt,
      signature
    `)
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return {
    free_group_limit:
      Number(data.free_group_limit),

    vip_group_limit:
      Number(data.vip_group_limit),

    free_account_limit:
      Number(data.free_account_limit),

    vip_account_limit:
      Number(data.vip_account_limit),

    free_message_limit:
      Number(data.free_message_limit),

    vip_message_limit:
      Number(data.vip_message_limit),

    free_daily_runs:
      Number(data.free_daily_runs),

    vip_daily_runs:
      Number(data.vip_daily_runs),

    free_cycle_limit:
      Number(data.free_cycle_limit),

    vip_cycle_limit:
      Number(data.vip_cycle_limit),

    free_cycle_delay_minutes:
      Number(
        data.free_cycle_delay_minutes
      ),

    vip_cycle_delay_minutes:
      Number(
        data.vip_cycle_delay_minutes
      ),

    message_delay_minutes:
      Number(
        data.message_delay_minutes
      ),

    referral_7_vip_days:
      Number(
        data.referral_7_vip_days
      ),

    referral_20_vip_days:
      Number(
        data.referral_20_vip_days
      ),

    vip_price_usdt:
      Number(data.vip_price_usdt),

    signature:
      typeof data.signature === "string"
        ? data.signature
        : DEFAULT_SETTINGS.signature
  };
}

export async function updateAppSetting(
  key:
    | "free_group_limit"
    | "vip_group_limit"
    | "free_account_limit"
    | "vip_account_limit"
    | "free_message_limit"
    | "vip_message_limit"
    | "free_daily_runs"
    | "vip_daily_runs"
    | "free_cycle_limit"
    | "vip_cycle_limit"
    | "free_cycle_delay_minutes"
    | "vip_cycle_delay_minutes"
    | "message_delay_minutes"
    | "referral_7_vip_days"
    | "referral_20_vip_days"
    | "vip_price_usdt"
    | "signature",
  value: number | string
) {
  const {
    error
  } = await supabase
    .from("mandatory_settings")
    .update({
      [key]: value
    })
    .eq("id", 1);

  if (error) {
    throw new Error(
      error.message
    );
  }
}
