# Phase 2 — End-to-End Authentication System — Implementation Plan

## Task 1: Update Zod schemas — stronger password policy + confirm password
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Update `registerSchema` in `src/lib/validations/schemas.ts` to add `password` and `confirmPassword` string fields.
  - Add regex refinement: password length ≥ 8, at least one A–Z uppercase, at least one 0–9 digit.
  - Add `.refine` assertion that `password === confirmPassword`.
  - Update `loginSchema` password rule to require same length ≥ 8 / upper / digit (server-action level will also validate).
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `rule` TR-1.1: `registerSchema.parse({... password: 'short1', confirmPassword: 'short1'})` throws; regex for upper/digit fails on `'alllowercase8'`.
  - `rule` TR-1.2: `registerSchema.parse({... password: 'Password1', confirmPassword: 'Password1'})` succeeds; `password: 'Password1', confirmPassword: 'Password2'` throws refine error.
  - `rule` TR-1.3: `npm run typecheck` passes with no schema-related type errors.

## Task 2: Uniquify referral code generation with bounded collision-retry loop
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create a dedicated server-only helper `generateUniqueReferralCode(length, maxAttempts)` in `src/lib/firestore.ts` or `src/lib/utils.ts` (server side only).
  - Inside every signup path (`createUserDocOnSignupAction`, `syncGoogleUserDocAction`, `registerUserAction`) replace bare `generateReferralCode(8)` with a call to the new helper which: (a) generates candidate, (b) calls `getUserByReferralCode(candidate)`, (c) retries on non-null up to 5 attempts, (d) throws if no uniqueness after 5.
  - `generateReferralCode` in `utils.ts` stays as the low-level primitive.
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-2.1: All three signup code paths call the unique helper; no direct `generateReferralCode(8)` use remains in authActions.ts that is used as a user's permanent code.
  - `rubric` TR-2.2: Robustness under contention; scale 1-5; 1 = no retry; 3 = retries but no attempt cap; 5 = bounded retry loop with explicit exception after 5 consecutive collisions; threshold >= 4; evidence = source of the helper loop.
  - `rule` TR-2.3: `npm run typecheck` passes.

## Task 3: Fix Register page — user-chosen password + unified server action + ref prefill
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Overhaul `src/app/(auth)/register/page.tsx`:
    - Remove temp password generation.
    - Render `Password` and `Confirm password` Input fields (type=password, glassmorphic via `.input-base`).
    - Keep `?ref=` prefill using `useEffect` + `setValue("referralCode", refCode)`.
    - On submit: call a single, *combined* server action. Prefer `registerUserAction` (already in authActions) extended to accept a user-chosen password + confirmPassword. Modify `registerUserAction` to:
      - Create Firebase Auth user with provided password via Admin SDK.
      - Call unique referral code helper; insert user doc with referredBy linkage if referral code valid.
      - Send email verification via admin `generateEmailVerificationLink` or client-side `sendEmailVerificationLink` after session mint. For simplicity: server action returns ok, then client calls `signInWithEmailAndPassword` client-side to mint idToken → session, then redirect to verify. Alternatively perform the entire flow inside the server action and `redirect()`. Use the pattern that works end-to-end. Recommended: **server action `registerUserAction`** creates auth user + firestore doc, returns temp success token; client then signs-in via SDK with the chosen password → idToken → session cookie → redirect to verify. This avoids needing to expose idToken from server and keeps current session cookie flow intact.
    - Ensure loginSchema validation triggers field errors inline.
  - Update `registerUserAction` signature to accept `password` alongside name/email/phone/referralCode and call `auth.createUser({email, password, displayName: name, ...})`.
