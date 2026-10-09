"use client";

import * as React from "react";
import {
  signInWithEmailAndPassword as fbSignIn,
  createUserWithEmailAndPassword as fbCreate,
  sendEmailVerification as fbSendVerify,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  reload,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@/firebase/client";

export type AuthUser = User;

export function useFirebaseAuth() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    try {
      const auth = getClientAuth();
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
      return unsub;
    } catch {
      setLoading(false);
      return;
    }
  }, []);

  return { user, loading };
}

export async function createSessionFromIdToken(idToken: string) {
  if (!idToken || typeof idToken !== "string" || idToken.trim().length === 0) {
    throw new Error("Invalid id token");
  }
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error ?? "Failed to establish session");
  }
  return body as { ok: boolean };
}

export async function registerWithEmailAndPassword(
  email: string,
  password: string,
) {
  const auth = getClientAuth();
  return fbCreate(auth, email, password);
}

export async function sendEmailVerificationLink(user: User) {
  return fbSendVerify(user, {
    url:
      (typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") + "/verify",
    handleCodeInApp: false,
  });
}

export async function signInWithEmailAndPassword(
  email: string,
  password: string,
) {
  const auth = getClientAuth();
  return fbSignIn(auth, email, password);
}

export async function signInWithGooglePopup() {
  let auth;
  try {
    auth = getClientAuth();
  } catch (e: any) {
    throw new Error(e?.message ?? "Authentication service unavailable");
  }
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    return await signInWithPopup(auth, provider);
  } catch (e: any) {
    const code: string = e?.code ?? "";
    const msg: string = e?.message ?? String(e);
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      /popup.*closed|cancelled/i.test(msg)
    ) {
      throw e;
    }
    if (code === "auth/popup-blocked") {
      throw new Error(
        "Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.",
      );
    }
    if (code === "auth/operation-not-allowed") {
      throw new Error(
        "Google sign-in is not enabled for this project. Please contact support or use email sign-in.",
      );
    }
    if (code === "auth/account-exists-with-different-credential") {
      throw new Error(
        "An account already exists with this email using a different sign-in method. Please sign in with your original method.",
      );
    }
    if (code === "auth/invalid-api-key" || /api.*key/i.test(msg)) {
      throw new Error("Firebase configuration is invalid. Please contact support.");
    }
    throw e;
  }
}

export async function reloadAuthUser(user: User) {
  return reload(user);
}

export async function signOutClient() {
  try {
    const auth = getClientAuth();
    await fbSignOut(auth);
  } catch {
    // ignore
  }
  await fetch("/api/auth/logout", { method: "POST" });
}
