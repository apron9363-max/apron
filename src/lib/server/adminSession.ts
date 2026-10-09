import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import {
  ADMIN_SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/constants";
import type { VerifiedSession } from "@/lib/server/session";

const ADMIN_EMAIL = "apron9363@gmail.com";
const ADMIN_PASSWORD = "Apron@2026";
const ADMIN_UID = "admin_apron9363_system";
const ADMIN_NAME = "Apron Admin";

const TOKEN_DELIM = ".";

const CACHE_KEY = "__APRON_ADMIN_HMAC_SECRET_CACHE__" as const;

export interface AdminCredentials {
  email: string;
  password: string;
}

function resolveHmacSecret(): string {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  if (typeof g[CACHE_KEY] === "string" && (g[CACHE_KEY] as string).length > 0) {
    return g[CACHE_KEY] as string;
  }
  const candidates = [
    process.env.HMAC_SECRET,
    process.env.COOKIE_SECRET,
    process.env.FIREBASE_SECRET_COOKIE_SECRET,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.length > 0);
  if (!found) {
    if (process.env.NODE_ENV !== "production") {
      const secret =
        "dev-ephemeral-admin-hmac-key-do-not-use-in-production-" + Date.now();
      g[CACHE_KEY] = secret;
      return secret;
    }
    throw new Error("[adminSession] HMAC_SECRET env var is required.");
  }
  g[CACHE_KEY] = found;
  return found;
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}
function base64urlDecode(s: string): Buffer | null {
  try {
    return Buffer.from(s, "base64url");
  } catch {
    return null;
  }
}

export function verifyAdminCredentials(
  email: string,
  password: string,
): boolean {
  if (typeof email !== "string" || typeof password !== "string") return false;
  const emailBuf = Buffer.from(email.trim().toLowerCase(), "utf8");
  const expectedEmailBuf = Buffer.from(ADMIN_EMAIL, "utf8");
  const passBuf = Buffer.from(password, "utf8");
  const expectedPassBuf = Buffer.from(ADMIN_PASSWORD, "utf8");
  const emailOk =
    emailBuf.length === expectedEmailBuf.length &&
    timingSafeEqual(emailBuf, expectedEmailBuf);
  const passOk =
    passBuf.length === expectedPassBuf.length &&
    timingSafeEqual(passBuf, expectedPassBuf);
  return emailOk && passOk;
}

interface AdminTokenPayload {
  sub: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

function signAdminToken(payload: AdminTokenPayload): string {
  const secret = resolveHmacSecret();
  const payloadBuf = Buffer.from(JSON.stringify(payload), "utf8");
  const payloadB64 = base64urlEncode(payloadBuf);
  const mac = createHmac("sha256", secret).update(payloadB64).digest();
  const macB64 = base64urlEncode(mac);
  return `${payloadB64}${TOKEN_DELIM}${macB64}`;
}

function verifyAdminToken(
  token: string,
  nowMs: number = Date.now(),
): AdminTokenPayload | null {
  if (typeof token !== "string" || token.length < 16) return null;
  const parts = token.split(TOKEN_DELIM);
  if (parts.length !== 2) return null;
  const [payloadB64, macB64] = parts;

  const secret = resolveHmacSecret();
  const expectedMac = createHmac("sha256", secret).update(payloadB64).digest();
  const gotMacBuf = base64urlDecode(macB64);
  if (!gotMacBuf || gotMacBuf.length !== expectedMac.length) return null;
  if (!timingSafeEqual(gotMacBuf, expectedMac)) return null;

  const payloadBuf = base64urlDecode(payloadB64);
  if (!payloadBuf) return null;
  try {
    const raw = JSON.parse(payloadBuf.toString("utf8")) as AdminTokenPayload;
    if (!raw || typeof raw !== "object") return null;
    if (raw.exp && nowMs > raw.exp) return null;
    if (raw.iat && nowMs < raw.iat - 60_000) return null;
    return raw;
  } catch {
    return null;
  }
}

export function buildAdminSessionToken(): string {
  const now = Date.now();
  const durationMs = SESSION_DURATION_SECONDS * 1000;
  const payload: AdminTokenPayload = {
    sub: ADMIN_UID,
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    iat: now,
    exp: now + durationMs,
  };
  return signAdminToken(payload);
}

export function buildAdminSessionSetCookieHeader(token: string): string {
  const attrs = [
    `${ADMIN_SESSION_COOKIE_NAME}=${token}`,
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    "Path=/",
  ].filter(Boolean);
  return attrs.join("; ");
}

export function buildAdminSessionClearCookieHeader(): string {
  const attrs = [
    `${ADMIN_SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    "Path=/",
  ].filter(Boolean);
  return attrs.join("; ");
}

export function setAdminSessionCookie(): string {
  const token = buildAdminSessionToken();
  const cookieStore = cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    maxAge: SESSION_DURATION_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return token;
}

export function clearAdminSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
}

export function verifyAdminSessionCookie(
  rawCookie?: string,
): VerifiedSession | null {
  const cookie =
    rawCookie ?? cookies().get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  const payload = verifyAdminToken(cookie);
  if (!payload) return null;
  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
    role: "admin",
    status: "active",
    emailVerified: true,
  };
}
