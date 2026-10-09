# Phase 2 — End-to-End Authentication System — Product Requirements Document

## Overview
- **Summary**: Implement a production-ready end-to-end authentication system for the Apron rewards platform, covering responsive login/registration UI, secure email/password + Google OAuth flows, mandatory email verification, hardened middleware, Firestore user-document creation, cryptographically unique referral codes, and referral bonus crediting with audit logging.
- **Purpose**: Replace the scaffolded (partially broken) Phase 1 auth flows with a secure, verified, and design-compliant implementation that enables safe onboarding while enforcing platform access controls.
- **Target Users**: New and returning Apron end users (email/password & Google sign-in), platform admins, and auditors.

## Goals
- Deliver pixel-perfect responsive login and registration pages consistent with the Apron dark-purple + gold + glassmorphic design system.
- Securely on-board users via email/password (with self-chosen strong password) and Google OAuth, with email-verified access gating.
- Enforce protected-route controls at the edge middleware, the route-group layout layer, and within Firestore rules.
- Guarantee every new user receives a unique referral code; valid referrers earn the designated referral bonus after their invitee verifies; and every referral transaction is auditable.
- Provide end-to-end build/lint/type evidence plus scripted validation harnesses.

## Non-Goals
- Passwordless magic-link sign-in beyond Firebase default reset-email flow.
- Phone (SMS) MFA or TOTP MFA beyond what Firebase provides out-of-the-box.
- Multi-tenant or organizational SSO (SAML, OIDC enterprise providers).
- Full provider-merge UI for explicit cross-provider account linking (relies on Firebase implicit same-email merge semantics).
- Custom transactional email templates beyond Firebase defaults (action URLs are kept as `handleCodeInApp: false`).

## Background & Context
Phase 1 delivered scaffolded pages and SDK integration but left material correctness gaps:
- The Register page generated a *server-unknown temporary random password* via the client SDK; the user received no way to set their own password, breaking re-login.
- Login page's "Forgot password?" link pointed to `/auth/register` and no forgot-password page existed.
- The `(app)` route-group layout redirected only missing sessions + banned users, but allowed an *unverified* user with a valid session cookie to reach all app pages directly via URL.
- Referral code generation used random bytes without a collision check, violating uniqueness guarantees under the birthday bound.
- Middleware performed only a *cookie presence* check at the edge without verification of email verification or role.
- Password strength was a weak Zod `min(6)`.

These gaps are listed as constraints/dependencies below; fixes are part of the explicit FR set.

## Functional Requirements
- **FR-1 (Register UI)**: Render a responsive Register page collecting `Full name`, `Email`, `Phone`, `Password`, `Confirm password`, and optional `Referral code`; prefill `referralCode` from URL `?ref=` query param.
- **FR-2 (Register flow)**: On Register submit, validate inputs, call a single server-side action that (a) creates the Firebase Auth user via the Admin SDK with the *user-chosen* password, (b) inserts the Firestore user doc with verified defaults + unique referral code + optional referrer linkage, (c) sends a time-sensitive email verification link, (d) mints a session cookie, (e) redirects to `/auth/verify`.
- **FR-3 (Login UI)**: Render a responsive Login page with `Email`, `Password`, primary submit, Google OAuth button, working "Forgot password?" link, and "Create one" link to `/auth/register`.
- **FR-4 (Login flow — email/password)**: On Login submit, sign the user in on the client, exchange the idToken for an httpOnly session cookie, redirect to `/auth/verify` when `emailVerified === false`, otherwise redirect to `next` query param (default `/dashboard`); route banned users to `/auth/blocked`.
- **FR-5 (Google OAuth)**: Google popup sign-in uses the client GoogleAuthProvider requesting `email` + `profile` scopes; on success, call `syncGoogleUserDocAction` to upsert a Firestore user doc (marking `emailVerified: true` since Google verified the email), create a session cookie, check session status (banned → `/auth/blocked`), then redirect to `next`.
- **FR-6 (Email verification)**: `/auth/verify` page auto-polls or lets user manually "Check status"; supports "Resend email"; marks Firestore `emailVerified: true` via `markEmailVerifiedAction` (which also calls `applyReferralBonusForVerifiedUser`); redirects to `/dashboard` on success.
- **FR-7 (Forgot / reset password)**: Provide `/auth/forgot-password` page that sends a Firebase password-reset email via client SDK; update Login page "Forgot password?" link to point to this page.
- **FR-8 (Middleware)**: At the edge, (a) skip public paths, (b) redirect missing-session to `/auth/login?next=<origin>`, (c) ensure `/admin/*` is treated as non-public so the `/admin/layout` role check runs after session is established; middleware config matches current Next matcher.
- **FR-9 (Layout access gating)**: `(app)/layout` redirects missing-session → `/auth/login`, banned → `/auth/blocked`, and *`emailVerified === false` → `/auth/verify`*. `admin/layout` redirects non-admin role to `/dashboard`.
- **FR-10 (User doc creation)**: Every new email-signup or Google-signup receives a standardized `UserDoc` Firestore document: `uid, name, email, phone, role="user", plan=starter, planExpiresAt=null, balance=0, taskBalance=0, apnRate=0.1, referralCode=<unique>, referredBy=<uid|null>, referralPaidOut=false, bankDetails=null, status="active", emailVerified=<false for email-signup, true for Google>, createdAt, updatedAt`.
- **FR-11 (Referral code uniqueness)**: Generate an 8-char base-32 uppercase code (charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) using `crypto.getRandomValues` (server-side) with a bounded *check-duplicate-and-retry loop* (max 5 attempts) against the Firestore `users` collection index on `referralCode`.
- **FR-12 (Referral bonus crediting)**: After the invitee's email becomes verified (explicit call to `applyReferralBonusForVerifiedUser` in `markEmailVerifiedAction` + post-Google-sync), run a Firestore transaction that atomically adds `settings.referralBonus ?? DEFAULT_REFERRAL_BONUS` to the referrer's `balance` and `taskBalance`, writes a `source="referral"` earning doc with `referenceId=<invitee uid>`, and marks the invitee's `referralPaidOut=true` as idempotency guard.
- **FR-13 (Password policy)**: Zod schemas enforce: password `length >= 8`, contains at least one uppercase A–Z, at least one digit 0–9 (Register); Login keeps same rules (fails server-validation with clear error).
- **FR-14 (Register schema)**: Update `registerSchema` to include `password` + `confirmPassword` and add a custom refine check that passwords match.
- **FR-15 (Resend verification throttling)**: Client-side disable "Resend email" button for 30s after each click to reduce spam (front-end best-effort).

