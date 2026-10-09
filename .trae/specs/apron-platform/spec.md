# Apron Platform - Product Requirements Document

## Overview
- **Summary**: A production-ready rewards & tasks earning web platform ("Apron") where users complete tasks/quizzes to earn APN coins, with paid tiered plans, referrals, withdrawals, and a full admin panel.
- **Purpose**: Provide a legitimate task-earning ecosystem with transparent coin accrual, a single-level referral bonus, tiered subscription plans, and admin governance.
- **Target Users**:
  - End users (earners) who complete tasks, subscribe to plans, and withdraw funds
  - Platform admins who manage users, withdrawals, tasks, plans, and referral settings

## Goals
- Deliver a production-grade Next.js 14 + Firebase app with strict TypeScript, Zod validation, and security-conscious architecture.
- Implement full authentication (email/password + Google, email verification) with protected routes via middleware.
- Build a mobile-first UI with a centered max-w-[430px] layout, glassmorphism cards, deep-purple/gold/pink theme, bottom nav, and side menu.
- Deliver earning engine (hourly APN rate per plan), tasks/quizzes, referral system, wallet & withdrawals, and admin panel.
- All Firestore access happens via server actions / API routes — never directly from client components.

## Non-Goals
- Multi-level / matrix MLM payouts (only single-level referral bonus).
- Native mobile app (PWA-only via mobile-first web layout).
- Real-time chat, push notifications via FCM (out of v1 scope).
- Custom payment-gateway integration beyond marking withdrawals "paid" in admin.

## Background & Context
- Tech stack is constrained to Next.js 14+ (App Router), TypeScript, Tailwind CSS, Firebase Auth + Firestore + Security Rules.
- UI must look like a premium mobile app on every screen size (centered container, bottom nav, side drawer).
- Firestore collections and security rules must be authored and placed in-tree (with a seed script for plans).

## Functional Requirements

### Authentication & Authorization
- **FR-1**: User registration captures `name`, `email`, `phone`, optional `referralCode`.
- **FR-2**: Email verification flow (OTP-style code sent via Firebase email link + code UI).
- **FR-3**: Login via email/password and Google Sign-In.
- **FR-4**: Next.js middleware protects routes; unauthenticated users redirect to `/auth/login`; non-admins cannot reach `/admin/*`.
- **FR-5**: User doc stores `role` (`user` | `admin`) and `status` (`active` | `banned`); banned users cannot use protected routes.

### User App (End Users)
- **FR-6**: Dashboard shows profile summary, hourly coin rate (`apnRate`), Total Balance, Balance Overview (Withdrawals, Task Balance, Indirect), referral link with Copy, and Quick Links (Quiz, Tasks, Contest, Loans).
- **FR-7**: Earning system: tasks/quizzes complete → APN coins credited; hourly accrual rate depends on active plan; earning history feed with timestamps.
- **FR-8**: Referrals: unique referral code/link per user; referrer earns a configurable single-level bonus when referee signs up and is verified.
- **FR-9**: Plans: Free Starter, paid Pro (₦3,500/mo), Elite (₦8,000/mo); plan + expiry stored on user doc; different `hourlyRate`.
- **FR-10**: Wallet & Withdrawals: request withdrawal (amount, saved bank account, fee, "you will receive" net), history, success/receipt screen with transaction ID.
- **FR-11**: Side menu: Dashboard, Contest, History, Account Settings, Plans, Loans, Skill Academy, Social Monetization, Logout.
- **FR-12**: Bottom nav (mobile): Home, Tasks, History, Wallet.

### Admin Panel (`/admin`)
- **FR-13**: Overview dashboard: total users, total withdrawals today, revenue stats (cards + simple charts).
- **FR-14**: User management: list/search, view details, edit balances, ban/unban, change role.
- **FR-15**: Withdrawal requests: pending queue → Approve (mark paid + generate transactionId) or Reject with reason.
- **FR-16**: Plans management: edit prices, hourly rates, features, active state.
- **FR-17**: Task/Quiz management: create/edit tasks & quizzes + rewards.
- **FR-18**: Referral settings: edit referral bonus amount.

