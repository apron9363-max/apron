import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  setPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

type Firestore = ReturnType<typeof getFirestore>;

const clientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function getClientApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) return existing;
  if (!clientConfig.apiKey || !clientConfig.projectId) {
    throw new Error(
      "[Firebase Client] Missing NEXT_PUBLIC_FIREBASE_* environment variables.",
    );
  }
  return initializeApp(clientConfig);
}

let cachedAuth: Auth | null = null;
export function getClientAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const auth = getAuth(getClientApp());
  if (typeof window === "undefined") {
    setPersistence(auth, inMemoryPersistence).catch(() => undefined);
  }
  cachedAuth = auth;
  return auth;
}

let cachedFirestore: Firestore | null = null;
export function getClientFirestore(): Firestore {
  if (cachedFirestore) return cachedFirestore;
  cachedFirestore = getFirestore(getClientApp());
  return cachedFirestore;
}
