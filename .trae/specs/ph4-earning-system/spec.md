# Phase 4 — Earning System (Tasks / Quiz / Hourly / History) — Product Requirements Document

## Overview
- **Summary**: Implement a production-ready, hardened earning system for the Apron rewards platform covering 4 end-to-end modules: (1) interactive, filterable, per-user-status-aware **Tasks List** with visit-duration proof-of-completion for video/survey tasks and real-time submission-state badges; (2) server-scored **Quiz Component** with HMAC challenge tokens, answer validation, one-per-24h cooldown, anti-cheat, and instant tamper-proof reward crediting; (3) dual-model **Hourly Accrual Engine** — (a) idempotent scheduled background worker function plus (b) calculated-on-read projected balance with audit logs, inactivity timeouts, tiered rates, and balance caps — plus a hardened hourly claim action with strict 1-hour server-side cooldown; and (4) **Earning History Feed** with cursor pagination, source/date/status filters, CSV export, and real-time sync against every earning source. The scope also includes end-to-end `tsx` validation harnesses, security hardening (rate limiting, Zod schemas, HMAC, Firestore transaction integrity), WCAG 2.1 AA a11y, and an independent code review gate.
- **Purpose**: Eliminate 3 critical pre-existing financial-data-integrity bugs: (a) hourly-claim infinite-spam vulnerability, (b) client-only quiz scoring tampering, (c) instant "Start & complete" reward-forgery for video/survey tasks. Deliver a complete, self-sustaining earning loop that can run autonomously in staging before production rollout.
- **Target Users**: Authenticated + email-verified Apron end users on mobile (320–430px), tablet (768–1023px), desktop (≥1024px); platform maintainers (via typed `tsx` validation harnesses, structured transaction logs, and Firestore admin console visibility).

## Goals
- Close **3 CRITICAL security/financial-integrity gaps** found during the pre-phase audit: (1) hourly-claim action is rate-limited server-side to 1/hour with idempotent deterministic earning IDs; (2) quiz answer scoring is performed server-side against the canonical `TaskDoc.questions` array with HMAC anti-replay tokens; (3) video task requires minimum 30-second visit proof before reward grant, survey tasks require a completion-code server-verified against the task's expected proof string.
- Ship **4 production-grade modules** (Tasks, Quiz, Hourly, History) with zero scaffolding — every enumerated requirement has verifiable behavior, observability, and test harness coverage.
- Extend **Firestore schemas** with required new fields: `UserDoc.lastHourlyClaimAt`, `UserDoc.accrualCapRemaining?`, `TaskDoc.externalUrl`, `TaskDoc.minDurationSec`, `TaskDoc.proofKey`, `TaskDoc.maxDailyClaims`, `SubmissionDoc.status` extended enum, `SubmissionDoc.proof`, `EarningDoc.txId` (deterministic), plus SettingsDoc fields `hourlyInactivityDays=30`, `globalAccrualCapAPN=100000`.
- Implement **dual hourly accrual**: Cloud Scheduler–triggered idempotent worker function (`api/worker/hourly-accrual.ts` route handler or standalone tsx entry with deterministic `accrual-${userId}-${YYYYMMDDHH}` earning IDs) plus `projectUserAccrualBalance(...)` util for calc-on-read projection used by dashboard/history views, with both paths producing identical arithmetic.
- Maintain **strict build/lint/type hygiene** (`npm run build`, `npm run lint`, `npm run typecheck` exit 0) and adhere to every constraint in `project_memory.md` (no `as="textarea"`, `Suspense` around `useSearchParams`, route-group URLs, glassmorphic design system, etc.).

## Non-Goals
- PDF earning-history export. CSV export via client-side `Blob`/`DataURL` only. (Explicit per user decision from Open Question 4.)
- Vitest / Jest unit test runners. Scripted `tsx` harnesses only, matching Phase 3's `scripts/test-dashboard.ts` pattern. (Explicit per project memory + user decision.)
- New runtime npm dependencies beyond what is already installed. (No pdfmake, no jest, no cron libraries — we use a Next.js route handler that the deployer can hook into Cloud Scheduler via HTTP.)
- Firestore Realtime listeners. "Real-time sync" in scope means post-action `router.refresh()` re-renders + Firestore fresh reads on subsequent navigation, same Phase 3 semantics.
- Native mobile push notifications, browser extension rewards, or on-chain payouts.
- Admin-facing CRUD screens for task creation/editing (existing `admin/tasks`, `admin/plans` pages are retained as-is, minor tweaks only if needed for new TaskDoc schema fields — see Assumptions).

## Background & Context
The pre-Spec code-audit of `c:\projects\apron` dated 2026-10-06 identified the following baseline state and gaps:

**Working scaffolding (retained):**
- Tasks page at `src/app/(app)/tasks/page.tsx` renders per-task cards from `listTasksAction`/`listTasks(true)` with a `completeTaskAction` submit handler.
- Quiz page at `src/app/(app)/quiz/page.tsx` has 5-question hardcoded flow with client-only scoring + calls `completeTaskAction` with first `quizzes[0]` task on pass.
- History page at `src/app/(app)/history/page.tsx` renders 30-item combined earnings+withdrawals feed via `listHistoryAction`.
- Hourly claim action `claimHourlyAccrualAction` (userActions.ts:204-240) runs a Firestore transaction, writes earning `source:"claim"`, calls `appendBalanceSnapshotAction`.
- Schemas: `TaskDoc`, `SubmissionDoc`, `EarningDoc`, `WithdrawalDoc`, `UserDoc`, `PlanDoc` all defined in `types/index.ts`; Zod task-upsert schema present in `validations/schemas.ts`.

