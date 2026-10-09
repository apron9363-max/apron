import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  buildAdminSessionSetCookieHeader,
  buildAdminSessionToken,
  verifyAdminCredentials,
} from "@/lib/server/adminSession";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 400 },
      );
    }
    const { email, password } = parsed.data;
    const valid = verifyAdminCredentials(email, password);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const token = buildAdminSessionToken();
    const setCookieHeader = buildAdminSessionSetCookieHeader(token);

    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", setCookieHeader);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: "Admin sign-in failed", details: message },
      { status: 500 },
    );
  }
}
