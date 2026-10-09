"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import {
  createUserDoc,
  getUser,
  getUserByReferralCode,
  updateUser,
  createEarning,
  getAdminDb,
  getSettings,
  generateUniqueReferralCode,
} from "@/lib/firestore";
import { getAdminAuth } from "@/firebase/admin";
import {
  registerSchema,
  userIdSchema,
} from "@/lib/validations/schemas";
import { DEFAULT_REFERRAL_BONUS, PLAN_IDS, COLLECTIONS } from "@/lib/constants";
import type { EarningDoc, UserDoc } from "@/types";
import { verifySessionCookie, createSessionCookie, clearSessionCookie } from "@/lib/server/session";
import {
  setAdminSessionCookie,
  clearAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/server/adminSession";

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function registerUserAction(input: z.infer<typeof registerSchema>) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }
  const { name, email, phone, referralCode } = parsed.data;

  let referredByUid: string | null = null;
  if (referralCode && referralCode.trim()) {
    const referrer = await getUserByReferralCode(referralCode.trim());
    if (!referrer) {
      return { ok: false, error: { referralCode: ["Invalid referral code"] } };
    }
    referredByUid = referrer.uid;
  }

  const auth = getAdminAuth();
  const { password } = parsed.data;

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone.startsWith("+") ? phone : undefined,
      emailVerified: false,
      disabled: false,
    });

    const starter = {
      plan: PLAN_IDS.starter,
      planExpiresAt: null as number | null,
      apnRate: 0.1,
      balance: 0,
      taskBalance: 0,
    };

    const referral = await generateUniqueReferralCode();

    await createUserDoc(userRecord.uid, {
      name,
      email,
      phone,
      role: "user",
      plan: starter.plan,
      planExpiresAt: starter.planExpiresAt,
      balance: starter.balance,
      taskBalance: starter.taskBalance,
      apnRate: starter.apnRate,
      referralCode: referral,
      referredBy: referredByUid,
      referralPaidOut: false,
      bankDetails: null,
      status: "active",
      emailVerified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      ok: true as const,
      uid: userRecord.uid,
      referralCode: referral,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    if (/email.*already/i.test(msg)) {
      return { ok: false, error: { email: ["Email already registered"] } };
    }
    if (/password/i.test(msg)) {
      return { ok: false, error: { password: [msg] } };
    }
    return { ok: false, error: { _: [msg] } };
  }
}

export async function markEmailVerifiedAction(input: z.infer<typeof userIdSchema>) {
  const { uid } = userIdSchema.parse(input);
  const user = await getUser(uid);
  if (!user) return { ok: false, error: "User not found" };
  await updateUser(uid, { emailVerified: true });
  try {
    await getAdminAuth().updateUser(uid, { emailVerified: true });
  } catch {
    // ignore non-fatal
  }
  await applyReferralBonusForVerifiedUser(uid);
  return { ok: true as const };
}

export async function applyReferralBonusForVerifiedUser(uid: string) {
  const user = await getUser(uid);
  if (!user) return;
  if (!user.referredBy || user.referralPaidOut) return;

  const referrerUid = user.referredBy;
  const referrer = await getUser(referrerUid);
  if (!referrer) return;

  const settings = await getSettings();
  const bonus = settings?.referralBonus ?? DEFAULT_REFERRAL_BONUS;

  const db = getAdminDb();
  const earningId = `referral-${uid}`;
  const earningRef = db.collection(COLLECTIONS.earnings).doc(earningId);
  try {
    await db.runTransaction(async (tx) => {
      const inviteeRef = db.collection(COLLECTIONS.users).doc(uid);
      const referrerRef = db.collection(COLLECTIONS.users).doc(referrerUid);

      const [inviteeSnap, referrerSnap, earningSnap] = await Promise.all([
        tx.get(inviteeRef),
        tx.get(referrerRef),
        tx.get(earningRef),
      ]);

      if (!inviteeSnap.exists || !referrerSnap.exists) return;
      const invitee = inviteeSnap.data() as Pick<UserDoc, "referralPaidOut" | "referredBy">;
      if (!invitee.referredBy || invitee.referralPaidOut) return;
      if (earningSnap.exists) return;

      const referrerDoc = referrerSnap.data() as Pick<UserDoc, "balance" | "taskBalance">;
      const newBalance = (referrerDoc.balance ?? 0) + bonus;
      const newTask = (referrerDoc.taskBalance ?? 0) + bonus;
      const now = Date.now();

      tx.update(referrerRef, {
        balance: newBalance,
        taskBalance: newTask,
        updatedAt: now,
      });

      tx.create(earningRef, {
        userId: referrerUid,
        source: "referral",
        amount: bonus,
        referenceId: uid,
        createdAt: now,
      } satisfies Omit<EarningDoc, "id">);

      tx.update(inviteeRef, {
        referralPaidOut: true,
        updatedAt: now,
      });
    });
  } catch (e) {
    return;
  }
}

export async function createSessionFromIdTokenAction(idToken: string) {
  if (!idToken || typeof idToken !== "string") {
    return { ok: false, error: "Missing idToken" };
  }
  try {
    await createSessionCookie(idToken);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid token" };
  }
}

export async function logoutAction() {
  clearSessionCookie();
  clearAdminSessionCookie();
  redirect("/login");
}