**Gaps closed by this PRD:**
1. 🔴 **Hourly claim has zero cooldown**: `MS_1_H` exists in userActions.ts:35 but is *never checked*. A user can spam 1000 claims/sec. **Fixed by FR-3.**
2. 🔴 **Quiz scores client-only**: A user can set `passed=true` in DevTools or call `completeTaskAction` with a quiz taskId directly. **Fixed by FR-2.**
3. 🔴 **Video/survey tasks have zero proof**: One-click = instant `completeTaskAction` reward. **Fixed by FR-1.**
4. 🟡 Tasks list never shows completed state; users can't tell what is already done pre-click. **Fixed by FR-1.4.**
5. 🟡 `upsertTask` resets `createdAt` on every admin edit (Firestore.ts merge writes overwrite `createdAt`). **Fixed by FR-1 / Task 1 schema work.**
6. 🟡 History page casts `(it as any).amount` despite a proper discriminated `Row` union. **Fixed by FR-4.2.**
7. 🟡 Earning `referenceId` missing for claim earnings and some task paths. **Fixed by FR-2 / FR-3 / FR-4 using deterministic transaction IDs across all earning creation sites.**
8. 🟢 Quiz page wrong-answer style has duplicated `border-apron-pink` class. **Fixed in FR-2 UI pass.**
9. 🟢 Tasks page calls `load()` during render (not `useEffect`). **Fixed in FR-1.3.**

## Functional Requirements

### FR-1 Interactive Tasks List Module

**FR-1.1 Augmented TaskDoc schema.** Extend `TaskDoc` in `types/index.ts` with optional fields:
- `externalUrl?: string` — the HTTPS URL to open for video/survey task (for video it is the video page; for survey it is the survey provider link).
- `minDurationSec?: number` — default 30 for video tasks, 0 for quiz.
- `proofKey?: string` — for survey tasks, the *expected completion code* the server checks against user input.
- `maxDailyClaims?: number` — default 1; cap for how many times a user can earn from this specific task in a calendar day (taskId-local).
- `expiresAt?: number` — epoch ms after which the task is treated as inactive regardless of `active`.
- Also, `SubmissionDoc.status` enum extended from `"completed"` only to the discriminated literal `"submitted" | "verified" | "completed" | "failed" | "rejected"`; add `proof?: string` and `durationSec?: number` fields to `SubmissionDoc`.

**FR-1.2 Hardened task completion server actions.** Split `completeTaskAction(taskId: string)` into three typed, Zod-schema-gated actions that replace the existing direct call:
1.  `initiateTaskAction({ taskId })` — returns an HMAC `taskSessionToken` (signed with `FIREBASE_SECRET_COOKIE_SECRET` or dedicated env `HMAC_SECRET`) that embeds `{ uid, taskId, iat, nonce }`. This token is round-tripped and verified by the two actions below to prevent cross-task replay.
2.  `completeQuizTaskAction({ taskSessionToken, answers: [{questionIndex: number, selectedOption: number}] })` — delegated to Quiz module (see FR-2.7) for scoring. For non-quiz tasks, this action returns `ok:false`.
3.  `completeProofTaskAction({ taskSessionToken, proof?: string, durationSec: number })` — for `type==="video"` verifies `durationSec >= task.minDurationSec ?? 30`; for `type==="survey"` verifies `proof.trim().toUpperCase() === task.proofKey.trim().toUpperCase()` (case-insensitive, whitespace-stripped). Passes Firestore transaction reward identical to the old `completeTaskAction` path; creates `SubmissionDoc.status=verified` + `EarningDoc.source=task` with deterministic `referenceId = `submission-${submissionId}``; appends balance snapshot.

**FR-1.3 Responsive, filterable, sortable UI.** Rewrite `src/app/(app)/tasks/page.tsx` as server component with client composition sub-components in `_components/TasksPage/`:
- **Filter tabs** (chip row) for `All` / `Video` / `Survey` / `Quiz` with `aria-pressed` states.
- **Sort selector** (`Reward: High→Low`, `Reward: Low→High`, `Recently added`, `Expiring soon`) server-side applied.
- **Per-task completed-state badge**: Server component data prop includes a map of user's submissions for the returned task list; cards render one of: `Completed ✓` / `In progress` / `Available`.
- **Claim-disabled affordance**: If user already has verified submission *today* for a task with `maxDailyClaims=1`, the CTA is disabled, tooltip shows "Daily limit reached — try tomorrow".
- **Pagination**: Server component uses `limit=10` offset cursor via `startAfter(createdAt)`; "Load more" client button increments page; no React-in-render `load()` calls.
- **Video task flow UX**: Clicking "Start" opens `externalUrl` in `target=_blank rel=noopener`, starts a client-side `setInterval` timer locally tied to the session token, disables the button, and after `minDurationSec` elapses reveals "I've completed" finalizer that calls `completeProofTaskAction` with the measured `durationSec`.
- **Survey task flow UX**: Clicking "Start" shows a small inline `<Input>` for completion code (label `Survey completion code`) plus "Verify" button that calls `completeProofTaskAction` with `proof`.

