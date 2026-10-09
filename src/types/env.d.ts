declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_FIREBASE_API_KEY: string;
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
      NEXT_PUBLIC_FIREBASE_APP_ID: string;
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
      NEXT_PUBLIC_SITE_URL?: string;
      FIREBASE_ADMIN_PROJECT_ID?: string;
      FIREBASE_ADMIN_CLIENT_EMAIL?: string;
      FIREBASE_ADMIN_PRIVATE_KEY?: string;
      SESSION_DURATION_SECONDS?: string;
      WITHDRAWAL_FEE_PCT?: string;
      WITHDRAWAL_PROCESSING_FEE_PCT?: string;
      MIN_WITHDRAWAL?: string;
      MAX_WITHDRAWAL?: string;
      DEFAULT_REFERRAL_BONUS?: string;
      HMAC_SECRET?: string;
      WORKER_TOKEN?: string;
    }
  }
}
export {};
