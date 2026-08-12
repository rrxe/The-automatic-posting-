import crypto from "node:crypto";
import { env } from "../config/env.js";
function getKey() {
    if (!env.SESSION_ENCRYPTION_KEY) {
        throw new Error("SESSION_ENCRYPTION_KEY is not configured");
    }
    const key = Buffer.from(env.SESSION_ENCRYPTION_KEY, "hex");
    if (key.length !== 32) {
        throw new Error("SESSION_ENCRYPTION_KEY must be 32 bytes");
    }
    return key;
}
export function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return [
        iv.toString("base64url"),
        tag.toString("base64url"),
        encrypted.toString("base64url")
    ].join(".");
}
export function decrypt(payload) {
    const parts = payload.split(".");
    if (parts.length !== 3) {
        throw new Error("Invalid encrypted payload");
    }
    const [ivPart, tagPart, dataPart] = parts;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataPart, "base64url")),
        decipher.final()
    ]);
    return decrypted.toString("utf8");
}