## Non-Functional Requirements
- **NFR-1 (Design fidelity)**: All auth pages use purple gradient `bg-apron-gradient` background, gold `btn-primary` / `Button variant="primary"` CTAs, and `.glass` / `.input-base` form controls with `backdrop-blur-md`, semi-transparent `bg-white/10` panels, and subtle `border-white/20` borders.
- **NFR-2 (Responsive / cross-browser)**: Auth layouts use `max-w-[430px]` centered container; no horizontal scroll at widths ≥ 320px; tested in Chrome/Blink engine at 320×640, 768×1024, and 1440×900 via logical responsive CSS.
- **NFR-3 (Secure tokens)**: idTokens are exchanged immediately for httpOnly `SameSite=Lax` session cookies with `secure: true` in `NODE_ENV=production`; no idToken/refreshToken persisted in `localStorage`; client auth uses in-memory persistence during SSR.
- **NFR-4 (No secret leakage)**: Firebase Admin private key and service-role env vars never appear in client bundles (enforced by `server-only` gating on `lib/firebase/admin.ts`).
- **NFR-5 (Data in transit)**: Auth endpoints and actions run over HTTPS in production (enforced by platform); session cookies set `Secure` only when `NODE_ENV=production` to keep local dev usable.
- **NFR-6 (Build hygiene)**: `npm run build`, `npm run typecheck`, and `npm run lint` exit with code 0.
- **NFR-7 (Firestore rule correctness)**: Existing rules remain valid (users read/write only own doc with protected-field blacklist; admins full CRUD).

## Constraints
- **Technical**: Next.js 14 App Router, Firebase v10 (client) and firebase-admin v12, Tailwind + `glass` component class, Zod + react-hook-form. Edge middleware cannot call Firebase Admin SDK; role/verification enforcement is a layout/server-component responsibility.
- **Business**: Referral bonus triggers only *after* the referred user verifies email (prevents fake-account farming); idempotency via `referralPaidOut` boolean prevents double payouts on retries.
- **Dependencies**: Firebase console must enable Email/Password and Google sign-in methods; the existing .env values for `NEXT_PUBLIC_FIREBASE_*` and Admin SDK credentials must remain present.

## Assumptions
- Referral bonus defaults to 50 APN coins (`DEFAULT_REFERRAL_BONUS`) unless overridden by Firestore `settings/platform.referralBonus`. (User selected "Other" → keep existing constant + override via settings.)
- Session duration remains 7 days fixed (`SESSION_DURATION_SECONDS=604800`); `verifySessionCookie` uses `checkRevoked=true` so admin revocations invalidate sessions immediately. (User selected "Other" → keep existing duration.)
- Firebase default oobCodes provide the "time-sensitive" verification link expiry (typically ~1 hour for email verification links).
- Account linking follows Firebase implicit same-email merge semantics; explicit provider-link UI is out of scope.

