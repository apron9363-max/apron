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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyD-H6tMuUy_r4g7_h8mmymbo3oMMzQTZAU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "apron-c8bd8.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "apron-c8bd8",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "apron-c8bd8.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "829444884967",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:829444884967:web:346591960f6c922ad79542",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-VK3FFFG67X",
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
