import { cookies } from "next/headers";
import { getAdminAuth } from "@/firebase/admin";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/constants";
import { getUser } from "@/lib/firestore";
import type { Role, UserStatus } from "@/types";
import { verifyAdminSessionCookie } from "@/lib/server/adminSession";

export interface VerifiedSession {
  uid: string;
  email: string;
  name?: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
}

export function buildSessionSetCookieHeader(cookie: string): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${cookie}`,
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    "Path=/",
  ].filter(Boolean);
  return attrs.join("; ");
}

export function buildSessionClearCookieHeader(): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
    "Path=/",
  ].filter(Boolean);
  return attrs.join("; ");
}

export async function createSessionCookie(idToken: string): Promise<string> {
  const auth = getAdminAuth();
  const expiresIn = SESSION_DURATION_SECONDS * 1000;
  const cookie = await auth.createSessionCookie(idToken, {
    expiresIn,
  });
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, cookie, {
    maxAge: SESSION_DURATION_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return cookie;
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function verifySessionCookie(
  rawCookie?: string,
): Promise<VerifiedSession | null> {
  const cookie = rawCookie ?? cookies().get(SESSION_COOKIE_NAME)?.value;
  if (cookie) {
    try {
      const auth = getAdminAuth();
      const decoded = await auth.verifySessionCookie(cookie, true);
      const doc = await getUser(decoded.uid);
      if (!doc) {
        return {
          uid: decoded.uid,
          email: (decoded.email as string) ?? "",
          role: "user",
          status: "active",
          emailVerified: !!decoded.email_verified,
        };
      }
      return {
        uid: doc.uid,
        email: doc.email,
        role: doc.role,
        status: doc.status,
        emailVerified: doc.emailVerified || !!decoded.email_verified,
      };
    } catch {
      // fall through to admin session check
    }
  }
  const adminSession = verifyAdminSessionCookie();
  if (adminSession) return adminSession;
  return null;
}
