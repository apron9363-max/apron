import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getAdminApp, getAdminDb } from "../src/lib/firebase/admin";
import type { PlanDoc } from "../src/types";

const NOW_MS = Date.now();

const PLANS: PlanDoc[] = [
  {
    id: "basic",
    name: "Basic",
    price: 0,
    hourlyRate: 0.1,
    features: [
      "0.10 APN / hour base earning rate",
      "Complete tasks, surveys & micro-quizzes",
      "Single-level referral program (50 APN per verified invitee)",
      "Standard withdrawal queue (3-5 business days)",
      "Email support",
    ],
    active: true,
    createdAt: NOW_MS,
    updatedAt: NOW_MS,
  },
  {
    id: "premium",
    name: "Premium",
    price: 3500,
    hourlyRate: 0.42,
    features: [
      "0.42 APN / hour earning rate (4.2x Basic)",
      "Priority task unlocks + exclusive surveys",
      "Higher referral bonus tier (120 APN per invitee)",
      "Express withdrawals (1 business day)",
      "Skill Academy access (certifications unlock bonus tasks)",
      "24/7 chat support",
    ],
    active: true,
    createdAt: NOW_MS,
    updatedAt: NOW_MS,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 8000,
    hourlyRate: 1.25,
    features: [
      "1.25 APN / hour maximum earning rate (12.5x Basic)",
      "All Premium features + VIP weekly contests",
      "Highest referral tier (250 APN per invitee + override codes)",
      "Instant withdrawal queue (minutes during business hours)",
      "Dedicated account manager + custom payout reports",
      "Early access to new platform features",
    ],
    active: true,
    createdAt: NOW_MS,
    updatedAt: NOW_MS,
  },
];

const COMPARABLE_FIELDS: Array<keyof PlanDoc> = [
  "name",
  "price",
  "hourlyRate",
  "features",
  "active",
];

type PlanResult = {
  id: string;
  action: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";
  message?: string;
};

function arraysEqual<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function planDiffers(existing: PlanDoc, canonical: PlanDoc): boolean {
  for (const field of COMPARABLE_FIELDS) {
    const a = existing[field];
    const b = canonical[field];
    if (field === "features") {
      if (!arraysEqual(a as string[], b as string[])) return true;
    } else {
      if (a !== b) return true;
    }
  }
  return false;
}

async function processPlan(plan: PlanDoc): Promise<PlanResult> {
  const db = getAdminDb();
  const ref = db.collection("plans").doc(plan.id);
  const snap = await ref.get();

  if (!snap.exists) {
    const createData: PlanDoc = {
      ...plan,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await ref.create(createData);
    console.log(`[seed:plans] CREATED plan ${plan.id} (price=${plan.price}, rate=${plan.hourlyRate})`);
    return { id: plan.id, action: "CREATED" };
  }

  const existing = snap.data() as PlanDoc;
  if (!planDiffers(existing, plan)) {
    console.log(`[seed:plans] SKIPPED plan ${plan.id} (no changes detected)`);
    return { id: plan.id, action: "SKIPPED" };
  }

  const updateData: Partial<PlanDoc> = {
    name: plan.name,
    price: plan.price,
    hourlyRate: plan.hourlyRate,
    features: plan.features,
    active: plan.active,
    updatedAt: Date.now(),
  };
  await ref.update(updateData);
  console.log(`[seed:plans] UPDATED plan ${plan.id} (fields changed: ${COMPARABLE_FIELDS.filter(f => existing[f] !== (plan as any)[f] && f !== "features").join(",")}${!arraysEqual(existing.features, plan.features) ? ",features" : ""})`);
  return { id: plan.id, action: "UPDATED" };
}

async function main() {
  let app: ReturnType<typeof getAdminApp>;
  try {
    app = getAdminApp();
    if (!app) throw new Error("getAdminApp() returned a falsy value");
  } catch (err: any) {
    console.error("[seed:plans][ERROR] Admin SDK initialization failed.");
    console.error("[seed:plans][HINT] Ensure .env.local contains the following vars with valid values:");
    console.error("  - FIREBASE_ADMIN_PROJECT_ID");
    console.error("  - FIREBASE_ADMIN_CLIENT_EMAIL");
    console.error("  - FIREBASE_ADMIN_PRIVATE_KEY (with literal \\n sequences)");
    if (err?.message) console.error(`[seed:plans][DETAIL] ${err.message}`);
    process.exit(2);
  }

  const db = getAdminDb();
  try {
    await db.collection("plans").limit(0).get();
  } catch (err: any) {
    console.error("[seed:plans][ERROR] Firestore unreachable or credentials lack permission.");
    const code = err?.code ?? "unknown";
    console.error(`[seed:plans][DETAIL] Firebase error code: ${code}`);
    if (code === "permission-denied") {
      console.error("[seed:plans][HINT] Grant the service account the Cloud Datastore User or Editor role, or limit the scope to the plans collection.");
    } else if (code === "unavailable" || code === "deadline-exceeded") {
      console.error("[seed:plans][HINT] Check network connectivity and that Firestore is enabled for project " + (app.options.projectId ?? "<unknown>") + ".");
    }
    process.exit(3);
  }

  const results: PlanResult[] = [];
  const failures: PlanResult[] = [];

  for (const plan of PLANS) {
    try {
      const result = await processPlan(plan);
      results.push(result);
      if (result.action === "FAILED") failures.push(result);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[seed:plans][ERROR] Failed to process plan ${plan.id}: ${msg}`);
      const failed: PlanResult = { id: plan.id, action: "FAILED", message: msg };
      results.push(failed);
      failures.push(failed);
    }
  }

  const created = results.filter(r => r.action === "CREATED").length;
  const updated = results.filter(r => r.action === "UPDATED").length;
  const skipped = results.filter(r => r.action === "SKIPPED").length;

  if (failures.length > 0) {
    console.error(`[seed:plans][SUMMARY] ${created} created / ${updated} updated / ${skipped} skipped / ${failures.length} FAILED`);
    console.error("[seed:plans][FAILED_PLANS]");
    for (const f of failures) {
      console.error(`  - ${f.id}: ${f.message ?? "unspecified error"}`);
    }
    process.exit(4);
  }

  console.log(`[seed:plans][SUMMARY] Done: ${created} created / ${updated} updated / ${skipped} skipped — all ${PLANS.length} plans ok`);
  process.exit(0);
}

main().catch((err: any) => {
  console.error("[seed:plans][FATAL] Unhandled exception during seed run:");
  console.error(err?.stack ?? err);
  process.exit(1);
});
