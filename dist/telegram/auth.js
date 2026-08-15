import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions/index.js";
import { SocksProxyAgent } from "socks-proxy-agent";
import { env } from "../config/env.js";
import { supabase } from "../db/supabase.js";
import { encrypt } from "../utils/crypto.js";
import { clearUserAction, setUserAction } from "../services/userActions.js";
const pendingLogins = new Map();
function createTelegramClient(session = "") {
    const options = {
        connectionRetries: 5,
        deviceModel: env.TELEGRAM_DEVICE_MODEL || "iPhone 14 Pro",
        systemVersion: env.TELEGRAM_SYSTEM_VERSION || "iOS 16.5",
        appVersion: env.TELEGRAM_APP_VERSION || "10.10.0",
        langCode: env.TELEGRAM_LANG_CODE || "en",
        systemLangCode: env.TELEGRAM_SYSTEM_LANG_CODE || "en-US"
    };
    const proxyHost = env.TELEGRAM_PROXY_HOST?.trim();
    const proxyPort = env.TELEGRAM_PROXY_PORT?.trim();
    if (proxyHost && proxyPort) {
        const username = env.TELEGRAM_PROXY_USERNAME?.trim() || "";
        const password = env.TELEGRAM_PROXY_PASSWORD?.trim() || "";
        const auth = username || password ? `${username}:${password}@` : "";
        const proxyUrl = `socks5://${auth}${proxyHost}:${proxyPort}`;
        try {
            options.proxy = new SocksProxyAgent(proxyUrl);
            console.log("Telegram auth using proxy");
        }
        catch (err) {
            console.warn("Invalid proxy config, skipping:", err);
        }
    }
    return new TelegramClient(new StringSession(session), env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, options);
}
function assertTelegramConfig() {
    if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH) {
        throw new Error("TELEGRAM_API_NOT_CONFIGURED");
    }
    if (!env.SESSION_ENCRYPTION_KEY) {
        throw new Error("SESSION_ENCRYPTION_KEY_NOT_CONFIGURED");
    }
}
function normalizePhone(input) {
    let phone = input.trim().replace(/[\s()-]/g, "");
    if (phone.startsWith("00"))
        phone = "+" + phone.slice(2);
    if (!phone.startsWith("+"))
        phone = "+" + phone;
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        throw new Error("INVALID_PHONE");
    }
    return phone;
}
function normalizeCode(input) {
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    return input
        .trim()
        .replace(/[٠-٩]/g, (char) => String(arabic.indexOf(char)))
        .replace(/[۰-۹]/g, (char) => String(persian.indexOf(char)))
        .replace(/[\s.-]/g, "");
}
async function saveTelegramAccount(pending) {
    const me = await pending.client.getMe();
    if (!me || !("id" in me)) {
        throw new Error("LOGIN_FAILED");
    }
    const session = pending.client.session.save();
    if (!session)
        throw new Error("SESSION_SAVE_FAILED");
    const encrypted = encrypt(session);
    const telegramUserId = Number(me.id);
    const username = "username" in me && me.username ? String(me.username) : null;
    const displayName = ["firstName" in me ? me.firstName : null, "lastName" in me ? me.lastName : null]
        .filter(Boolean)
        .join(" ") || null;
    const phoneHint = pending.phone.length >= 4 ? `••••${pending.phone.slice(-4)}` : "••••";
    const payload = {
        user_id: pending.stormUserId,
        telegram_user_id: telegramUserId,
        phone_hint: phoneHint,
        session_encrypted: encrypted,
        is_active: true,
        display_name: displayName,
        username,
        last_connected_at: new Date().toISOString()
    };
    /*
     * telegram_user_id فريد عالمياً في قاعدة البيانات (uq_telegram_accounts_telegram_user
     * من migration_v3.sql) — حساب Telegram واحد لا يمكن ربطه إلا بمستخدم Storm واحد.
     * وبما أن الحذف من «⚙️ حسابي» وإلغاء التفعيل التلقائي (جلسة منتهية / حساب محظور)
     * لا يمسحان الصف فعلياً بل يعطّلانه فقط (is_active=false)، فإن أي إعادة تسجيل لاحقة
     * لنفس الحساب كانت تصطدم بهذا القيد وتفشل بدل أن تُحدّث الصف الموجود أصلاً.
     */
    const { data: existing, error: lookupError } = await supabase
        .from("telegram_accounts")
        .select("id, user_id")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();
    if (lookupError) {
        throw new Error(lookupError.message);
    }
    if (existing) {
        if (existing.user_id !== pending.stormUserId) {
            /*
             * الحساب مرتبط حالياً بمستخدم Storm آخر. الدخول عبر رمز/كلمة مرور
             * تسجيل الدخول الحقيقيين لـ Telegram هو إثبات الملكية الحالية للحساب،
             * فننقل الربط تلقائياً للمستخدم الجديد (payload.user_id بالأسفل) —
             * يختفي الحساب من قائمة المستخدم القديم فوراً لأنها مفلترة بـ user_id.
             */
            console.log("TELEGRAM ACCOUNT TRANSFERRED:", {
                telegramUserId,
                fromStormUserId: existing.user_id,
                toStormUserId: pending.stormUserId
            });
        }
        /*
         * نفس الصف يُحدَّث في الحالتين: إعادة ربط لنفس المالك (تجديد جلسة)،
         * أو نقل ملكية لمالك جديد — payload.user_id هو صاحب المحاولة الحالية.
         */
        const { data, error } = await supabase
            .from("telegram_accounts")
            .update(payload)
            .eq("id", existing.id)
            .select("*")
            .single();
        if (error)
            throw new Error(error.message);
        return data;
    }
    const { data, error } = await supabase
        .from("telegram_accounts")
        .insert(payload)
        .select("*")
        .single();
    if (error) {
        if (error.code === "23505")
            throw new Error("ACCOUNT_ALREADY_LINKED");
        throw new Error(error.message);
    }
    return data;
}
function finishWait(telegramId, result) {
    const pending = pendingLogins.get(telegramId);
    if (!pending)
        return;
    const resolver = pending.waitResolver;
    pending.waitResolver = null;
    resolver?.(result);
}
/*
 * شبكة أمان: لا يجب لأي طلب ينتظر نتيجة رمز/كلمة مرور أن يتعلق إلى الأبد.
 * حتى مع إصلاح onError بالأسفل، هذا يضمن أن submitLoginCode/submitLoginPassword
 * سترجع رداً خلال 90 ثانية كحد أقصى مهما حدث (خطأ غير متوقع من المكتبة، تعليق شبكة، ...).
 */