## Open Questions
None remaining after structured Q&A. All ambiguous dimensions are bound by the Assumptions above.

## Acceptance Criteria

### AC-1: Users can register with a self-chosen strong password
- **Type**: `rule`
- **Given**: An unauthenticated visitor
- **When**: They submit the Register form with valid fields (name, email, phone, password ≥ 8 chars with uppercase + digit, matching confirmation, optional referral code)
- **Then**: A Firebase Auth user is created with the submitted password; a Firestore `UserDoc` is written; the user receives a verification email; the page redirects to `/auth/verify`; the password they chose successfully logs them in on a subsequent visit
- **Pass Condition**: Scripted harness (or manual test) can submit register → observe Firestore doc → logout → re-login with same password → reach dashboard after verification
- **Evidence**: Build output + authActions trace showing `createUserWithEmailAndPassword` uses submitted password, not a server-unknown temp; `npm run build` passes

### AC-2: Register page pre-fills referral code from ?ref=
- **Type**: `rule`
- **Given**: Visitor navigates to `/auth/register?ref=ABCD1234`
- **When**: The Register page renders
- **Then**: The Referral code input contains `ABCD1234` and submitting with it records the referrer UID linkage on the new user doc (if code is valid)
- **Pass Condition**: Component mounts with the ref param value in the field; Firestore doc `referredBy` == uid of owner of that referralCode (or null if invalid)
- **Evidence**: UI snapshot (or source code useEffect injecting param) + post-submit Firestore doc contains correct referredBy

### AC-3: Email/password login redirects unverified users to /auth/verify
- **Type**: `rule`
- **Given**: A registered user whose email is not verified, with a valid session
- **When**: They login via Login form
- **Then**: They are redirected to `/auth/verify` (NOT `/dashboard`); direct navigation to `/dashboard` also redirects them to `/auth/verify`
- **Pass Condition**: Login page shows `/auth/verify` redirect; accessing `/dashboard` with unverified session returns redirect response to `/auth/verify`
- **Evidence**: Source of `login/page.tsx` emailVerified branch AND `(app)/layout.tsx` `emailVerified === false` branch

### AC-4: Google OAuth sign-in upserts user doc and skips verification
- **Type**: `rule`
- **Given**: A valid Google OAuth credential whose user email is verified by Google
- **When**: User clicks "Continue with Google" and completes popup flow
- **Then**: Firestore `UserDoc` is created (if new) with `emailVerified: true`; session cookie minted; user lands on `/dashboard`; `applyReferralBonusForVerifiedUser` is triggered for first-time sign-in
- **Pass Condition**: `syncGoogleUserDocAction` writes `emailVerified: true` for new users and calls referral apply; redirect destination is dashboard with session cookie set
- **Evidence**: Source of useFirebaseAuth Google handler + authActions.syncGoogleUserDocAction with verified=true + applyReferralBonusForVerifiedUser call

### AC-5: Forgot password page exists and link on Login works
- **Type**: `rule`
- **Given**: Visitor on Login page
- **When**: They click "Forgot password?"
- **Then**: They navigate to `/auth/forgot-password` and the page submits a reset-email via Firebase `sendPasswordResetEmail` with success UI messaging
- **Pass Condition**: Login "Forgot password?" `<Link href>` is `/auth/forgot-password`; route file exists at `(auth)/forgot-password/page.tsx`; page imports and calls `sendPasswordResetEmail`
- **Evidence**: Source of login page link href AND forgot-password page file exists with correct handler

### AC-6: Middleware redirects missing sessions to login with ?next=
- **Type**: `rule`
- **Given**: Request to `/dashboard` without `session` cookie
- **When**: Middleware runs
- **Then**: Response is a 307 redirect to `/auth/login?next=/dashboard`
- **Pass Condition**: `middleware.ts` PUBLIC_PATHS excludes `/dashboard` and has redirect branch setting `url.searchParams.set("next", pathname)`
- **Evidence**: Middleware source satisfies branches; `npm run build` passes so there are no runtime issues

### AC-7: (app) layout blocks unverified + banned users; admin layout blocks non-admin role
- **Type**: `rule`
- **Given**: Authenticated session with `emailVerified=false`, `status=banned`, or `role!=admin` (for admin area)
- **When**: Accessing `(app)/*` or `/admin/*` routes
- **Then**: Unverified → redirect `/auth/verify`; banned → `/auth/blocked`; non-admin accessing /admin → `/dashboard`
- **Pass Condition**: `(app)/layout.tsx` contains three redirect branches; `admin/layout.tsx` `role !== 'admin'` redirect exists
- **Evidence**: Source of both layout files contains required branches

