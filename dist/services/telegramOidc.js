import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
const ISSUER = "https://oauth.telegram.org";
const AUTH_URL = `${ISSUER}/auth`;
const TOKEN_URL = `${ISSUER}/token`;
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
const pending = new Map();
function base64url(input) {
    return input
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}
function randomState() {
    return base64url(randomBytes(32));
}
function createCodeVerifier() {
    return base64url(randomBytes(48));
}
function createChallenge(verifier) {
    return base64url(createHash("sha256")
        .update(verifier)
        .digest());
}
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name}_NOT_CONFIGURED`);
    }
    return value;
}
export function createTelegramOidcUrl(telegramId) {
    const clientId = requiredEnv("TELEGRAM_LOGIN_CLIENT_ID");
    const webUrl = requiredEnv("WEB_URL");
    const redirectUri = `${webUrl.replace(/\/$/, "")}/auth/telegram/callback`;
    const state = randomState();
    const verifier = createCodeVerifier();
    const challenge = createChallenge(verifier);
    pending.set(state, {
        telegramId,
        codeVerifier: verifier,
        expiresAt: Date.now() +
            10 * 60 * 1000
    });
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile phone",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256"
    });
    return `${AUTH_URL}?${params.toString()}`;
}
export async function consumeTelegramOidcCallback(code, state) {
    const entry = pending.get(state);
    if (!entry) {
        throw new Error("OIDC_STATE_INVALID");
    }
    pending.delete(state);
    if (Date.now() >
        entry.expiresAt) {
        throw new Error("OIDC_STATE_EXPIRED");
    }
    const clientId = requiredEnv("TELEGRAM_LOGIN_CLIENT_ID");
    const clientSecret = requiredEnv("TELEGRAM_LOGIN_CLIENT_SECRET");
    const webUrl = requiredEnv("WEB_URL");
    const redirectUri = `${webUrl.replace(/\/$/, "")}/auth/telegram/callback`;
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: entry.codeVerifier
    });
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${auth}`
        },
        body
    });
    if (!response.ok) {
        throw new Error("OIDC_TOKEN_EXCHANGE_FAILED");
    }
    const token = await response.json();
    if (!token.id_token) {
        throw new Error("OIDC_ID_TOKEN_MISSING");
    }
    const verified = await jwtVerify(token.id_token, JWKS, {
        issuer: ISSUER,
        audience: clientId
    });
    const claims = verified.payload;
    const authenticatedTelegramId = Number(claims.sub);
    if (!Number.isSafeInteger(authenticatedTelegramId)) {
        throw new Error("OIDC_SUB_INVALID");
    }
    if (authenticatedTelegramId !==
        entry.telegramId) {
        throw new Error("OIDC_ACCOUNT_MISMATCH");
    }
    return {
        telegramId: authenticatedTelegramId,
        profile: {
            name: typeof claims.name === "string"
                ? claims.name
                : null,
            username: typeof claims.preferred_username === "string"
                ? claims.preferred_username
                : null,
            phone: typeof claims.phone_number === "string"
                ? claims.phone_number
                : null
        }
    };
}