### Data Layer
- **FR-19**: Firestore collections: `users`, `tasks`, `submissions`, `withdrawals`, `plans`, `earnings` — typed helper functions for reads/writes.
- **FR-20**: All Firestore reads/writes go through server actions or `/api/*` routes (no client-side direct Firestore).
- **FR-21**: Zod validation on every form (react-hook-form + zod).
- **FR-22**: Firebase security rules file authored (firestore.rules) and seed script for `plans` collection.
- **FR-23**: `.env.local` + `.env.example` with Firebase variables and platform settings.

## Non-Functional Requirements
- **NFR-1**: TypeScript `strict: true`; no implicit any; all data access typed.
- **NFR-2**: Mobile-first responsive layout; desktop viewport centers content in max-w-[430px] card-stack; theme is dark-only.
- **NFR-3**: Reusable components: `Button`, `Card`, `Input`, `Modal`, `StatCard`; composition over deep nesting.
- **NFR-4**: Security: HttpOnly/SameSite cookies where applicable; env variables never leak to client; security rules enforce per-user data isolation and admin-only writes for admin collections/fields.
- **NFR-5**: Idempotent server actions with Zod on input and defensive null checks.
- **NFR-6**: Clean git-ready repo: `.gitignore` excludes `.env.local`, `node_modules`, `.next`, etc.

## Constraints
- **Technical**: Next.js 14+ App Router, TypeScript, Tailwind CSS, Firebase (Auth + Firestore + Security Rules). No other backend.
- **Business**: Single-level referral only; Nigerian Naira (₦) pricing; bank-account withdrawal model.
- **Dependencies**: Zod, react-hook-form, @hookform/resolvers, firebase, firebase-admin on server, lucide-react icons, clsx + tailwind-merge for classnames; recharts for admin charts.

## Assumptions
- Firebase project is provisioned by user (we provide sample env vars and a seed script; actual firebase deploy is manual).
- Email verification uses Firebase default template + in-app OTP-style code screen.
- Plan payments are recorded as "active until" date; actual PSP integration is out of scope (admin marks plan upgrades or a webhook stub is acceptable).
- Withdrawal "approval" sets status to `paid` and `transactionId`; actual bank payout is external.

## Acceptance Criteria

### AC-1: Project structure is production-ready skeleton
- **Type**: `rule`
- **Given**: Empty repo
- **When**: Project scaffolding is complete
- **Then**: `package.json` with correct deps exists; `next.config`, `tsconfig`, `tailwind.config`, `postcss.config`, `eslintrc` exist; directory tree (`app/`, `components/`, `lib/`, `types/`, `firebase/`, `server/`, `public/`) is created; `.env.example`, `firestore.rules`, seed script exist.
- **Pass Condition**: `ls -la` and `cat package.json` show required files; `npx tsc --noEmit` runs without type errors on scaffold.
- **Evidence**: File list + tsconfig strict flag + package.json scripts.

### AC-2: Firebase + typed data access layer is in place
- **Type**: `rule`
- **Given**: Scaffolded project
- **When**: Firebase config is written
- **Then**: `firebase/client.ts` (client SDK singleton), `firebase/admin.ts` (server admin SDK singleton), `lib/firestore.ts` with typed CRUD helpers for all 6 collections, ZOD schemas for each entity, `.env.example` with `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_*_ADMIN_*` vars, `firestore.rules` with owner-only user reads and admin-only critical writes, `scripts/seed-plans.ts` exist.
- **Pass Condition**: Files exist and `firestore.rules` parses; seed script imports admin and creates 3 plans.
- **Evidence**: File paths + rules content.