export async function getCurrentSession() {
  return verifySessionCookie();
}

export async function adminLoginAction(input: {
  email: string;
  password: string;
}) {
  const z = await import("zod");
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid email or password" };
  }
  const { email, password } = parsed.data;
  const valid = verifyAdminCredentials(email, password);
  if (!valid) {
    return { ok: false, error: "Invalid email or password" };
  }
  setAdminSessionCookie();
  return { ok: true };
}

export async function adminLogoutAction() {
  clearSessionCookie();
  clearAdminSessionCookie();
  redirect("/admin/login");
}

export async function sendVerificationEmailAction(input: {
  idToken?: string;
  uid?: string;
}) {
  const z = await import("zod");
  const schema = z.object({
    idToken: z.string().optional(),
    uid: z.string().optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid request" };
  }
  const { idToken } = parsed.data;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const continueUrl =
    (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") + "/verify";
  const auth = getAdminAuth();
  let emailToSend = "";
  let directLink: string | undefined;

  try {
    if (idToken) {
      try {
        const decoded = await auth.verifyIdToken(idToken);
        emailToSend = decoded.email ?? "";
      } catch {
        emailToSend = "";
      }
    }
    if (!emailToSend && parsed.data.uid) {
      try {
        const user = await auth.getUser(parsed.data.uid);
        emailToSend = user.email ?? "";
      } catch {
        emailToSend = "";
      }
    }

    if (!emailToSend) {
      return { ok: false, error: "Unable to identify user account" };
    }

    try {
      directLink = await auth.generateEmailVerificationLink(emailToSend, {
        url: continueUrl,
        handleCodeInApp: false,
      });
    } catch {
      directLink = undefined;
    }

    if (!apiKey) {
      if (directLink) {
        return {
          ok: true,
          email: emailToSend,
          directLink,
          warning: "Email relay unavailable",
        };
      }
      return {
        ok: false,
        error: "Firebase API key not configured",
      };
    }

    const body: Record<string, unknown> = {
      requestType: "VERIFY_EMAIL",
      continueUrl,
      canHandleCodeInApp: false,
    };
    if (idToken) {
      body.idToken = idToken;
    } else {
      body.email = emailToSend;
      if (process.env.FIREBASE_ADMIN_PROJECT_ID) {
        body.targetProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      }
    }

    try {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg =
          (data as any)?.error?.message ?? "Failed to send email";
        return {
          ok: !!directLink,
          email: emailToSend,
          error: msg,
          directLink,
        };
      }
      return {
        ok: true,
        email: emailToSend,
        directLink,
      };
    } catch (e: any) {
      return {
        ok: !!directLink,
        email: emailToSend,
        error: e?.message ?? "Network error",
        directLink,
      };
    }
  } catch (e: any) {
    return {
      ok: !!directLink,
      email: emailToSend,
      error: e?.message ?? "Failed to send verification",
      directLink,
    };
  }
}

export async function createUserDocOnSignupAction(input: {
  uid: string;
  name: string;
  email: string;
  phone: string;
  referralCode?: string;
}) {
  const z = await import("zod");
  const schema = z.object({
    uid: z.string().min(1),
    name: z.string().min(2).max(80),
    email: z.string().email(),
    phone: z.string().min(8).max(20),
    referralCode: z.string().max(16).optional().or(z.literal("")),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid fields" };
  const { uid, name, email, phone, referralCode } = parsed.data;
  let referredByUid: string | null = null;
  if (referralCode && referralCode.trim()) {
    const referrer = await getUserByReferralCode(referralCode.trim());
    if (referrer) referredByUid = referrer.uid;
  }
  const existing = await getUser(uid);
  if (existing) {
    return { ok: true, uid, alreadyExisted: true, referralCode: existing.referralCode };
  }
  const referral = await generateUniqueReferralCode();
  await createUserDoc(uid, {
    name,
    email,
    phone,
    role: "user",
    plan: PLAN_IDS.starter,
    planExpiresAt: null,
    balance: 0,
    taskBalance: 0,
    apnRate: 0.1,
    referralCode: referral,
    referredBy: referredByUid,
    referralPaidOut: false,
    bankDetails: null,
    status: "active",
    emailVerified: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return { ok: true, uid, referralCode: referral };
}

export async function syncGoogleUserDocAction(input: {
  uid: string;
  name?: string;
  email: string;
}) {
  const z = await import("zod");
  const schema = z.object({
    uid: z.string().min(1),
    name: z.string().max(80).optional(),
    email: z.string().email(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid fields" };
  const { uid, name, email } = parsed.data;
  const existing = await getUser(uid);
  if (existing) return { ok: true, existed: true, referralCode: existing.referralCode };
  const referral = await generateUniqueReferralCode();
  await createUserDoc(uid, {
    name: name?.trim() || email.split("@")[0],
    email,
    phone: "",
    role: "user",
    plan: PLAN_IDS.starter,
    planExpiresAt: null,
    balance: 0,
    taskBalance: 0,
    apnRate: 0.1,
    referralCode: referral,
    referredBy: null,
    referralPaidOut: false,
    bankDetails: null,
    status: "active",
    emailVerified: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  try {
    await applyReferralBonusForVerifiedUser(uid);
  } catch {
    // non-fatal: bonus can be applied manually later
  }
  return { ok: true, referralCode: referral };
}