**FR-1.4 User eligibility controls.** Tasks page (server) and actions (`initiateTaskAction`) implement:
- If task `expiresAt < now` → `task unavailable` return + UI hides task via filter (server).
- If `user.status === "banned"` → all three task actions return `ok:false, banned`.
- If user has not verified email (`user.emailVerified !== true`) → actions return `ok:false, verify-email`; UI shows "Verify email" CTA to `/verify`.
- Per-task deduplication: `findSubmission(userId, taskId)` count against `createdAt >= startOfToday` for daily-limit checks (Firestore `.count()` aggregated query acceptable or in-memory from user's recent submissions).

### FR-2 Quiz Component with Instant Tamper-Proof Reward

**FR-2.1 Augmented Quiz flow page.** Rewrite `src/app/(app)/quiz/page.tsx` to:
- Fetch the user's active quiz tasks from Firestore *server-side* (page component, SSR). If zero quiz tasks exist, render "No quizzes available today" empty state.
- For each task, render a quiz list-card (type pill "Quiz", title `task.title`, reward badge). User selects which quiz to start (currently only `quizzes[0]` was reachable — gap closed).
- On "Start quiz" click, calls `initiateTaskAction({ taskId })` to obtain `taskSessionToken` (HMAC).

**FR-2.2 Three question-type renderer.** Renderer in `_components/QuizFlow.tsx` supports per-question schema:
```
type Q = MCQuestion | TFQuestion | MatchQuestion
```
- **Multiple choice** (`mc`): `{ question, options: string[], answerIndex: number }` — matches existing `TaskDoc.questions[*]` schema.
- **True/False** (`tf`): `{ question, answerIndex: 0 | 1, options?: ["True", "False"] }` — options default to True/False.
- **Matching** (`match`): `{ question, leftPairs: string[], rightPairs: string[], correctMapping: number[] }` — `correctMapping[i]` is the right index for left `i`. UI uses `<select>` per left item.
- Fallback for existing quiz tasks without explicit `type` field: default to `mc`.
- Per-question immediate feedback (green ✓ when correct, red ✗ with "Correct answer: X" explanation text when wrong) only after user submits their answer — not before.

**FR-2.3 Server-only scoring via `completeQuizTaskAction`.** Client sends `{ taskSessionToken, answers: [{qIndex: number, value: number | number[]}] }`:
1.  Action verifies HMAC, extracts `uid`/`taskId`.
2.  Loads `task` from Firestore canonical `questions[]`.
3.  Scores answers server-side against `questions[qIndex].answerIndex` / `correctMapping`.
4.  Pass threshold: `Math.ceil(questions.length * 0.6)` — requires 60% to earn reward (upgrades old hardcoded `ceil(5/2)=3` arbitrary threshold to a formula with same behavior on n=5 but scales).
5.  Pass → reward credited via Firestore transaction identical to proof-task path, writes `SubmissionDoc.status=verified`, `EarningDoc.source="quiz"`, deterministic `referenceId`, balance snapshot appended.
6.  Fail → no reward; writes `SubmissionDoc.status=failed` for attempt audit; does NOT increment `maxDailyClaims` counter (user can retry after 5-minute client-side cooloff; server allows 5 failed attempts per 1h window before temp lockout).

**FR-2.4 HMAC anti-replay + duplicate-prevention.** Enforce:
- `taskSessionToken` HMAC has `iat` (issued-at) that must be within last 15 minutes.
- Earning IDs for quiz tasks use deterministic `quiz-${uid}-${taskId}-${startOfDayUTC}` so replayed tokens never double-pay (Firestore batched set with `{exists: false}` or createEarning precheck against this key via `referenceId` dedup query — whichever is consistent with the current `createEarning` helper; if helper cannot check, wrap in a transaction that reads existing `referenceId` first).
- 24-hour cooldown per quiz task per user: server queries submissions `where userId == uid && taskId == taskId && createdAt > now - 86400_000 && status in [verified, completed]`.count(); if >= 1 → `ok:false cooldown-24h` with `retryAfterMs` payload so UI shows countdown timer.

**FR-2.5 Session management / restart protection.** Client Quiz flow stores `quizSession` in `useState` only (no localStorage resume). If page reloads mid-quiz, server treats it as a new quiz attempt (a new `initiateTaskAction` call is required) — but failed attempts under the 5/1h cap are counted. Quiz timer: per-question 45-second limit (disabled when `prefers-reduced-motion`; falls back to no timer).

**FR-2.6 Reduced motion + a11y.** All quiz interactions follow WCAG 2.1 AA:
- Focus rings on options, `aria-pressed` for multi-choice, role radiogroup for TF, aria-live for correct/incorrect result announcements.
- `prefers-reduced-motion: reduce` disables question-transition fade animations, hides the per-question countdown timer.

**FR-2.7 Shared transaction contract.** The Firestore reward-update path inside `completeQuizTaskAction` MUST reuse the same helper that `completeProofTaskAction` uses (extract a `rewardUserForTaskTx({ userId, taskId, rewardAmount, earningSource, submissionId, earningReferenceId })`) to guarantee arithmetic consistency. Do NOT duplicate the `balance += reward` / `taskBalance += reward` / `updatedAt` update across two functions.

### FR-3 Hourly Accrual Logic Engine (Dual Model)

**FR-3.1 Schema additions.** Extend `UserDoc` in `types/index.ts`:
- `lastHourlyClaimAt?: number` — epoch ms of the most recent successful hourly claim.
- Add `SettingsDoc.hourlyInactivityDays: number` (default 30); `SettingsDoc.globalAccrualCapAPN: number` (default 100_000).

**FR-3.2 Hardened hourly-claim action.** Rewrite `claimHourlyAccrualAction` to enforce:
1.  `verifySessionCookie()` + `user.status != banned` + emailVerified (same as task actions' gate matrix).
2.  Load user; if `user.apnRate <= 0` return `ok:false plan-inactive`.
3.  **Strict 1h server cooldown**: if `user.lastHourlyClaimAt && now - user.lastHourlyClaimAt < 3_600_000` → `ok:false, too-soon` with `retryAfterMs = 3_600_000 - (now - user.lastHourlyClaimAt)` for UI countdown.
4.  **Inactivity timeout gate**: if `settings.hourlyInactivityDays > 0` AND user has ZERO verified submissions + ZERO referrals + zero logins (we approximate via `user.updatedAt`) in the last N days → `ok:false inactive`; hint to "Complete a task to reactivate".
5.  **Cap check**: if `user.balance + apnRate > settings.globalAccrualCapAPN` → `ok:false cap-reached`.
6.  **Tier multiplier**: `userTierMultiplier = { starter:1, pro:3, elite:5 }[user.plan] ?? 1`; `creditAmount = user.apnRate * userTierMultiplier`.
7.  **Deterministic earning ID**: `earningReferenceId = `claim-${uid}-${floorHourBucketOf(now)}`` where `floorHourBucketOf` produces `YYYYMMDDHH` UTC string.
8.  **Firestore transaction**: update `balance += creditAmount`, `taskBalance += creditAmount`, `lastHourlyClaimAt = now`, `updatedAt = now`; CREATE earning `source="claim"` with that `referenceId` using an existence check (double-pay guard).
9.  **Audit log**: append `BalanceSnapshot` via `appendBalanceSnapshotAction` inside the same logical transaction (or right after; no-op if snapshot already within 60s).

**FR-3.3 Scheduled background worker (idempotent).** Create a Next.js route handler at `src/app/api/worker/hourly-accrual/route.ts` exposing `POST`:
- Accepts a bearer token via `Authorization: Bearer ${WORKER_TOKEN}` where `WORKER_TOKEN` is an env var. Returns 401 if missing or mismatch.
- Loads user ids page-by-page (`limit=500`) from users collection with `apnRate > 0 && status == active` and `lastHourlyClaimAt` older than 1h (or missing).
- For each qualifying user, calls a NEW `applyScheduledHourlyAccrualForUser(uid: string)` helper that:
  1.  Reuses identical tier multiplier, cap, inactivity logic from FR-3.2.
  2.  Uses the **same** hour-bucket deterministic `earningReferenceId` and Firestore transaction pattern, so running the worker twice for the same user in the same UTC hour is a no-op (idempotent).
  3.  Skips and logs users where `claimHourlyAccrualAction` was already fired by hand for that bucket (dedup by `referenceId`).
- Deployment note: In staging + production this endpoint gets called hourly by Cloud Scheduler → HTTP POST (URL: `https://<host>/api/worker/hourly-accrual`). We do NOT install a cron library in this repo.

**FR-3.4 Calculated-on-read balance projection.** Export a pure TypeScript helper `projectUserAccrualBalance(user: UserDoc, settings: SettingsDoc, nowMs: number = Date.now())`:
```
Returns {
  projected: number;                       // base user.balance + estimated pending hourly credits since last claim
  unclaimedHours: number;                  // integer 0..inactivityGateHours
  lastClaimAt: number | null;
  projectedReferenceIds: string[];         // deterministic ids the worker would create
  cappedAt: boolean;                       // true if projection clipped by global cap
}
```
- Rules: (1) starts at `lastHourlyClaimAt ?? user.createdAt ?? now`; (2) for each fully elapsed hour bucket, count hour UNTIL cap hit OR activity gate fails; (3) multiplier applied per user.plan; (4) result does NOT mutate user doc and returns the same answer as the worker would for each bucket.
- This helper is:
  - Called server-side in the Hero hourly card to show "Estimated pending / hour" if > 0.
  - Called in a new `scripts/test-hourly-math.ts` `tsx` harness with fixtures to PROVE the arithmetic equals the worker helper's arithmetic for the same inputs (property-based: same `user` / `settings` → same `projectedReferenceIds` set → same total `creditAmount`).

**FR-3.5 Comprehensive transaction logging.** Every:
- Successful claim
- Skipped claim (cooldown/cap/inactive)
- Worker run with `userCountProcessed`, `userCountSkipped`, `startAt`, `endAt`, `runId`

Is logged as a structured event to Firestore collection `tx_logs` with schema:
```
{ id: string, event: 'hourly_claim_success' | 'hourly_claim_skip' | 'worker_run', userId?: string, payload: any, at: number }
```
(We extend the existing `lib/firestore.ts` with a new `createTxLog(...)` helper that writes this collection.)

### FR-4 Earning History Feed

**FR-4.1 Cursor-based pagination + realtime sync.** Rewrite `src/app/(app)/history/page.tsx`:
- Server component receives initial `rows: Row[]`, `nextCursor?` from `listHistoryAction(startAt?, limit=20?)`.
- `listHistoryAction` now accepts optional `startAt?: string` Firestore composite cursor id (the `id` of the last loaded `createdAt` pair), optional `filters: { sources?: EarningSource[], statuses?: WithdrawalStatus[], fromMs?: number, toMs?: number }`.
- `Row` discriminated union properly type-narrowed in rendering code — `it.kind === "earning"` → access `.amount`; `it.kind === "withdrawal"` → access `.netAmount`; zero `as any` casts.
- Client "Load more" button calls `loadMoreHistoryAction({ startAt: lastId })` and appends rows. When server returns `nextCursor: null` button disappears.

**FR-4.2 Filters + export.** History page `_components/HistoryToolbar.tsx`:
- Source multi-select chips: `All | Task | Quiz | Claim | Referral` (EarningSource).
- Date range picker (native `<input type="date">` × 2 for from/to, client timezone) — server filters earnings/withdrawals `createdAt BETWEEN`.
- Withdrawal status filter (only applies to withdrawal rows): `All | Pending | Paid | Rejected`.
- **CSV Export**: button "Export CSV" uses `Blob` + `<a download>`. CSV schema:
  ```
  Date,Type,Source/Status,Amount (APN or NGN),Reference ID,Note
  ```
  Earned rows output amount in APN (positive +). Withdrawal rows output net NGN (negative -), type "Withdrawal", source column is status Pending/Paid/Rejected, Reference ID = withdrawal id or earning referenceId.

**FR-4.3 Transaction reference deep-linking.** For earning rows where:
- `source === "task" or source === "quiz"` → row links to `/tasks` (task title + reward summary hover tooltip).
- `source === "referral"` → row links to `/referrals`.
- `source === "claim"` → row shows a clock badge with tooltip `Hourly accrual · ${formatDateTime(timestamp)}`.
- Withdrawal rows with `status === paid` link to `/wallet/receipt/[wdId]` (existing route).

**FR-4.4 Feed consistency.** Every reward-creating action in FR-1.2, FR-2.7, FR-3.2, FR-3.3 invokes the shared `createEarning(...)` / `createWithdrawal(...)` helpers so that `listHistoryAction` picks up the new row on the next page render. The dashboard Recent Activity section (from Phase 3) continues to share this same pipeline.

### FR-5 Transaction Logging & Reconciliation

**FR-5.1 Shared transaction idempotency utility.** Add a lib helper `withDeterministicEarningTx({ referenceId, fn })` that:
1.  Queries `earnings` collection with `where("referenceId", "==", referenceId).limit(1).get()`.
2.  If non-empty, exits returning the existing earning (noop).
3.  If empty, executes the provided Firestore transaction `fn(tx, earningId)`.
4.  Every reward-creating site uses this.

This helper is the single source of truth that prevents double payment across FR-1/FR-2/FR-3. Its correctness is asserted in the test harnesses.

**FR-5.2 Reconciliation helper.** A non-API `tsx` module `scripts/reconcile-user.ts <uid>` that:
1.  Iterates all `earnings` for user.
2.  Sums by source and compared against the user's `balance + taskBalance` plus all `withdrawals` sums.
3.  Prints PASS or FAIL with delta. Used by maintainers for post-incident audits.

### FR-6 Accessibility, Responsive & Cross-Browser

Same WCAG 2.1 AA + responsive matrix as Phase 3, applied specifically to the 4 modules:
- All interactive elements have explicit accessible labels (copy/export, task CTAs, quiz options, pagination buttons, filter chips).
- `:focus-visible` rings via global `globals.css` (already in project); toast notifications, progress updates use `aria-live="polite"`.
- No horizontal scroll at 320px wide; grids at 320/768/1280.
- Reduced motion honored: disable countdown timers in Quiz, disable smooth slide transitions for task card active state.

### FR-7 Validation Harnesses (`tsx` only, no runners)

Create `scripts/test-earning-system.ts` that calls the server actions via their TypeScript functions (uses a dedicated test user created+cleaned up by harness) and asserts via Zod + exit codes:
1.  `H1 — Task proof flow`: create test video task with `minDurationSec=5` → `initiateTaskAction` returns token with correct HMAC → `completeProofTaskAction` with duration 1s fails `min-duration` → retry with duration >=5 sec succeeds (reward credited 1x, 2nd call for same token fails HMAC replay).
2.  `H2 — Survey proof`: create survey task, set `proofKey="ABC123"` → wrong code rejected → right code case-insensitive accepted; duplicate submission for same user same day rejected by `maxDailyClaims=1`.
3.  `H3 — Quiz server score`: create quiz task with known answers → client submits all-wrong (fails, no reward, status failed written) → all-correct passes (reward credited); attempt to replay same token 5 min later rejected by determinism guard.
4.  `H4 — Hourly hardening`: (a) two `claimHourlyAccrualAction` calls within 60s → second rejected `too-soon retryAfterMs>0`; (b) worker function with deterministic earning IDs: running `applyScheduledHourlyAccrualForUser(uid)` twice for same UTC hour bucket → exactly ONE earning written (idempotency).
5.  `H5 — Math agreement`: `projectUserAccrualBalance(user, settings, fixedNowMs).projectedReferenceIds.length * perHourAmount === worker helper output when run N times for N unclaimed buckets in that window`.
6.  `H6 — History pagination + filters`: create 25 earnings with mix of sources → `listHistoryAction(limit=10)` returns 10 rows + cursor → next page returns next 10 → source filter returns only matching rows.
7.  `H7 — CSV generation`: `generateCsv(rows)` produces expected headers + correct count of non-header lines matching input row count (runs in Node via `node:buffer` shim for Blob or an equivalent pure-string CSV generator function that is shared between browser harness & client).
8.  `H8 — Reconcile helper`: `scripts/reconcile-user.ts` on a freshly-created and transacted test user prints PASS; intentionally manipulate one earning's amount in harness → prints FAIL with correct delta.

Exits `0` if all 8 harness cases PASS; non-zero otherwise. Each case prints `[test-earning-system] H# CASE-NAME: PASS/FAIL` line-by-line.

## Non-Functional Requirements

- **NFR-1 (Design fidelity)**: All 4 module pages use consistent purple gradient `bg-apron-gradient` wrap, `.glass` cards, gold primary CTAs, typography scale aligned with `(app)` shell. Task cards inherit the existing Task card palette from scaffolded `tasks/page.tsx`. Quiz option cards use white/10 base → gold/30 pressed → gold/20 correct → pink/20 incorrect.
- **NFR-2 (Secure boundaries)**: All server actions import `"use server"`; Firestore admin reads/writes route through `lib/firestore.ts` which has `import "server-only"`. No server-only code leaks into client. `taskSessionToken` HMAC secret sourced via env var, never serialized to browser (only opaque base64 token value round-trips).
- **NFR-3 (Type safety)**: Every server action uses Zod schema for input. Zero new `any` type additions. Build `tsc --noEmit` passes (already required gate).
- **NFR-4 (No new runtime npm dependencies)**. Recharts retained. CSV export uses pure-string generation + browser-native `Blob` (no `papaparse`, no `csv-writer`).
- **NFR-5 (Build hygiene)**: `npm run build && npm run typecheck && npm run lint` exit 0 after all changes.
- **NFR-6 (Performance)**: All 4 module pages LCP < 3s on emulated 4G Chrome DevTools profile. Cursor-pagination avoids loading >20 rows per request. Quiz HMAC compute is Node `crypto.createHmac` + sha256, sub-ms.
- **NFR-7 (Graceful degradation)**: If Firestore unavailable, pages show "Unable to load data" non-crash state. If recharts not needed for this module, no impact (retained, not added). If `navigator.clipboard` unavailable for copy fallback, CSV fallback to `window.open(data:text/csv,...)` still works.
- **NFR-8 (Rate limiting)**: For the task & quiz submission actions, implement an in-memory-per-process token bucket (or Firestore-throttled submission counter with 10 req/user/minute guard). The goal is defense-in-depth even if not a true DDoS solution. The `hourly-claim` 1-hour cooldown is its own rate limiter. Worker route (`/api/worker/hourly-accrual`) uses Bearer token auth as its own gate.

## Constraints
- **Technical**: Next.js 14 App Router; `server-only` gating for admin via `lib/firestore.ts`. Firebase v10 client + firebase-admin. Tailwind + existing theme tokens. Zod for ALL new server action inputs that take non-empty objects. HMAC with `NODE:crypto` + env var `HMAC_SECRET` (fallback to `FIREBASE_SECRET_COOKIE_SECRET` if HMAC_SECRET not set — documented).
- **Business**: Tiered hourly multipliers fixed at `{ starter:1, pro:3, elite:5 }` for Phase 4 (configurable via settings if we add SettingsDoc tieredRateOverrides map — but defaults hardcoded, override feature listed as *out* to keep scope tight). Global accrual cap default 100_000 APN. Inactivity default 30 days. Daily quiz/task claim limit 1 per user per task.
- **Dependencies**: No new runtime npm deps. Dev deps unchanged.

## Assumptions
- Admin task editor (`app/admin/tasks/*`) fields for the 6 new TaskDoc props (`externalUrl`, `minDurationSec`, `proofKey`, `maxDailyClaims`, `expiresAt`, `questions.type`) are considered **lightweight follow-up changes**. They are NOT blocked on Phase 4 unless the build fails; in the worst case we seed them manually via Firestore console during the harness run, and the admin UI update is a stretch item. If time permits, Task 1 includes adding the 6 new fields to the existing task upsert form; otherwise the harness creates tasks programmatically.
- The project already provides (via Phase 1-2 or env setup) a cookie-signing secret that the HMAC layer can reuse (`COOKIE_SECRET` or `FIREBASE_SECRET_COOKIE_SECRET` from env). If neither exists at runtime, the `initiateTaskAction` falls back to a generated per-process key with a console.warning("HMAC key not set — replay protection degraded") and continues to function for local dev.
- "Staging deployment" in the general requirements is treated as an operator step triggered outside this PRD code-writing phase. The code provides the HTTP route (`/api/worker/hourly-accrual`) + instructions comment in the route file for the scheduler; we do not provision Terraform/GCP resources.
- CSV generation is pure-string — produce headers + CRLF-delimited rows, values quoted if they contain commas/quotes. No RFC 4180 deep compliance required; values in scope (reward amounts, dates, reference ids) do not have commas, but the generator SHOULD quote them defensively.

## Open Questions
- [x] Hourly accrual dual model (worker + calc-on-read) + tiered multipliers + defaults → User-approved option A in AskUserQuestion dated 2026-10-06.
- [x] Quiz anti-cheat model → Server-validated + HMAC token with 24h cooldown. Approved.
- [x] Video/survey proof-of-completion → 30s minimum visit duration (video) + server-side proof key check (survey). Approved.
- [x] History CSV only + tsx harnesses as Phase 3 pattern → Approved. PDF explicitly out. No Vitest/Jest.

## Acceptance Criteria

### AC-1: Hourly claim action rejects duplicate calls within 60 minutes with retryAfterMs
- **Type**: `rule`
- **Given**: Test user U has called `claimHourlyAccrualAction` successfully at time T0
- **When**: The harness calls `claimHourlyAccrualAction` again for the same user at T0 + 60 seconds
- **Then**: (a) Returns `{ ok:false, error: "too-soon", retryAfterMs: number }`; (b) `retryAfterMs > 3_500_000`; (c) User balance and taskBalance are unchanged compared to T0
- **Pass Condition**: Harness H4-a prints PASS; source of `claimHourlyAccrualAction` contains a `Date.now() - lastHourlyClaimAt < 3_600_000` comparator + explicit `retryAfterMs` return
- **Evidence**: `scripts/test-earning-system.ts` H4-a terminal output; code inspection of server action

### AC-2: Background worker accrual is idempotent per UTC hour bucket
- **Type**: `rule`
- **Given**: Test user U has a single unclaimed hour bucket
- **When**: `applyScheduledHourlyAccrualForUser(U)` is invoked twice in immediate succession with identical clock
- **Then**: Exactly ONE earning document is written for user U in that hour bucket; balance increases exactly once by `apnRate * tier`
- **Pass Condition**: Harness H4-b prints PASS; Firestore `.count()` for earnings with referenceId matching `claim-UID-BUCKET` === 1
- **Evidence**: Harness H4-b output; deterministic `earningReferenceId` pattern visible in `createEarning` helper call site

### AC-3: Quiz scoring is server-side; client submitting correct answer passes; wrong answers do not reward
- **Type**: `rule`
- **Given**: Quiz task T seeded with canonical questions array with known correct indices
- **When**: Harness calls `completeQuizTaskAction` with (a) all-wrong (b) all-correct
- **Then**: (a) → `{ ok:false, score:0, status: "failed" }`; user balance unchanged; submission status=failed written. (b) → `{ ok:true, reward, score:questions.length }`; balance increases by exactly `reward`, earning `source=quiz` written, `referenceId` matches dedup pattern.
- **Pass Condition**: Harness H3 prints PASS for both sub-cases; server action body contains a `task.questions[q].answerIndex vs answers[i]` comparator loop and reward transaction runs on pass only
- **Evidence**: Harness output; server-side scoring source in completeQuizTaskAction

### AC-4: Quiz double-claim within 24h is rejected by cooldown + replay attempt rejected by HMAC
- **Type**: `rule`
- **Given**: User U passed quiz T at T0
- **When**: (a) Attempt `completeQuizTaskAction` with the exact same token replay; (b) Attempt with FRESH token but taskId=T within same 24h
- **Then**: (a) `{ ok:false, error:"replay" }`; (b) `{ ok:false, error:"cooldown-24h", retryAfterMs: >0 }`
- **Pass Condition**: Harness H3 final assertions; source code of completeQuizTaskAction contains `iat` expiry check and 24h `Submission` count query
- **Evidence**: Harness H3 sub-cases; server action source

### AC-5: Video task requires minimum duration; survey requires matching proof code
- **Type**: `rule`
- **Given**: Video task V (minDurationSec=10) and Survey task S (proofKey="XYZ-789")
- **When**: (a) Video: call completeProofTaskAction with durationSec=2; (b) Video: same task at durationSec=15; (c) Survey: `proof="wrong"`; (d) Survey: `proof=" xyz-789 \n"` (whitespace, lower-case, newline).
- **Then**: (a) fail duration; (b) pass; reward granted; (c) fail proof; (d) pass (trim + case-insensitive).
- **Pass Condition**: Harness H1 + H2 sub-cases all PASS.
- **Evidence**: Harness H1/H2 PASS lines.

### AC-6: Tasks page shows Completed state before click and disables daily-limit-reached cards
- **Type**: `rule`
- **Given**: User completed task T1 earlier today; has not completed T2
- **When**: Render `/tasks`
- **Then**: (a) T1 card shows pill `Completed ✓` OR CTA disabled tooltip "Daily limit reached"; (b) T2 card CTA is `Start`.
- **Pass Condition**: Server data prop for tasks page includes submission-status map per taskId; UI rendering code applies disabled + chip
- **Evidence**: Browser snapshot; tasks page server component source with submission hydration pass

### AC-7: History feed uses cursor pagination; Row discriminated union is narrowed without any `as any`
- **Type**: `rule`
- **Given**: 25 earnings + 5 withdrawals seeded in history
- **When**: Harness H6 calls listHistoryAction page1 (limit 10), page2 (cursor), page3 (cursor), and renders via history component type-narrow
- **Then**: page1 returns 10 with non-null cursor; page2 returns next 10; page3 returns remaining <=10 with cursor=null; TypeScript build passes with no `as any` casts in history row rendering code.
- **Pass Condition**: Harness H6 PASS; `tsc --noEmit` exit 0; Grep in history page for `as any` returns 0 matches in rendering branches.
- **Evidence**: Harness H6 output; tsc exit log; grep result.

### AC-8: CSV export produces correct rows + header line for 30-item history
- **Type**: `rule`
- **Given**: 30 history rows
- **When**: Call shared `generateCsv(rows)` helper (shared between browser UI & Node harness)
- **Then**: Output: lines === 31 (1 header + 30 rows). First line === `"Date","Type","Source/Status","Amount (APN or NGN)","Reference ID","Note"`. Values for earning rows are positive; withdrawal rows contain the status in column 3, net amount negative in column 4.
- **Pass Condition**: Harness H7 PASS.
- **Evidence**: Harness H7 output; `generateCsv.ts` shared helper source.

### AC-9: `projectUserAccrualBalance` math matches worker accrual for identical inputs
- **Type**: `rule`
- **Given**: Fixed user with `plan=pro`, `apnRate=12.5`, `lastHourlyClaimAt = now - 3h`; settings default (cap=100k, inactivity=30, still-active)
- **When**: (a) Run `projectUserAccrualBalance` with fixed `nowMs`; (b) run `applyScheduledHourlyAccrualForUser` 3 consecutive times for each unclaimed bucket that the projection listed
- **Then**: `projected.totalHoursClaimed` === 3 and sum of the 3 actual worker credits === projected projection exactly.
- **Pass Condition**: Harness H5 PASS; sum comparison exact float diff < 1e-9
- **Evidence**: Harness H5 output; helper source showing identical formula blocks

### AC-10: Typecheck, lint, build all exit 0
- **Type**: `rule`
- **Given**: Repository state after Phase 4 implementation
- **When**: `npm run build && npm run typecheck && npm run lint` runs
- **Then**: All three commands exit 0
- **Pass Condition**: Exit codes all 0
- **Evidence**: Terminal log capturing the three in sequence

### AC-11: Server-only boundaries preserved; no admin SDK or "server-only" imports leak to client code
- **Type**: `rule`
- **Given**: Source of every new module; grep
- **When**: Search every client-marked TSX file under `_components/` for `getAdminDb` / `firebase-admin` / `import "server-only"`
- **Then**: ZERO matches. Every action that uses admin Firestore either routes through `lib/firestore.ts` (already server-only-gated) OR is in a module with its own `import "server-only"`.
- **Pass Condition**: Grep zero hits.
- **Evidence**: Grep log.

### AC-12: HMAC taskSessionToken cannot be forged by client; 15 minute iat expiry enforced
- **Type**: `rule`
- **Given**: Client tampers HMAC by flipping a single bit in the token
- **When**: Submit to `completeQuizTaskAction` / `completeProofTaskAction`
- **Then**: Server returns `{ ok:false, error: "invalid-token" }` BEFORE any scoring logic runs. Also, a 16-min-old token submitted from harness returns `{ ok:false, error:"token-expired" }`.
- **Pass Condition**: Harness sub-cases. Source of server actions shows HMAC verify happens before database call.
- **Evidence**: Harness output; token-verify utility source location.

### AC-13: Visual design fidelity — purple gradient, glass cards, gold CTAs, hover micro-interactions across Tasks/Quiz/History pages
- **Type**: `rubric`
- **Dimension**: Visual design alignment with existing Apron system
- **Scale**: 1-5
- **Anchors**: 1 = No gradient, flat non-glass rects, non-gold primary buttons; 3 = Gradient present but missing hover micro-interactions or inconsistent spacing; 5 = All four pages (tasks/quiz/history/hourly-action-surfaced) have gradient wrapper, glass cards everywhere, gold primary CTAs, hover/press micro-interactions matching dashboard Hero card animation parity, matching typography scale.
- **Pass Threshold**: >= 4
- **Evidence**: Browser snapshots of `/tasks`, `/quiz`, `/history` at 1280×800 desktop + 360×640 mobile. Source of page wrappers showing `bg-apron-gradient`, `glass`, `gold` variant buttons, `hover:scale-[0.99]` press states where present in dashboard.

### AC-14: Mobile responsiveness — no horizontal scroll at 320px; grids collapse properly
- **Type**: `rubric`
- **Dimension**: Layout robustness across breakpoints
- **Scale**: 1-5
- **Anchors**: 1 = horizontal scrollbar < 360px visible; 3 = usable 360 but awkward 320; 5 = perfect flow at 320px (tasks filter chips wrap to 2 rows, quiz options single column, history toolbar dropdowns stack); grids expand at 768 and 1280 correctly with no overlap.
- **Pass Threshold**: >= 4
- **Evidence**: Browser snapshots 320× / 768× / 1280× for tasks and quiz pages; no overflow.

### AC-15: WCAG 2.1 AA basic accessibility rules satisfied for Tasks + Quiz + History
- **Type**: `rubric`
- **Dimension**: Accessibility coverage
- **Scale**: 1-5
- **Anchors**: 1 = most CTAs have no aria-label, missing focus styles, no aria-live; 3 = mostly labeled but no reduced-motion or focus traps; 5 = aria-live for quiz feedback and task completion toast; every interactive item labeled; focus-visible rings; reduced-motion disables quiz countdown timer and slide transitions; color contrast >= 4.5:1 for reward text on card background.
- **Pass Threshold**: >= 4
- **Evidence**: Source of client components with aria-live, aria-label, reducedMotion conditionals, `globals.css :focus-visible` already in place.