### AC-8: Every new Firestore user doc has unique referral code
- **Type**: `rule`
- **Given**: N user registrations (email or Google)
- **When**: Inspecting all `users/*.referralCode`
- **Then**: The set of codes has cardinality N (no duplicates); each code is 8 chars uppercase [A-Z2-9]; generation logic retries on collision
- **Pass Condition**: `generateReferralCode` is called within a bounded retry that reads Firestore by code and regenerates if `getUserByReferralCode` returns non-null; uniqueness test across generated batch samples shows zero duplicates
- **Evidence**: Source of createUserDocOnSignupAction / syncGoogleUserDocAction contains retry loop around duplicate check

### AC-9: Referrer receives credit when their invitee verifies email
- **Type**: `rule`
- **Given**: User A with referral code R; User B registers with ref=R
- **When**: User B verifies email (invokes markEmailVerifiedAction)
- **Then**: User A's balance and taskBalance both increase by referralBonus; an `earnings` doc with source=referral and referenceId=B.uid is written; B.referralPaidOut becomes true; a repeat invocation of the apply function does NOT credit A a second time (idempotency)
- **Pass Condition**: Transaction credits A's balance + taskBalance; earnings collection contains matching doc; second run is no-op; all three invariants in post-state
- **Evidence**: Source of `applyReferralBonusForVerifiedUser` with transaction + idempotency check + earning log

### AC-10: Password policy enforced (length ≥ 8, uppercase, digit, match-confirm)
- **Type**: `rule`
- **Given**: Register submission with password `short` or `alllowercase` or without matching confirm
- **When**: Zod + react-hook-form validates
- **Then**: Inline error shown under password/confirmPassword; no Firebase call is made
- **Pass Condition**: `registerSchema` includes password+confirmPassword fields with regex rules and `.refine(() => pw == cpw)`; test harness or source confirms rejected submissions
- **Evidence**: Source of schemas.ts registerSchema contains the new fields and refinements; build passes

### AC-11: Design system compliance — purple gradient, gold CTAs, glass inputs
- **Type**: `rubric`
- **Dimension**: UI visual fidelity to the Apron design system
- **Scale**: 1-5
- **Anchors**: 1 = missing gradient / non-gold buttons / non-glass inputs; 3 = gradient present but buttons wrong variant or panels lack backdrop-blur; 5 = auth pages use `bg-apron-gradient` wrapper, gold-primary buttons via `Button variant="primary"` or equivalent, and `.glass` / `.input-base` with `backdrop-blur-md`, `bg-white/10`, `border-white/20`
- **Pass Threshold**: >= 4
- **Evidence**: Rendered page screenshot or source of `(auth)/layout.tsx`, `register/page.tsx`, `login/page.tsx`, `forgot-password/page.tsx`

### AC-12: Mobile responsiveness
- **Type**: `rubric`
- **Dimension**: Layout robustness across 320px → 1440px
- **Scale**: 1-5
- **Anchors**: 1 = horizontal scroll or broken centering; 3 = usable but awkward spacing at 320px; 5 = centered container `max-w-[430px]`, padding `px-4 py-8`, no overflow at ≥ 320px
- **Pass Threshold**: >= 4
- **Evidence**: Source of `(auth)/layout.tsx` and page layouts shows responsive container classes; build passes

### AC-13: Build/lint/typecheck success
- **Type**: `rule`
- **Given**: Repository state after changes
- **When**: `npm run build && npm run typecheck && npm run lint` runs
- **Then**: All three commands exit 0
- **Pass Condition**: Exit code 0 from combined execution
- **Evidence**: Terminal capture of commands with exit 0

### AC-14: No sensitive server data in client bundles; Firestore rules secure
- **Type**: `rule`
- **Given**: Built client output and Firestore rules file
- **When**: Searching for Admin private key fragments or `FIREBASE_ADMIN_*` env references in client chunks; reviewing rules
- **Then**: No Admin secret present; admin SDK import is server-only gated; rules forbid cross-user read/write except allowed explicit paths
- **Pass Condition**: `admin.ts` contains `import "server-only"`; rules_version = '2' and users rule restrict to `userId == uid()` or admin; grep for private key in .next/static finds nothing
- **Evidence**: Source of lib/firebase/admin.ts first line; firestore.rules `/users/{userId}` section
