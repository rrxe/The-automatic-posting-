import { randomBytes } from "node:crypto";
const sessions = new Map();
const TTL = 15 * 60 * 1000;
export function createWebTelegramLoginToken(userId, telegramId) {
    const token = randomBytes(32).toString("base64url");
    sessions.set(token, {
        userId,
        telegramId,
        expiresAt: Date.now() + TTL
    });
    return token;
}
export function getWebTelegramLoginSession(token) {
    const session = sessions.get(token);
    if (!session) {
        return null;
    }
    if (Date.now() >
        session.expiresAt) {
        sessions.delete(token);
        return null;
    }
    return session;
}
export function deleteWebTelegramLoginToken(token) {
    sessions.delete(token);
}
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (now >
            session.expiresAt) {
            sessions.delete(token);
        }
    }
}, 60_000).unref();
