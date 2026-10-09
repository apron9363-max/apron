# Apron Platform - Implementation Plan

## Phase A: Project Scaffold & Structure

### Task A-1: Root config files (package.json, tsconfig, next, tailwind, postcss, eslint, gitignore, env)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Write `package.json` with Next.js 14, React 18, TypeScript, Tailwind CSS, PostCSS, ESLint, firebase, firebase-admin, zod, react-hook-form, @hookform/resolvers, lucide-react, clsx, tailwind-merge, recharts, bcryptjs, uuid deps. Scripts: dev, build, start, lint, typecheck, seed:plans.
  - Write `tsconfig.json` with `strict: true`, App Router paths (`@/*` → `./src/*`).
  - Write `next.config.mjs` (App Router default, image domains if needed).
  - Write `tailwind.config.ts` with custom theme colors (`bg-base` gradient tokens, gold `#FFC400`, pink `#FF3CBE`, glass utilities, container max-w 430).
  - Write `postcss.config.mjs`, `.eslintrc.json`, `.gitignore`, `.env.local.example`.
- **Acceptance Criteria Addressed**: AC-1, AC-8
- **Test Requirements**:
  - `rule` TA-1.1: `npm install` succeeds (or at minimum package.json syntax validates via `node -e "JSON.parse(require('fs').readFileSync('package.json'))"`).
  - `rule` TA-1.2: All 7 root config files exist and tsconfig has `strict: true`.
- **Notes**: Scaffold only — install deps and run typecheck only after Task A-3 is done.

### Task A-2: Directory tree + entry files (src layout, app/, public/, scripts/, firebase rules)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: A-1
- **Description**:
  - Create `src/app/`, `src/components/`, `src/components/ui/`, `src/lib/`, `src/types/`, `src/firebase/`, `src/server/`, `src/server/actions/`, `src/server/api/`, `src/hooks/`, `public/`, `scripts/`.
  - Place `firestore.rules` at repo root.
  - Place `storage.rules` stub if desired.
  - Create `src/app/favicon.ico`, `src/app/globals.css`, basic `src/app/layout.tsx`, `src/app/page.tsx` (placeholder redirects to dashboard or landing).
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `rule` TA-2.1: `find src -type d | sort` matches: `app, components, components/ui, lib, types, firebase, server, server/actions, server/api, hooks`.
  - `rule` TA-2.2: `firestore.rules` exists at root (content filled in Task B-2).

### Task A-3: Install dependencies and baseline typecheck
- **Status**: `pending`
- **Priority**: high
- **Depends On**: A-2
- **Description**:
  - Run `npm install` (or `pnpm`/`yarn`; use npm by default).
  - Run `npx tsc --noEmit` and resolve scaffold-level errors.
- **Acceptance Criteria Addressed**: AC-1, AC-8
- **Test Requirements**:
  - `rule` TA-3.1: `npm install` exit 0.
  - `rule` TA-3.2: `npx tsc --noEmit` exit 0.

## Phase B: Firebase, Types, Data Access Layer

### Task B-1: Types, Zod schemas, Firestore path constants
- **Status**: `pending`
- **Priority**: high
- **Depends On**: A-3
- **Description**:
  - `src/types/index.ts`: `UserDoc`, `TaskDoc`, `SubmissionDoc`, `WithdrawalDoc`, `PlanDoc`, `EarningDoc` enums/exports, plus `Role`, `WithdrawalStatus`, `TaskType`, `EarningSource`.
  - `src/lib/validations/*.ts` (or `src/lib/zod.ts`) with Zod schemas mirroring each type + form schemas (register, login, withdrawal, task create, plan edit, etc.).
  - `src/lib/constants.ts`: `COLLECTIONS` object (users, tasks, submissions, withdrawals, plans, earnings), `DEFAULT_REFERRAL_BONUS`, `WITHDRAWAL_FEE_PCT`, `MIN_WITHDRAWAL`, `PLAN_IDS`.
- **Acceptance Criteria Addressed**: AC-2, AC-8
- **Test Requirements**:
  - `rule` TB-1.1: All 6 doc interfaces + 4 enums exported from types.
  - `rule` TB-1.2: Zod schemas parse valid fixtures and reject invalid fields (verify with small test file or inline `z.parse` calls that throw on type mismatch).

