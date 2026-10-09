import "server-only";
import {
  initializeApp as adminInit,
  getApps as adminGetApps,
  cert,
  type App as AdminApp,
} from "firebase-admin/app";
import { getAuth as adminGetAuth, type Auth as AdminAuth } from "firebase-admin/auth";
import { getFirestore as adminGetFirestore, type Firestore as AdminFirestore } from "firebase-admin/firestore";
import { getStorage as adminGetStorage, type Storage as AdminStorage } from "firebase-admin/storage";

function buildCredentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    });
  }
  return undefined;
}

export function getAdminApp(): AdminApp {
  const existing = adminGetApps()[0];
  if (existing) return existing;
  return adminInit({
    credential: buildCredentials(),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? undefined,
  });
}

let adminAuthCached: AdminAuth | null = null;
export function getAdminAuth(): AdminAuth {
  if (adminAuthCached) return adminAuthCached;
  adminAuthCached = adminGetAuth(getAdminApp());
  return adminAuthCached;
}

let adminDbCached: AdminFirestore | null = null;
export function getAdminDb(): AdminFirestore {
  if (adminDbCached) return adminDbCached;
  adminDbCached = adminGetFirestore(getAdminApp());
  return adminDbCached;
}

let adminStorageCached: AdminStorage | null = null;
export function getAdminStorage(): AdminStorage {
  if (adminStorageCached) return adminStorageCached;
  adminStorageCached = adminGetStorage(getAdminApp());
  return adminStorageCached;
}
