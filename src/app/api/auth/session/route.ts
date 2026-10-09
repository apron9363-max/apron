import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSessionCookie } from "@/lib/server/session";

const bodySchema = z.object({
  idToken: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    await createSessionCookie(parsed.data.idToken);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create session", details: message },
      { status: 401 },
    );
  }
}
