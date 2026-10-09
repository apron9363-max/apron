import "server-only";
import { NextResponse } from "next/server";
import { buildSessionClearCookieHeader } from "@/lib/server/session";
import { buildAdminSessionClearCookieHeader } from "@/lib/server/adminSession";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", buildSessionClearCookieHeader());
  response.headers.append("Set-Cookie", buildAdminSessionClearCookieHeader());
  return response;
}
