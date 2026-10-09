import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createTxLog,
  listUsers,
} from "@/lib/firestore";
import { applyScheduledHourlyAccrualForUser } from "@/server/actions/userActions";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pageSize: z.number().int().positive().max(500).optional().default(100),
  cursor: z.string().min(1).optional(),
  dryRun: z.boolean().optional().default(false),
});

function resolveWorkerToken(expectedEnv?: string): string[] {
  const raw = expectedEnv ?? process.env.WORKER_TOKEN;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function verifyBearer(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const incoming = header.slice("Bearer ".length).trim();
  if (incoming.length < 8) return false;
  const tokens = resolveWorkerToken();
  if (tokens.length === 0) return false;
  return tokens.some((t) => t.length === incoming.length && t === incoming);
}

export async function POST(req: NextRequest) {
  if (!verifyBearer(req)) {
    return NextResponse.json(
      { error: "Unauthorized", ok: false },
      { status: 401 },
    );
  }
  let parsed;
  try {
    const raw = await req.json().catch(() => ({}));
    parsed = bodySchema.safeParse(raw ?? {});
  } catch {
    parsed = bodySchema.safeParse({});
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.flatten(), ok: false },
      { status: 400 },
    );
  }
  const { pageSize, cursor, dryRun } = parsed.data;
  const startedAt = Date.now();

  let nextCursor: string | null = null;
  const userIds: string[] = [];
  try {
    const users = await listUsers({ limit: pageSize, cursor });
    users.forEach((u) => userIds.push(u.uid));
    nextCursor = users.length >= pageSize ? users[users.length - 1].uid : null;
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to list users", details: err instanceof Error ? err.message : String(err), ok: false },
      { status: 500 },
    );
  }

  const summary = {
    total: userIds.length,
    applied: 0,
    alreadyPaid: 0,
    skipped: 0,
    errors: 0,
    amountAccrued: 0,
    hoursAccrued: 0,
    byReason: {} as Record<string, number>,
  };

  for (const uid of userIds) {
    if (dryRun) {
      summary.skipped += 1;
      (summary.byReason as any)["dry_run"] = ((summary.byReason as any)["dry_run"] ?? 0) + 1;
      continue;
    }
    try {
      const r = await applyScheduledHourlyAccrualForUser(uid, startedAt);
      if (!r.ok) {
        summary.errors += 1;
        summary.byReason[r.reason] = (summary.byReason[r.reason] ?? 0) + 1;
        continue;
      }
      if (r.alreadyPaid) summary.alreadyPaid += 1;
      if (r.applied) summary.applied += 1;
      if (!r.applied && !r.alreadyPaid) summary.skipped += 1;
      summary.amountAccrued += r.amount;
      summary.hoursAccrued += r.hours;
      summary.byReason[r.reason] = (summary.byReason[r.reason] ?? 0) + 1;
    } catch (err) {
      summary.errors += 1;
      summary.byReason["exception"] = (summary.byReason["exception"] ?? 0) + 1;
    }
  }

  const finishedAt = Date.now();
  const payload = {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    pageSize,
    cursor: cursor ?? null,
    nextCursor,
    dryRun,
    summary,
    userCount: userIds.length,
  };

  try {
    if (!dryRun) {
      await createTxLog({
        event: "worker_run",
        payload,
        at: finishedAt,
      });
    }
  } catch {
    // non-fatal; best effort log
  }

  return NextResponse.json({ ok: true, ...payload });
}