### Task B-2: Firebase SDK (client), Admin SDK (server), typed CRUD helpers, security rules
- **Status**: `pending`
- **Priority**: high
- **Depends On**: B-1
- **Description**:
  - `src/firebase/client.ts`: initializeApp using `NEXT_PUBLIC_FIREBASE_*` env; export `auth`, `db` (read-only getter).
  - `src/firebase/admin.ts`: initializeApp via cert using `FIREBASE_ADMIN_PROJECT_ID`/`FIREBASE_ADMIN_CLIENT_EMAIL`/`FIREBASE_ADMIN_PRIVATE_KEY` (or service-account JSON path); export `adminAuth`, `adminDb`.
  - `src/lib/firestore.ts`: typed helpers: `getUser(uid)`, `updateUser(uid, patch)`, `createUserDoc(uid, data)`, `listTasks()`, `createTask(...)`, `getPlan(id)`, `listPlans()`, `createSubmission(...)`, `createWithdrawal(...)`, `listWithdrawalsByUser(...)`, `listWithdrawalsPending(...)`, `updateWithdrawalStatus(...)`, `createEarning(...)`, `listEarningsByUser(...)`, `getUserByReferralCode(code)`, `listUsers(filter?)`. All helpers use `adminDb` for server-only usage.
  - `firestore.rules`:
    - `users/{uid}`: read if `request.auth.uid == uid` or `request.auth.token.role == 'admin'`; write if `request.auth.uid == uid && onlySelfFields()` or admin.
    - `tasks`: public read; write admin only.
    - `submissions`: read/write owner + admin.
    - `withdrawals`: read owner + admin; write create by owner, status update admin only.
    - `plans`: public read; write admin only.
    - `earnings`: read owner + admin; create admin/server only.
  - `.env.example`: all NEXT_PUBLIC Firebase vars + admin service-account vars + platform settings.
- **Acceptance Criteria Addressed**: AC-2, AC-8
- **Test Requirements**:
  - `rule` TB-2.1: `firebase.rules` includes at least one owner check (`request.auth.uid == resource.data.userId` or similar) and one admin check.
  - `rule` TB-2.2: `src/lib/firestore.ts` exports at least 15 typed functions covering all 6 collections.

### Task B-3: Plans seed script
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: B-2
- **Description**:
  - `scripts/seed-plans.ts`: imports admin SDK, upserts 3 plans:
    - Starter: id `starter`, price 0, hourlyRate 0.10, features [...], active true
    - Pro: id `pro`, price 3500, hourlyRate 0.42, features [...], active true
    - Elite: id `elite`, price 8000, hourlyRate 1.25, features [...], active true
  - Add to package.json script `"seed:plans": "tsx scripts/seed-plans.ts"` (include tsx devDep or ts-node).
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `rule` TB-3.1: `node -e "import('./scripts/seed-plans.ts').catch(()=>{})"` (or tsx) parses without syntax errors; script has upserts for 3 plans.

## Phase C: Design System & Layout Shell

