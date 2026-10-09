import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getAdminApp, getAdminDb, getAdminAuth } from "../src/lib/firebase/admin";
import type { UserDoc } from "../src/types";
import { PLAN_IDS } from "../src/lib/constants";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@apron.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Apron@2025";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Platform Admin";
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? "+0000000000";

type Result = {
  action: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";
  uid?: string;
  message?: string;
};

function genReferralCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash);
  const prefix = "ADM";
  const suffix = abs.toString(36).padStart(4, "0").slice(0, 4).toUpperCase();
  return prefix + suffix;
}

async function main() {
  let app: ReturnType<typeof getAdminApp>;
  try {
    app = getAdminApp();
    if (!app) throw new Error("getAdminApp() returned a falsy value");
  } catch (err: any) {
    console.error("[ensure:admin][ERROR] Admin SDK initialization failed.");
    console.error("[ensure:admin][HINT] Ensure .env.local contains the following vars with valid values:");
    console.error("  - FIREBASE_ADMIN_PROJECT_ID");
    console.error("  - FIREBASE_ADMIN_CLIENT_EMAIL");
    console.error("  - FIREBASE_ADMIN_PRIVATE_KEY (with literal \\n sequences)");
    if (err?.message) console.error(`[ensure:admin][DETAIL] ${err.message}`);
    process.exit(2);
  }

  const auth = getAdminAuth();
  const db = getAdminDb();

  try {
    await db.collection("users").limit(0).get();
  } catch (err: any) {
    console.error("[ensure:admin][ERROR] Firestore unreachable or credentials lack permission.");
    const code = err?.code ?? "unknown";
    console.error(`[ensure:admin][DETAIL] Firebase error code: ${code}`);
    if (code === "permission-denied") {
      console.error("[ensure:admin][HINT] Grant the service account the Cloud Datastore User or Editor role.");
    } else if (code === "unavailable" || code === "deadline-exceeded") {
      console.error("[ensure:admin][HINT] Check network connectivity and that Firestore is enabled for project " + (app.options.projectId ?? "<unknown>") + ".");
    }
    process.exit(3);
  }

  const result: Result = { action: "SKIPPED" };
  let uid: string | null = null;

  try {
    let existingUser: any = null;
    try {
      existingUser = await auth.getUserByEmail(ADMIN_EMAIL);
      uid = existingUser.uid;
    } catch (lookupErr: any) {
      if (lookupErr?.code !== "auth/user-not-found") {
        throw lookupErr;
      }
    }

    if (!uid) {
      const created = await auth.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_NAME,
        emailVerified: true,
        disabled: false,
      });
      uid = created.uid;
      console.log(`[ensure:admin] CREATED Firebase Auth user: ${ADMIN_EMAIL} (uid=${uid})`);
      result.action = "CREATED";
    } else {
      console.log(`[ensure:admin] Auth user exists: ${ADMIN_EMAIL} (uid=${uid})`);
      const needsUpdate =
        existingUser.emailVerified !== true ||
        existingUser.displayName !== ADMIN_NAME ||
        existingUser.disabled === true;
      if (needsUpdate) {
        await auth.updateUser(uid, {
          emailVerified: true,
          displayName: ADMIN_NAME,
          disabled: false,
        });
        console.log("[ensure:admin] UPDATED Auth user fields: emailVerified=true, displayName, disabled=false");
        if (result.action !== "CREATED") result.action = "UPDATED";
      }
    }

    try {
      await auth.setCustomUserClaims(uid, {
        role: "admin",
      });
      console.log("[ensure:admin] Custom user claims applied: { role: 'admin' }");
    } catch (claimsErr: any) {
      console.error(`[ensure:admin][WARN] Failed to set custom claims: ${claimsErr?.message ?? claimsErr}`);
    }

    const docRef = db.collection("users").doc(uid);
    const snap = await docRef.get();

    if (!snap.exists) {
      const now = Date.now();
      const userDoc: UserDoc = {
        uid,
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        role: "admin",
        plan: PLAN_IDS.starter,
        planExpiresAt: null,
        balance: 0,
        taskBalance: 0,
        apnRate: 0.1,
        referralCode: genReferralCode(ADMIN_EMAIL + uid.slice(0, 4)),
        referredBy: null,
        referralPaidOut: true,
        bankDetails: null,
        status: "active",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      };
      await docRef.create(userDoc);
      console.log("[ensure:admin] CREATED Firestore /users/{uid} doc: role=admin, emailVerified=true");
      if (result.action === "SKIPPED") result.action = "UPDATED";
    } else {
      const existingDoc = snap.data() as Partial<UserDoc>;
      const patch: Partial<UserDoc> = { updatedAt: Date.now() };
      let changed = false;
      if (existingDoc.role !== "admin") {
        patch.role = "admin";
        changed = true;
      }
      if (existingDoc.emailVerified !== true) {
        patch.emailVerified = true;
        changed = true;
      }
      if (existingDoc.status !== "active") {
        patch.status = "active";
        changed = true;
      }
      if (!existingDoc.name || existingDoc.name !== ADMIN_NAME) {
        patch.name = ADMIN_NAME;
        changed = true;
      }
      if (!existingDoc.phone) {
        patch.phone = ADMIN_PHONE;
        changed = true;
      }
      if (!existingDoc.referralCode) {
        patch.referralCode = genReferralCode(ADMIN_EMAIL + uid.slice(0, 4));
        changed = true;
      }
      if (changed) {
        await docRef.update(patch);
        console.log(
          `[ensure:admin] UPDATED Firestore /users/${uid} doc: applied patch { ${Object.keys(patch).join(", ")} }`,
        );
        if (result.action === "SKIPPED") result.action = "UPDATED";
      } else {
        console.log("[ensure:admin] Firestore user doc unchanged; SKIPPED Firestore update");
      }
    }
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[ensure:admin][ERROR] Failed to provision admin user: ${msg}`);
    console.error(err?.stack ?? err);
    result.action = "FAILED";
    result.message = msg;
    result.uid = uid ?? undefined;
  }

  console.log("----------------------------------------");
  console.log("[ensure:admin][SUMMARY] Admin provisioning complete.");
  console.log(`  - Project:     ${app.options.projectId ?? "<unknown>"}`);
  console.log(`  - Admin email: ${ADMIN_EMAIL}`);
  console.log(`  - Admin name:  ${ADMIN_NAME}`);
  console.log(`  - Result:      ${result.action}`);
  if (result.uid) console.log(`  - UID:         ${result.uid}`);
  if (result.message) console.log(`  - Message:     ${result.message}`);
  console.log("----------------------------------------");
  console.log("[ensure:admin][HINT] Override credentials via env vars:");
  console.log("  ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_PHONE");

  if (result.action === "FAILED") {
    process.exit(4);
  }
  process.exit(0);
}

main().catch((err: any) => {
  console.error("[ensure:admin][FATAL] Unhandled exception:");
  console.error(err?.stack ?? err);
  process.exit(1);
});