### AC-3: Design system + layout shell is implemented
- **Type**: `rule`
- **Given**: Scaffold
- **When**: UI base layer is written
- **Then**: Global CSS with deep purple → black gradient body, gold (#FFC400) accent, pink (#FF3CBE) secondary, glassmorphic cards; Inter/Poppins font; reusable `Button`, `Card`, `Input`, `Modal`, `StatCard` components exist and are typed; root layout (`app/layout.tsx`) applies theme and fonts; layout renders a `Shell` component with centered `max-w-[430px]` container, bottom nav (4 items), side menu (9 items + Logout), and an `ApronIcon` SVG logo (gold apron).
- **Pass Condition**: Components render without TS errors; running dev server shows themed page with bottom nav visible on mobile viewport and side drawer openable.
- **Evidence**: Component file paths + screenshot of themed skeleton page.

### AC-4: Auth flow + middleware route protection works
- **Type**: `rule`
- **Given**: Firebase-enabled project
- **When**: Auth pages and middleware are wired
- **Then**: `/auth/register` (form: name, email, phone, referralCode) → OTP email verify screen → `/auth/login` (email/password + Google button); middleware redirects unauth to login, bans cannot access app routes, non-admins cannot access `/admin/*`; session cookies are set HttpOnly/SameSite=Lax.
- **Pass Condition**: Manual test: register → verify → login → dashboard shows; logout returns to login; banned account sees blocked screen.
- **Evidence**: Middleware source + auth page files + session action code.

### AC-5: Dashboard, earning, plans, referrals UI works end-to-end
- **Type**: `rubric`
- **Dimension**: Core end-user earning UX completeness
- **Scale**: 1-5
- **Anchors**: 1 = blank placeholders; 3 = sections visible but no data flow; 5 = fully wired dashboard, plan upgrade UI, tasks/quiz list + completion writes earnings, referral copy button works, earning history feed shows timestamps.
- **Pass Threshold**: >= 4
- **Evidence**: Page files under `app/(app)/` and server actions for earning/referral.

### AC-6: Wallet + withdrawal flow complete
- **Type**: `rule`
- **Given**: Logged-in user with balance > 0
- **When**: User initiates withdrawal
- **Then**: `/wallet/withdraw` form (amount, bank details select/save, fee line, net amount display) → submit creates `withdrawals/{id}` with status `pending` → history shows it; success/receipt screen shows `transactionId` once paid by admin.
- **Pass Condition**: Submission writes doc with userId + correct fields; history page reflects the record.
- **Evidence**: Withdraw page + server action + history page.

### AC-7: Admin panel features implemented and role-protected
- **Type**: `rubric`
- **Dimension**: Admin feature completeness & governance
- **Scale**: 1-5
- **Anchors**: 1 = `/admin` 404 or public; 3 = overview + user list only; 5 = overview cards/charts, user CRUD+balance+ban, withdrawal approve/reject with reason, plans editor, tasks/quizzes editor, referral bonus setting.
- **Pass Threshold**: >= 4
- **Evidence**: `/app/admin/**` page tree + admin server actions.

### AC-8: Strict quality gates pass
- **Type**: `rule`
- **Given**: Final code
- **When**: CI-style checks run
- **Then**: `tsc --noEmit` passes (strict mode); every form file imports and uses Zod via `useForm<..., zodResolver>`; zero client-side `getFirestore().collection()` calls; security rules restrict admin writes and user-read isolation.
- **Pass Condition**: `npx tsc --noEmit` exit 0; grep for client firestore writes returns 0; rules contain `request.auth.uid == userId` owner checks and `role == 'admin'` admin checks.
- **Evidence**: CLI outputs + grep results + rules excerpt.

## Open Questions
- [ ] Confirm Google Sign-In client IDs will be provided by user (we leave env placeholders).
- [ ] Confirm withdrawal fee percentage (default 5%) and minimum withdrawal (default ₦1,000) — reasonable defaults accepted unless overridden.
- [ ] Confirm default referral bonus amount (default 50 APN).

---

# Phase 2: Authentication

## Phase Goal
Deliver a complete, end-to-end, production-grade authentication layer: visually themed (purple gradient, gold buttons, glassmorphism inputs), functionally secure (HttpOnly session cookies, route-gating middleware, Firestore rules enforcement), and operationally correct (Firestore user doc created on first sign-up with unique referral code + referrer credited when the referee verifies their email).

## Users
- First-time visitors who register with email/password
- Returning users who sign in with email/password or Google One-Tap
- Admins who sign in and need access to `/admin/*`
- Banned users who must be blocked at the network boundary

## Non-Goals for Phase 2
- Password reset flow (out of scope; reserved for a later phase)
- Phone OTP / SMS authentication (Firebase phone auth not provisioned)
- Custom email templates managed in-repo (use Firebase console default templates)
- Apple / Facebook / Github social providers

## Functional Requirements — Phase 2

### P2-FR-1: Register page UX + design
- Route at `/auth/register`. URL: `/auth/register?ref=<CODE>` pre-fills `referralCode` input from query param.
- Visual design renders inside AuthLayout: deep-purple gradient page background, centered glass container.
- Form fields (all required except referral): Full name, Email, Phone, Referral code (optional).
- Submit button: solid gold primary with loading state.
- Inputs: glassmorphic (translucent fill, 1px white/20 border, gold focus ring).
- Already have account? Link → `/auth/login`.
- Zod-schema validated on submit; server error messages surfaced inline.

### P2-FR-2: Register backend behavior
- Server action uses Firebase Admin SDK to create Auth user (createUser) deterministically, then writes Firestore `users/{uid}` document.
- User doc fields populated on creation: `name, email, phone, role="user", plan="starter", planExpiresAt=null, balance=0, taskBalance=0, apnRate=0.1, referralCode=<UNIQUE 8-char uppercase alnum>, referredBy=<UID of referrer or null>, referralPaidOut=false, bankDetails=null, status="active", emailVerified=false, createdAt, updatedAt`.
- Referral code uniqueness: `generateReferralCode` produces candidate; server action MUST verify candidate is not already in `users` collection via `getUserByReferralCode()` before writing. Loop until unused candidate is found (bounded guard to prevent infinite loop).
- If user-supplied `referralCode` is non-empty, server looks up referrer doc. If valid, `referredBy` is set to their UID. If invalid, server returns form error keyed to `referralCode` field so UI renders it inline (no silent fall-through).

### P2-FR-3: Email verification flow (OTP-style code screen)
- After register, user session is created (so they can visit `/auth/verify`), then router pushes `/auth/verify`.
- `/auth/verify` page shows: account email prominently, "click link in email" CTA, pulsing gold spinner while waiting, **Check status** ghost button + **Resend email** pink secondary button.
- When user clicks link sent by Firebase, email is marked verified in Firebase Auth. User stays on `/auth/verify`; they click "Check status" which calls `reloadAuthUser()` client-side then server `markEmailVerifiedAction({uid})`.
- On verified: server triggers `applyReferralBonusForVerifiedUser(uid)`. That function:
  - Guards double-payment via `if (user.referralPaidOut) return;` idempotency flag.
  - Looks up referrer doc by `referredBy`.
  - Reads platform `settings.referralBonus` (fallback `DEFAULT_REFERRAL_BONUS = 50`).
  - Runs Firestore TRANSACTION to atomically add `bonus` to referrer `balance` AND `taskBalance`, `updatedAt=now`.
  - Writes `earnings/{autoId}` earning doc `{userId=referrer.uid, source="referral", amount=bonus, referenceId=referee.uid, createdAt}`.
  - Marks referee `referralPaidOut=true`.
- Finally redirects to `/dashboard`.

### P2-FR-4: Login page UX + behavior
- Route `/auth/login`. Query param `?next=<PATH>` preserved so after successful auth router redirects to the intended protected page.
- Design: centered glass card on purple gradient. Fields: Email + Password, **Sign in** gold primary button.
- Divider "or" then Google branded button: `Continue with Google` (Chrome icon in Apron-gold).
- Field errors via zodResolver: wrong password → password field; invalid-email / user-not-found → email field.
- Correct credentials + `emailVerified=false` → route to `/auth/verify`.
- Correct credentials + `emailVerified=true` + banned (checked after session set) → route to `/auth/blocked`.
- Otherwise → route to `next` param (fallback `/dashboard`).

### P2-FR-5: Google Sign-In
- Google button on login page calls `signInWithGooglePopup()` client-side.
- If popup closes by user → ignore silently.
- If credentials returned → exchange for session cookie via `createSessionCookie` server action.
- Server runs `syncGoogleUserDocAction({uid, name, email})`:
  - If `users/{uid}` exists → return early (idempotent).
  - Otherwise create user doc as per P2-FR-2 with phone empty, `emailVerified=true`.
- Google emails are trusted verified, so `applyReferralBonusForVerifiedUser(uid)` runs immediately (note: no referrer for Google flow since referral code field is not on login page; behavior is correct: bonus only applies if referee manually enters a code).
- After sign-in, check session status: banned → `/auth/blocked`, else → dashboard.

### P2-FR-6: Route protection middleware
- Single `middleware.ts` at `src/middleware.ts` runs via `export const config.matcher` (catch-all except static assets / fonts / images).
- Behavior rules, evaluated in order:
  1. Any path in `PUBLIC_PATHS` set (`/`, `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/blocked`, `/favicon.ico`, `/api/auth/session`, `/api/auth/logout`) → `next()`.
  2. No `session` cookie → `307` redirect to `/auth/login?next=<ORIGINAL_PATH>`.
  3. Session cookie present → verify via Firebase Admin `verifySessionCookie(cookie, checkRevoked=true)`, then enrich with `users/{uid}` doc fields `role`, `status`.
  4. Session valid + `status="banned"` AND destination NOT `/auth/blocked` → redirect → `/auth/blocked`.
  5. Path starts with `/admin` + session valid + `role != "admin"` → redirect → `/dashboard`.
  6. Otherwise → `next()`.
- Cookie settings enforced: HttpOnly, SameSite=Lax, Secure in prod, path `/`, maxAge matches session duration.

### P2-FR-7: Firestore user doc & data integrity rules
- Firestore rules already present in `firestore.rules` for `users/{userId}`:
  - reads: signed-in user reads own doc or admin.
  - creates: self-create only when UID matches.
  - updates: self updates allowed EXCEPT for fields `[role, status, balance, taskBalance, plan, planExpiresAt, apnRate]` (admin only).
  - deletes: admin only.
- Phase 2 rules-level additions (if missing): write-protect `referralCode` and `referredBy` and `referralPaidOut` for non-admin self-updates; these only change via server action at doc-creation time or during verification-triggered bonus run.

## Non-Functional Requirements — Phase 2
- **P2-NFR-1**: No `firebase-admin` imports ever bundled into client chunks (enforced by `"server-only"` in admin module; build will fail if client code reaches it).
- **P2-NFR-2**: Session cookie `httpOnly=true`; NEVER readable by `document.cookie` on client.
- **P2-NFR-3**: All server actions use Zod schemas for inputs; never trust spread `any` payloads.
- **P2-NFR-4**: Referral bonus path uses Firestore transaction for atomic referrer balance+taskBalance increment; never multiple `.update()` calls.
- **P2-NFR-5**: Every page that uses `useSearchParams` must export `dynamic = "force-dynamic"` and wrap its inner component in `<Suspense fallback={null}>` (prevents Next.js prerender failures).
- **P2-NFR-6**: Strict TypeScript typecheck (`npm run typecheck`) must pass 0 errors.
- **P2-NFR-7**: Build (`npm run build`) passes 0 errors + 0 warnings.
- **P2-NFR-8**: Lint (`npm run lint`) must pass 0 errors / 0 warnings.
- **P2-NFR-9**: Accessibility — gold `#FFC400` on dark purple `#2E0C4E` contrast ≥ 9:1 for primary action buttons; pink accent ≥ 6:1.

## Phase 2 Acceptance Criteria

### P2-AC-1: Register page visual + flow works
- **Type**: `rule`
- **Given**: Clean browser
- **When**: Navigate to `/auth/register?ref=ABC12345`, fill valid fields, submit
- **Then**: Referral code input pre-fills `ABC12345`; button shows loading; doc `users/<new-uid>` created with `referredBy=<owner of ABC12345>`; browser lands on `/auth/verify`.
- **Pass Condition**: Visual diff matches design (purple bg / glass card / gold button / glass inputs) AND Firestore doc + referral linkage verified.
- **Evidence Source**: Screenshot + Firestore emulator read / scripted read.

### P2-AC-2: Unique referral codes
- **Type**: `rule`
- **Given**: N=100 sequential registrations
- **When**: Register each user
- **Then**: Each `users/<uid>.referralCode` is 8 chars uppercase alphanumeric, globally unique across the set, matches `/^[A-Z0-9]{8}$/`.
- **Pass Condition**: `Set(referralCodes).size === 100` and every code validates regex.
- **Evidence Source**: Scripted bulk-registration loop result.

### P2-AC-3: Invalid referral code returns inline form error
- **Type**: `rule`
- **Given**: Register page
- **When**: Submit with `referralCode = "INVALID12"` (nonexistent)
- **Then**: Response `ok=false` with error key `referralCode`; UI renders message under input field.
- **Pass Condition**: Form error keyed to `referralCode` visible in server response and displayed in UI.
- **Evidence Source**: Network tab + screenshot of UI.

### P2-AC-4: Email verification triggers referral bonus atomically
- **Type**: `rule`
- **Given**: User `B` registered with referral code of user `A`; neither is verified yet
- **When**: `B` clicks verify link, then `markEmailVerifiedAction({uid: B.uid})` runs
- **Then**:
  1. `A.balance` increases by `settings.referralBonus || 50`
  2. `A.taskBalance` increases by same amount
  3. `earnings` doc created with `source="referral"`, `referenceId=B.uid`
  4. `B.referralPaidOut === true`
  5. Running step again is no-op (idempotent)
- **Pass Condition**: All 5 conditions met; values correct; no duplicate earnings doc on re-run.
- **Evidence Source**: Firestore reads + before/after balance diffs.

### P2-AC-5: Login page works for email/password and Google
- **Type**: `rule`
- **Given**: Verified user account; Google OAuth configured in Firebase
- **When (A)**: Submit valid email/password
- **Then (A)**: Session cookie set with HttpOnly/SameSite; redirects to `/dashboard`
- **When (B)**: Click Google button, complete consent
- **Then (B)**: Session cookie set; if new user → user doc created with referral code; if existing user → no duplicate doc

### P2-AC-6: Banned users hit blocked screen on every protected route
- **Type**: `rule`
- **Given**: User `status = banned` with valid session cookie
- **When**: Navigate to ANY route in `(app)/*` or `/admin/*`
- **Then**: Middleware 307 → `/auth/blocked`; middleware NEVER falls through to page handler
- **Pass Condition**: Even if user manually types URLs they always see `/auth/blocked`
- **Evidence Source**: curl with session cookie against 3 routes, check `Location:` header.

### P2-AC-7: Admin routes blocked for non-admins
- **Type**: `rule`
- **Given**: Regular user (role = `user`) signed in
- **When**: Navigate to `/admin`, `/admin/users`, `/admin/withdrawals`
- **Then**: 307 redirect → `/dashboard`

### P2-AC-8: Unauthenticated requests always bounce to login with next param
- **Type**: `rule`
- **Given**: No session cookie
- **When**: Request `/wallet/withdraw`
- **Then**: 307 → `/auth/login?next=/wallet/withdraw`

### P2-AC-9: Quality gates all green
- **Type**: `rule`
- **Given**: Final Phase 2 code
- **When**: `npm run build && npm run typecheck && npm run lint` run
- **Then**: All 3 exit 0 with 0 errors and 0 warnings
- **Evidence Source**: CLI exit codes + output

### P2-AC-10: Visual design tokens match spec
- **Type**: `rubric`
- **Dimension**: Theme fidelity on auth pages
- **Scale**: 0–5
- **Anchors**: 0 = no styling; 2 = inputs present but wrong visuals; 3 = purple gradient + glass present; 4 = all tokens correct (gradient body, glass card, gold primary button, inputs with translucent fill + gold focus ring, pink secondary where applicable, bottom dividers with proper spacing); 5 = 4 plus animations (fade-in entrance of card, hover transitions on buttons / inputs, loading spinner colors match gold).
- **Pass Threshold**: ≥ 4
- **Evidence Source**: `/auth/login`, `/auth/register`, `/auth/verify`, `/auth/blocked` screenshots in mobile (iPhone 14) + desktop viewport.

### P2-AC-11: Security posture
- **Type**: `rubric`
- **Dimension**: Auth security hardening completeness
- **Scale**: 0–5
- **Anchors**: 0 = credentials in localStorage / no cookie; 2 = cookie session but wrong SameSite or missing HttpOnly; 3 = HttpOnly/SameSite + basic middleware presence but no status/role gating or revoked check; 4 = 3 plus banned → `/auth/blocked`, admin → `/dashboard` for users, session verified via `verifySessionCookie(..., checkRevoked=true)`, user docs forbid balance/role mutation in rules; 5 = 4 plus referral bonus uses DB transaction, `server-only` guard prevents admin leaks to client, idempotency flags prevent double-bonus payouts.
- **Pass Threshold**: ≥ 4
- **Evidence Source**: `middleware.ts`, `session.ts`, `admin.ts`, firestore rules, bonus transaction code review.