- **Acceptance Criteria Addressed**: AC-1, AC-2, FR-1, FR-2
- **Test Requirements**:
  - `rule` TR-3.1: Register page imports new password fields; removed `crypto.randomUUID().slice` temp password block.
  - `rule` TR-3.2: `registerSchema.parse` passes with valid inputs (Task 1's rules); form submission for invalid inputs triggers inline errors and zero server calls.
  - `rule` TR-3.3: After successful Register, logging out then logging in with the same password succeeds (proves password was correctly stored, not temp-unknown).
  - `rule` TR-3.4: `?ref=VALIDCODE` prefilled in input; resulting user doc `referredBy === referrer uid`.
  - `rule` TR-3.5: `npm run build` passes with no register-page type errors.

## Task 4: Redirect unverified-email sessions from (app) layout
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - In `src/app/(app)/layout.tsx`, after existing session checks, add branch:
    ```ts
    if (!session.emailVerified) redirect("/auth/verify");
    ```
  - Confirm `/auth/verify` route remains reachable for unverified sessions (it's in PUBLIC_PATHS or reachable without verification check in its own layout).
  - Ensure `admin/layout.tsx` role check remains intact (it is; verify no regression).
- **Acceptance Criteria Addressed**: AC-3, AC-7
- **Test Requirements**:
  - `rule` TR-4.1: `(app)/layout.tsx` source contains three redirect branches: no-session → login, banned → blocked, unverified → verify.
  - `rule` TR-4.2: `admin/layout.tsx` retains `role !== 'admin' → /dashboard` redirect.
  - `rule` TR-4.3: `npm run typecheck` passes.

## Task 5: Add forgot-password page + fix Login page forgot link
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - Create `src/app/(auth)/forgot-password/page.tsx` (Suspense-wrapped inner if using useSearchParams; otherwise plain). Contains glass card with Email input, "Send reset link" gold CTA, success/error message, and link back to `/auth/login`.
  - Uses client-side `sendPasswordResetEmail(auth, email)` from `firebase/auth`, with continueUrl pointing to `/auth/login`.
  - In `src/app/(auth)/login/page.tsx` line 159, change the "Forgot password?" Link href from `/auth/register` to `/auth/forgot-password`.
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TR-5.1: Login page `Link` for forgot → href `/auth/forgot-password`.
  - `rule` TR-5.2: Route file `(auth)/forgot-password/page.tsx` exists; imports and calls `sendPasswordResetEmail` on submit.
  - `rubric` TR-5.3: UI consistency with auth design system; scale 1-5; anchors: 1 = missing glass; 3 = some padding inconsistencies; 5 = same container max-w, glass card, gold submit, mobile spacing; threshold >= 4; evidence = source layout classes.
  - `rule` TR-5.4: `npm run build` passes.

## Task 6: Middleware review & hardening — PUBLIC_PATHS correctness + rate limit awareness
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - In `src/middleware.ts`, confirm PUBLIC_PATHS includes the new `/auth/forgot-password` route.
  - Confirm edge matcher excludes static assets.
  - Do NOT add full session verification (Admin SDK not available on edge); the layout checks serve as the enforcement layer. This task is about correctness of the presence-check + redirect branches.
  - Optional: add `/api/auth/*` to allowed for session endpoints (already there via `/api/auth/session`).
  - Add 30-second client-side resend-cooldown for Verify page "Resend email" button as a best-effort throttle (fulfills FR-15).
- **Acceptance Criteria Addressed**: AC-6, FR-15
- **Test Requirements**:
  - `rule` TR-6.1: `PUBLIC_PATHS` Set contains `/auth/forgot-password`; middleware redirect for unauthenticated `/dashboard` still works (source check).
  - `rule` TR-6.2: Verify page `handleResend` uses disabled state with 30s timer post-click; source includes `setTimeout` re-enable.
  - `rule` TR-6.3: `npm run build` passes.

## Task 7: Validate Google OAuth flow — emailVerified=true, doc sync, bonus trigger
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Review `syncGoogleUserDocAction` in `src/server/actions/authActions.ts`: it already writes `emailVerified: true` and calls `applyReferralBonusForVerifiedUser(uid)` at the end; confirm that even an existing user re-sign-in does NOT re-pay referral bonus (guarded by `referralPaidOut + referredBy` check).
  - Ensure login page Google handler continues to check session `status === 'banned'` → redirect `/auth/blocked`; add explicit check for existing Firebase `user.emailVerified` (redundant for Google but consistent).
  - Keep Google OAuth provider scopes `email` + `profile`.
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `rule` TR-7.1: `syncGoogleUserDocAction` for new user writes `emailVerified=true` and returns `ok:true` with referralCode; existing user returns `existed:true`.
  - `rule` TR-7.2: After Google sign-in success path, if session.status banned → `/auth/blocked`; else → `next` or `/dashboard`.
  - `rule` TR-7.3: First-time Google signup invokes `applyReferralBonusForVerifiedUser`; repeat sign-ins for same user do NOT double-credit (referralPaidOut source guard).
  - `rule` TR-7.4: `npm run typecheck` passes.

## Task 8: Referral credit audit — transaction, earning doc, idempotency
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 4
- **Description**:
  - In `applyReferralBonusForVerifiedUser`, ensure the existing Firestore transaction atomically increments `balance` and `taskBalance` by bonus; confirm bonus source `settings?.referralBonus ?? DEFAULT_REFERRAL_BONUS`.
  - Ensure `createEarning` writes `source: 'referral'`, `referenceId: inviteeUid`, `amount: bonus`; also sets `updatedAt` is already present on the user update inside transaction.
  - Ensure `markEmailVerifiedAction` calls `updateUser` with `emailVerified: true` then `applyReferralBonusForVerifiedUser`.
  - Confirm Google sync path also calls the apply helper.
  - Review: if `applyReferralBonusForVerifiedUser` throws mid-way (e.g., earning write fails), `referralPaidOut` must NOT already be true — current order is: transaction, then createEarning, then mark referralPaidOut. If createEarning fails, referralPaidOut not set so retry can re-run. But transaction already credited the referrer. To improve: move createEarning + referralPaidOut mark *into* the same transaction. Restructure so all three writes are atomic.
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `rule` TR-8.1: Single Firestore transaction performs all four: (a) update referrer balance, (b) update referrer taskBalance, (c) insert earning doc, (d) mark invitee `referralPaidOut=true`. If any step fails, all roll back.
  - `rule` TR-8.2: Calling `applyReferralBonusForVerifiedUser(inviteeUid)` a second time is a no-op — no balance change, no duplicate earning doc (earning-insert is inside same transaction as `referralPaidOut` guard check).
  - `rule` TR-8.3: `npm run build` passes.

## Task 9: Auth UI design-system audit pass — gradient, gold CTAs, glass forms, responsive
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3, Task 4, Task 5
- **Description**:
  - Walk `(auth)/layout.tsx`, `login/page.tsx`, `register/page.tsx`, `verify/page.tsx`, `blocked/page.tsx`, `forgot-password/page.tsx`.
  - Confirm outer container uses `bg-apron-gradient min-h-screen w-full`.
  - Confirm inner card uses `.glass` class (or equivalent `bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl shadow-glass`).
  - Confirm primary buttons use `variant="primary"` (gold) with `shadow-gold`.
  - Confirm form Inputs use default `.input-base` styling (applied by default in Input).
  - Confirm max-width centering `max-w-[430px]` and mobile safe padding `px-4 py-8`.
  - Fix any deviation (e.g., wrong button variant, missing glass on a newly-added forgot-password card, etc.).
  - Add `animate-fade-in` to content for smooth mount.
- **Acceptance Criteria Addressed**: AC-11, AC-12
- **Test Requirements**:
  - `rule` TR-9.1: Every auth page root div has `bg-apron-gradient` (or wrapper via layout which does; layout already has it).
  - `rule` TR-9.2: Every auth content card uses `glass` (or forget-password card newly added uses glass).
  - `rubric` TR-9.3: Visual cohesion; scale 1-5; anchors 1=variants mismatched; 3=all variants correct but padding inconsistencies at 320px; 5=all variants match + spacing fits 320-1440px; threshold >= 4; evidence = source class audits.
  - `rule` TR-9.4: `npm run build` passes.

## Task 10: End-to-end validation script + build / lint / typecheck + security audit
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1-9
- **Description**:
  - Extend `scripts/test-firebase.ts` (or create `scripts/test-auth.ts`) with a validation harness that:
    - Confirms schema validation passes for valid inputs and fails for weak/non-matching passwords.
    - Confirms unique referral code generator does not collide across 100 generated codes against empty set (unit-style test of the generator + retry).
    - Confirms `generateUniqueReferralCode` throws on 5th consecutive simulated collision (mocked).
  - Run `npm run build`, `npm run typecheck`, `npm run lint` sequentially; resolve any failures.
  - Manually grep / audit:
    - Confirm `src/lib/firebase/admin.ts` starts with `import "server-only"`.
    - Confirm `firestore.rules` `/users/{userId}` rule restricts reads to `userId == uid() || isAdmin()` (already there).
    - Confirm no `FIREBASE_ADMIN_*` or private key substrings appear in next/static chunks (via `Get-ChildItem .next/static -Recurse` grep in PowerShell is impractical in a script; rely on `server-only` gating and source inspection).
- **Acceptance Criteria Addressed**: AC-13, AC-14
- **Test Requirements**:
  - `rule` TR-10.1: `npm run build` exits 0.
  - `rule` TR-10.2: `npm run typecheck` exits 0.
  - `rule` TR-10.3: `npm run lint` exits 0.
  - `rule` TR-10.4: `admin.ts` first line is `import "server-only"`; firestore.rules contains `userId == uid() || isAdmin()` for users read.
  - `rubric` TR-10.5: Overall security posture; scale 1-5; anchors 1=secret leakage risk; 3=secure session cookie but minor gaps; 5=httpOnly+SameSite+Secure in prod, server-only admin gate, rules restrict cross-user, env typed; threshold >= 4; evidence = source of session.ts, admin.ts, rules, env.d.ts.