### Task C-1: Global styles, logo icon, base UI components (Button, Card, Input, Modal, StatCard)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: A-3, B-1
- **Description**:
  - `app/globals.css`: Tailwind directives + `:root` CSS vars for colors; `html, body` gradient bg `#2E0C4E → #100422`; `.glass` utility (`bg-white/10`, `border border-white/20`, `backdrop-blur-md`, `rounded-2xl`).
  - Font: import Inter via `next/font/google` in layout.
  - `src/components/icons/ApronIcon.tsx`: SVG of a simple gold apron (U-shape with top band and waist tie).
  - `src/components/ui/Button.tsx`: variants (primary, secondary, outline, ghost, danger), sizes (sm, md, lg), loading state, className prop merged via `cn()`.
  - `src/components/ui/Card.tsx`: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` — glass by default.
  - `src/components/ui/Input.tsx`: label + input (shadcn-style but minimal glass look), error state.
  - `src/components/ui/Select.tsx`: basic select wrapper (for bank accounts, dropdowns).
  - `src/components/ui/Modal.tsx`: overlay + glass modal with open/close state + title.
  - `src/components/ui/StatCard.tsx`: label + value + optional icon/delta; used in dashboard.
  - `src/lib/utils.ts`: export `cn` (clsx + tailwind-merge).
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `rule` TC-1.1: `ls src/components/ui` lists Button, Card, Input, Select, Modal, StatCard files.
  - `rule` TC-1.2: globals.css defines `.glass` class; ApronIcon SVG renders 3 or more `<path>`/`<polygon>` elements.

### Task C-2: App shell (root layout, Shell container, SideMenu, BottomNav, Providers)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: C-1
- **Description**:
  - `src/app/layout.tsx`: Inter font, `metadata`, wraps children in `<html class="dark"><body>` + theme-friendly container; imports `globals.css`.
  - `src/components/layout/AppShell.tsx`: renders centered `max-w-[430px] mx-auto min-h-screen` flex column; slot for `children`; conditionally mounts `SideMenu` (with open/close state via header toggle) and `BottomNav` on auth pages? — only mount shell inside `(app)` group.
  - `src/components/layout/SideMenu.tsx`: glass drawer; items: Dashboard, Contest, History, Account Settings, Plans, Loans, Skill Academy, Social Monetization, Logout (with icons).
  - `src/components/layout/BottomNav.tsx`: fixed bottom glass bar; 4 items (Home, Tasks, History, Wallet) with icons and active route highlight.
  - `src/components/layout/Header.tsx`: logo + menu toggle + avatar placeholder.
  - Route groups: `src/app/(auth)/layout.tsx` (no shell), `src/app/(app)/layout.tsx` (wraps with AppShell, BottomNav, SideMenu, Header), `src/app/admin/layout.tsx` (admin shell — wider max-w 2xl, no bottom nav).
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `rule` TC-2.1: `(app)/layout.tsx` imports and renders `AppShell`, `Header`, `SideMenu`, `BottomNav`.
  - `rule` TC-2.2: `admin/layout.tsx` has separate admin-only styling without BottomNav.

## Phase D: Auth (Routes + Middleware + Server Actions)

### Task D-1: Middleware, session cookies, role/banned gating
- **Status**: `pending`
- **Priority**: high
- **Depends On**: B-2
- **Description**:
  - `src/middleware.ts`:
    - Public paths: `/`, `/auth/*`, `/_next/*`, `/favicon.ico`, `/api/public/*`.
    - If no session cookie → redirect to `/auth/login` for app routes.
    - For `/admin/*`: verify session cookie → decode → read user doc role; reject non-admin.
    - For all protected: if `user.status === 'banned'` → redirect to `/auth/blocked`.
  - `src/lib/server/session.ts`: helpers `createSessionCookie(idToken)`, `verifySessionCookie(cookie)`, `clearSessionCookie()`; use Firebase Admin `createSessionCookie` with HttpOnly/SameSite=Lax/Secure(in prod).
  - `.env.example`: add `SESSION_DURATION_SECONDS` default 604800.
- **Acceptance Criteria Addressed**: AC-4, NFR-4
- **Test Requirements**:
  - `rule` TD-1.1: middleware matches `/admin` routes and checks admin role.
  - `rule` TD-1.2: `createSessionCookie` sets cookie with `httpOnly: true, sameSite: 'lax'`.

### Task D-2: Auth routes — register, verify OTP email, login (email + Google), blocked, logout
- **Status**: `pending`
- **Priority**: high
- **Depends On**: D-1, C-1, B-2
- **Description**:
  - `app/(auth)/register/page.tsx`: RHF + Zod form (name, email, phone, referralCode?). On submit → server action `registerUserAction`: `createUserWithEmailAndPassword` on server via admin SDK? — or: client `createUserWithEmailAndPassword` → `sendEmailVerification` → route to `/auth/verify` with OTP-style code UI (wait for email link verified, poll `reload currentUser`).
  - Action `createUserDocAndApplyReferralAction`: writes Firestore `users/{uid}` doc with generated `referralCode` (8 chars), applies `referredBy` if valid code given, creates referral bonus earning for referrer (one-time, paid once referee becomes verified).
  - `app/(auth)/verify/page.tsx`: "Check your email for the verification link" + resend button + animated check on verified.
  - `app/(auth)/login/page.tsx`: email/password + Google sign-in button. Submit → `loginAction` → `createSessionCookie` → redirect `/dashboard`.
  - Google: `signInWithPopup` on client, then POST to `/api/auth/session` to exchange idToken for cookie.
  - `app/(auth)/blocked/page.tsx`: "Your account is banned" screen.
  - `app/api/auth/session/route.ts`: `POST` receives `idToken` → `createSessionCookie` → `Set-Cookie`.
  - `app/api/auth/logout/route.ts`: `POST` clears cookie.
  - `src/server/actions/authActions.ts`: zod-validated server actions for register, login (email pass), applyReferral.
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `rule` TD-2.1: All 5 auth page files exist (register, verify, login, blocked, logout redirect).
  - `rule` TD-2.2: Register action validates required fields via Zod and rejects missing `name`.

## Phase E: End-User Core Features (Dashboard, Earning, Plans, Referrals)

### Task E-1: Dashboard page + quick links
- **Status**: `pending`
- **Priority**: high
- **Depends On**: D-2, C-2, B-2
- **Description**:
  - `app/(app)/dashboard/page.tsx`: fetches user doc via server action `getCurrentUserDataAction`; renders Header, StatCards (Total Balance, Hourly Rate "x APN/hr"), Balance Overview tabs/cards (Withdrawals, Task Balance, Indirect).
  - Referral card: referral URL `{siteUrl}/auth/register?ref={code}` + copy button (navigator.clipboard with fallback).
  - Quick Links glass grid: Quiz, Tasks, Contest, Loans — route to respective pages.
  - Recent earnings mini-feed (last 5 items from `listEarningsByUser`).
  - `src/server/actions/userActions.ts`: `getCurrentUserDataAction`, `updateUserBankDetailsAction`, etc.
- **Acceptance Criteria Addressed**: AC-5, AC-6 (wallet part separated)
- **Test Requirements**:
  - `rule` TE-1.1: Dashboard page uses server actions — no direct `db.collection` client calls.
  - `rule` TE-1.2: Referral card renders a `<button>` with copy text and stores referral URL in `navigator.clipboard` on click.

### Task E-2: Plans page + plan upgrade action
- **Status**: `pending`
- **Priority**: high
- **Depends On**: E-1
- **Description**:
  - `app/(app)/plans/page.tsx`: fetches active plans; renders 3 glass PlanCards comparing price, hourly rate, features.
  - Current plan badge + "Upgrade" action: server action `upgradeUserPlanAction(planId)` marks user `plan`, `planExpiresAt = now + 30 days`, resets `apnRate` from plan. For v1 we assume payment external; action logs an "admin-only guard" so only admin or webhook can upgrade — or simply allow demo-mode upgrade on click (clearly marked). Optionally gate behind `isAdmin` or environment.
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TE-2.1: Plans page lists 3 plans and uses `getPlansAction` server action.
  - `rule` TE-2.2: Upgrade action sets `planExpiresAt` with a 30-day delta and updates `apnRate`.

### Task E-3: Tasks + Quizzes pages + earning creation
- **Status**: `pending`
- **Priority**: high
- **Depends On**: E-1
- **Description**:
  - `app/(app)/tasks/page.tsx`: list of active tasks (title, type, reward). Each task → "Start" → submit via `completeTaskAction(taskId)` server action which:
    - checks task exists + active
    - ensures user has not already submitted (unique index on submissions userId+taskId or query guard)
    - creates submission
    - creates earning row (source task)
    - increments `taskBalance` and `balance` on user doc (transaction)
  - `app/(app)/quiz/page.tsx`: similar, tasks of type=quiz rendered as Q/A form; on correct submission → same server flow.
  - `app/(app)/earnings/page.tsx` (aliased under History): full feed with virtualized or paginated list.
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TE-3.1: `completeTaskAction` uses Firestore transaction/atomic update and rejects duplicate.
  - `rule` TE-3.2: Completing a task creates one `submissions` doc and one `earnings` doc.

### Task E-4: Referral system wiring (bonus paid on verified referee)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: D-2, B-2
- **Description**:
  - `markUserVerifiedAndApplyReferralBonusAction`: called after email verification; queries `referredBy`, pays referrer `DEFAULT_REFERRAL_BONUS` APN (once only, guard via `referralPaidOut: boolean` on referee user doc or separate tracking). Creates earning row with source=referral.
  - `app/(app)/referrals/page.tsx` (optional — if absent, show counts on dashboard): list of referred users + total bonuses earned.
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TE-4.1: Action is idempotent (second call returns early without double-paying).

## Phase F: Wallet & Withdrawals

### Task F-1: Wallet overview + bank details form
- **Status**: `pending`
- **Priority**: high
- **Depends On**: E-1
- **Description**:
  - `app/(app)/wallet/page.tsx`: Balance cards, saved bank details form, action to save via `updateUserBankDetailsAction`.
  - Bank details schema: `bankName, accountNumber, accountName`.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TF-1.1: Wallet page calls server action to fetch user bank details; no client read.

### Task F-2: Withdrawal request flow (form → create pending → success receipt once paid)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: F-1
- **Description**:
  - `app/(app)/wallet/withdraw/page.tsx`: RHF form `amount` + bank account select (from saved bankDetails). Validations: `amount >= MIN_WITHDRAWAL`, `amount <= balance`, integer. Live compute: `fee = amount * WITHDRAWAL_FEE_PCT`, `net = amount - fee`. Glass summary panel: "You will receive: ₦net".
  - Submit → server action `requestWithdrawalAction(amount, bankSnapshot)`:
    - atomic: verify user balance sufficient
    - deduct `amount` from `balance` and `taskBalance` proportionally (deduct from taskBalance first, then balance remainder)
    - create `withdrawals/{id}` with `status: 'pending'`
  - `app/(app)/wallet/history/page.tsx`: list of user's withdrawals, status chips, transactionId if paid, receipt view link.
  - `app/(app)/wallet/receipt/[wdId]/page.tsx`: receipt screen (glass card with transaction ID, amount, net, date).
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TF-2.1: `requestWithdrawalAction` runs inside Firestore transaction and rejects insufficient balance.
  - `rule` TF-2.2: After request, balance decreases by `amount`; a withdrawal doc is created with `fee` + `netAmount` correct.

## Phase G: Admin Panel

### Task G-1: Admin layout + overview dashboard (charts)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: D-2, B-2, C-1
- **Description**:
  - `app/admin/layout.tsx`: admin role guard via server component fetch; sidenav with links: Overview, Users, Withdrawals, Plans, Tasks, Settings.
  - `app/admin/page.tsx` (Overview): StatCards: Total Users, Total Withdrawals Today, Revenue (sum of plan payments, demo-mode), Pending Withdrawals Count. Recharts line chart (earnings per day last 14d, demo aggregation from earnings collection where `createdAt >= now - 14d`).
  - Server actions: `adminGetOverviewAction`.
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TG-1.1: Admin layout checks admin role and redirects non-admins.
  - `rule` TG-1.2: Overview renders >= 4 StatCards and one `<ResponsiveContainer>` chart.

### Task G-2: Admin user management (list/search/edit/ban/role)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: G-1
- **Description**:
  - `app/admin/users/page.tsx`: search bar + paginated list of users (name, email, plan, balance, status, role).
  - Per-row actions: Edit balance (Modal with input + confirm), Ban toggle, Change role (admin↔user).
  - `app/admin/users/[uid]/page.tsx`: user detail view.
  - Server actions: `adminListUsersAction(query, limit, cursor)`, `adminUpdateUserBalanceAction(uid, delta)`, `adminSetUserRoleAction(uid, role)`, `adminSetUserStatusAction(uid, status)`.
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TG-2.1: Ban action writes `users.status = 'banned'` (guarded admin-only).
  - `rule` TG-2.2: Balance edit action uses transaction to apply signed delta.

### Task G-3: Admin withdrawal queue (approve/reject)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: G-1
- **Description**:
  - `app/admin/withdrawals/page.tsx`: tabs (Pending, Paid, Rejected, All). Each row shows user, amount, fee, net, bank summary, date.
  - Approve → Modal confirm → `adminApproveWithdrawalAction(wdId)`: update status `paid`, set `processedAt = now`, `transactionId` (uuid prefixed `APN-`).
  - Reject → Modal with textarea reason → `adminRejectWithdrawalAction(wdId, reason)`: status `rejected`; refund amount back to balances (reverse of withdrawal).
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TG-3.1: Approve action sets `transactionId` matching `/^APN-[\w-]+$/`.
  - `rule` TG-3.2: Reject action refunds the withdrawal amount back to user balance (transaction).

### Task G-4: Admin plans editor, tasks/quizzes editor, referral settings
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: G-1
- **Description**:
  - `app/admin/plans/page.tsx`: inline edit rows for each plan (price, hourlyRate, features array, active toggle) → `adminUpdatePlanAction`.
  - `app/admin/tasks/page.tsx`: list tasks + "Create Task" modal form (title, type, reward, active) → `adminUpsertTaskAction`.
  - `app/admin/settings/page.tsx`: one setting row for "Referral Bonus (APN)" → `adminUpdateReferralBonusAction` (we can store in a `settings/{singleton}` doc or a constant file; implement both: constant with runtime override via settings doc).
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TG-4.1: Plans editor submits via server action and guards admin.
  - `rule` TG-4.2: Task create writes a task doc with all required fields (title, type, reward, active, createdAt).

## Phase H: Quality Gate

### Task H-1: Typecheck + lint + codebase security grep
- **Status**: `pending`
- **Priority**: high
- **Depends On**: G-4, F-2, E-4
- **Description**:
  - Run `npx tsc --noEmit`, `npm run lint`, fix remaining issues.
  - Grep for `getFirestore()`, `collection(`, `db.collection` in `src/app/(app)**` client components (should be zero server-writes via raw firestore).
  - Audit security rules for: users owner read, tasks public read, withdrawals owner read, admin controls on all critical writes.
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TH-1.1: `npx tsc --noEmit` exit 0.
  - `rule` TH-1.2: grep of client component files for `adminDb`, `collection(` used for writes returns 0 lines.
- **Notes**: This is the final task before Review.
