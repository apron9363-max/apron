import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { taskSessionTokenPayloadSchema } from "@/lib/validations/schemas";
import type { TaskSessionTokenPayload } from "@/lib/validations/schemas";

const IAT_TOLERANCE_MS = 15 * 60 * 1000;
const TOKEN_DELIM = ".";

const CACHE_KEY = "__APRON_TASK_HMAC_SECRET_CACHE__" as const;
const WARN_KEY = "__APRON_TASK_HMAC_WARN_EMITTED__" as const;

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
      if (!g[WARN_KEY]) {
        console.warn(
          "[hmac] WARNING: No HMAC_SECRET set. Falling back to ephemeral dev key. Set HMAC_SECRET in production.",
        );
        g[WARN_KEY] = true;
      }
      const secret =
        "dev-ephemeral-hmac-key-do-not-use-in-production-" + Date.now();
      g[CACHE_KEY] = secret;
      return secret;
    }
    throw new Error("[hmac] HMAC_SECRET env var is required.");
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

export function signTaskSessionToken(payload: TaskSessionTokenPayload): string {
  const parsed = taskSessionTokenPayloadSchema.parse(payload);
  const secret = resolveHmacSecret();
  const payloadBuf = Buffer.from(JSON.stringify(parsed), "utf8");
  const payloadB64 = base64urlEncode(payloadBuf);
  const mac = createHmac("sha256", secret).update(payloadB64).digest();
  const macB64 = base64urlEncode(mac);
  return `${payloadB64}${TOKEN_DELIM}${macB64}`;
}

export type VerifyTaskSessionResult =
  | { ok: true; payload: TaskSessionTokenPayload }
  | { ok: false; error: "invalid_format" | "bad_signature" | "expired" | "invalid_payload" };

export function verifyTaskSessionToken(
  token: string,
  nowMs: number = Date.now(),
): VerifyTaskSessionResult {
  if (typeof token !== "string" || token.length < 16) {
    return { ok: false, error: "invalid_format" };
  }
  const parts = token.split(TOKEN_DELIM);
  if (parts.length !== 2) return { ok: false, error: "invalid_format" };
  const [payloadB64, macB64] = parts;

  const secret = resolveHmacSecret();
  const expectedMac = createHmac("sha256", secret).update(payloadB64).digest();
  const gotMacBuf = base64urlDecode(macB64);
  if (!gotMacBuf || gotMacBuf.length !== expectedMac.length) {
    return { ok: false, error: "bad_signature" };
  }
  if (!timingSafeEqual(gotMacBuf, expectedMac)) {
    return { ok: false, error: "bad_signature" };
  }

  const payloadBuf = base64urlDecode(payloadB64);
  if (!payloadBuf) return { ok: false, error: "invalid_format" };
  let raw: unknown;
  try {
    raw = JSON.parse(payloadBuf.toString("utf8"));
  } catch {
    return { ok: false, error: "invalid_payload" };
  }
  const parsed = taskSessionTokenPayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_payload" };

  const ageMs = nowMs - parsed.data.iat;
  if (ageMs < 0 || ageMs > IAT_TOLERANCE_MS) {
    return { ok: false, error: "expired" };
  }
  return { ok: true, payload: parsed.data };
}

export function generateNonce(length = 16): string {
  return randomBytes(length).toString("hex");
}

export { IAT_TOLERANCE_MS };
