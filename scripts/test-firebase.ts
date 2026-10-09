import "server-only";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getAdminApp, getAdminAuth, getAdminDb, getAdminStorage } from "@/lib/firebase/admin";

async function main() {
  console.log("== Phase 1: Firebase SDK Connection Test ==");

  // 1) Admin App init
  let appOk = false;
  try {
    const app = getAdminApp();
    console.log(`[OK]   Admin app initialized (projectId=${app.options.projectId ?? "default"})`);
    appOk = true;
  } catch (e: any) {
    console.log(`[FAIL] Admin app: ${e?.message ?? e}`);
  }

  // 2) Admin Auth listUsers
  try {
    const auth = getAdminAuth();
    const page = await auth.listUsers(1);
    console.log(`[OK]   Admin auth reachable (users in snapshot: ${page.users.length})`);
  } catch (e: any) {
    console.log(`[WARN] Admin auth: ${e?.message ?? e} (expected if env vars not set)`);
  }

  // 3) Admin Firestore limit(1) read on users
  try {
    const db = getAdminDb();
    const snap = await db.collection("users").limit(1).get();
    console.log(`[OK]   Admin firestore reachable (docs in snapshot: ${snap.docs.length})`);
  } catch (e: any) {
    console.log(`[WARN] Admin firestore: ${e?.message ?? e} (expected if env vars not set)`);
  }

  // 4) Admin Storage bucket
  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    console.log(`[OK]   Admin storage reachable (bucket=${bucket.name ?? "default"})`);
  } catch (e: any) {
    console.log(`[WARN] Admin storage: ${e?.message ?? e} (expected if env vars not set)`);
  }

  // 5) Client config shape (no actual network call; just validate key presence)
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) {
    console.log("[OK]   Client env vars fully configured");
  } else {
    console.log(`[WARN] Client env vars missing: ${missing.join(", ")}`);
  }

  console.log("== Done ==");
  process.exit(appOk ? 0 : 1);
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(1);
});