const LOGIN_STEP_TIMEOUT_MS = 90_000;
function waitForLoginStep(telegramId, pending) {
    return new Promise((resolve) => {
        let settled = false;
        const settle = (result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
        };
        pending.waitResolver = settle;
        const timer = setTimeout(() => {
            if (settled)
                return;
            console.error("TELEGRAM LOGIN STEP TIMEOUT:", { telegramId });
            cancelLogin(telegramId);
            settle({
                status: "failed",
                error: new Error("TELEGRAM_LOGIN_STEP_TIMEOUT")
            });
        }, LOGIN_STEP_TIMEOUT_MS);
    });
}
export async function beginLogin(stormUserId, telegramId, phone) {
    assertTelegramConfig();
    cancelLogin(telegramId);
    const cleanPhone = normalizePhone(phone);
    const client = createTelegramClient();
    await client.connect();
    const pending = {
        client,
        stormUserId,
        phone: cleanPhone,
        status: "waiting_code",
        codeResolver: null,
        passwordResolver: null,
        waitResolver: null,
        error: null,
        isCodeViaApp: null,
        startedAt: Date.now()
    };
    pendingLogins.set(telegramId, pending);
    console.log("TELEGRAM LOGIN START:", { telegramId, phonePrefix: cleanPhone.slice(0, 5) });
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500));
    client
        .start({
        phoneNumber: async () => cleanPhone,
        forceSMS: false,
        phoneCode: async (isCodeViaApp) => {
            pending.status = "waiting_code";
            pending.isCodeViaApp = Boolean(isCodeViaApp);
            console.log("TELEGRAM LOGIN CODE REQUESTED:", { telegramId, isCodeViaApp });
            return new Promise((resolve) => {
                pending.codeResolver = resolve;
            });
        },
        password: async () => {
            pending.status = "waiting_password";
            await setUserAction(telegramId, "telegram_password");
            console.log("TELEGRAM 2FA PASSWORD REQUESTED:", telegramId);
            finishWait(telegramId, { status: "password" });
            return new Promise((resolve) => {
                pending.passwordResolver = resolve;
            });
        },
        emailAddress: async () => {
            throw new Error("TELEGRAM_EMAIL_VERIFICATION_REQUIRED");
        },
        emailVerification: async () => {
            throw new Error("TELEGRAM_EMAIL_VERIFICATION_REQUIRED");
        },
        onError: async (error) => {
            pending.error = error;
            console.error("TELEGRAM LOGIN FLOW ERROR:", { telegramId, message: error.message });
            finishWait(telegramId, { status: "failed", error });
            const rawCode = error?.errorMessage;
            const recoverable = rawCode === "PHONE_CODE_INVALID" ||
                rawCode === "PASSWORD_HASH_INVALID" ||
                error.message.includes("PHONE_CODE_INVALID") ||
                error.message.includes("PASSWORD_HASH_INVALID");
            return !recoverable;
        }
    })
        .then(async () => {
        try {
            const account = await saveTelegramAccount(pending);
            pending.status = "completed";
            await clearUserAction(telegramId);
            finishWait(telegramId, { status: "completed", account });
            console.log("TELEGRAM LOGIN COMPLETED:", telegramId);
        }
        catch (error) {
            const finalError = error instanceof Error ? error : new Error(String(error));
            pending.status = "failed";
            pending.error = finalError;
            await clearUserAction(telegramId);
            finishWait(telegramId, { status: "failed", error: finalError });
            console.error("TELEGRAM SAVE ACCOUNT ERROR:", { telegramId, message: finalError.message });
        }
        finally {
            await client.disconnect().catch(() => { });
            pendingLogins.delete(telegramId);
        }
    })
        .catch(async (error) => {
        const finalError = error instanceof Error ? error : new Error(String(error));
        pending.status = "failed";
        pending.error = finalError;
        await clearUserAction(telegramId);
        finishWait(telegramId, { status: "failed", error: finalError });
        console.error("TELEGRAM LOGIN FAILED:", { telegramId, message: finalError.message });
        await client.disconnect().catch(() => { });
        pendingLogins.delete(telegramId);
    });
    const startWait = Date.now();
    while (pending.codeResolver === null && pending.status === "waiting_code") {
        if (Date.now() - startWait > 90000) {
            cancelLogin(telegramId);
            throw new Error("TELEGRAM_CODE_REQUEST_TIMEOUT");
        }
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    if (pending.status === "failed") {
        throw pending.error ?? new Error("TELEGRAM_LOGIN_FAILED");
    }
    return { deliveredToApp: Boolean(pending.isCodeViaApp) };
}
export async function submitLoginCode(telegramId, code) {
    const pending = pendingLogins.get(telegramId);
    if (!pending)
        throw new Error("NO_PENDING_LOGIN");
    const normalized = normalizeCode(code);
    if (!/^\d{3,8}$/.test(normalized)) {
        throw new Error("PHONE_CODE_INVALID");
    }
    const resolver = pending.codeResolver;
    if (!resolver)
        throw new Error("CODE_NOT_REQUESTED");
    pending.codeResolver = null;
    resolver(normalized);
    return waitForLoginStep(telegramId, pending);
}
export async function submitLoginPassword(telegramId, password) {
    const pending = pendingLogins.get(telegramId);
    if (!pending)
        throw new Error("NO_PENDING_LOGIN");
    if (!password.trim())
        throw new Error("INVALID_PASSWORD");
    const resolver = pending.passwordResolver;
    if (!resolver)
        throw new Error("PASSWORD_NOT_REQUESTED");
    pending.passwordResolver = null;
    resolver(password.trim());
    return waitForLoginStep(telegramId, pending);
}
export function cancelLogin(telegramId) {
    const pending = pendingLogins.get(telegramId);
    if (!pending)
        return;
    try {
        pending.codeResolver = null;
        pending.passwordResolver = null;
        pending.waitResolver = null;
    }
    catch { }
    pending.client.disconnect().catch(() => { });
    pendingLogins.delete(telegramId);
    clearUserAction(telegramId).catch(() => { });
}
export function hasPendingLogin(telegramId) {
    return pendingLogins.has(telegramId);
}
