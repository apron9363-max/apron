# Phase 4 — Earning System — Implementation Plan

## Task 1: Core schema + shared lib + Firestore helpers (foundational)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Extend `UserDoc`, `TaskDoc`, `SubmissionDoc`, `SettingsDoc`, `EarningDoc` in `src/types/index.ts` with all FR-1.1 + FR-3.1 fields; add `TaskQuestion` discriminated union `MCQuestion | TFQuestion | MatchQuestion` type; add `SubmissionStatus = "submitted" | "verified" | "completed" | "failed" | "rejected"` literal union; add `TxLog` entity.
  - Extend Zod `validations/schemas.ts` with: `taskClaimSchema` (taskId min(1)), `initiateTaskSchema` (taskId), `completeProofTaskSchema` (taskSessionToken + proof + durationSec positive int), `completeQuizTaskSchema` (taskSessionToken + answers array of {qIndex, value: number | number[]}), `hourlyAccrualClaimSchema` (empty-ish, validate no extra fields), `taskSessionTokenPayloadSchema` (uid, taskId, iat, nonce).
  - Extend `lib/firestore.ts`: fix `upsertTask` `createdAt` overwrite bug (only set on create); add `listSubmissionsByUser(uid, limit?)`, `hasSubmittedTaskInWindow(uid, taskId, fromMs?)` (count), `createTxLog(...)`, `listHistoryActionWithFilters(uid, filters, cursor, limit)` (new helper that does earnings+withdrawals composite join with filters); export `applyScheduledHourlyAccrualForUser(uid)` helper file-local to start (promoted to public import once written).
  - Add `lib/hmac.ts`: `signTaskSessionToken({uid, taskId, iat, nonce})` and `verifyTaskSessionToken(token)` using Node `crypto.createHmac('sha256', HMAC_SECRET || COOKIE_SECRET)`; return discriminated union `{ok:true, payload}` or `{ok:false, error: 'invalid'|'expired'}` with 15-min iat window.
  - Add `lib/hourly-math.ts`: `projectUserAccrualBalance(user, settings, nowMs?)` pure helper per FR-3.4; `floorHourBucketOf(nowMs)` that returns `YYYYMMDDHH` UTC string.
  - Add `lib/csv.ts`: `generateCsv(rows: HistoryRow[])` pure shared helper used by browser UI AND Node harness.
  - Add `lib/rewards-tx.ts`: `withDeterministicEarningTx(...)` per FR-5.1 + `rewardUserForTaskTx({ uid, taskId, amount, source, submissionId, earningReferenceId })` shared by task/quiz/hourly paths.
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5, AC-9, AC-11, AC-12
- **Test Requirements**:
  - `rule` TR-1.1: `signTaskSessionToken → verify` round-trip returns payload; 1-bit-flip of base64 token returns `invalid`
  - `rule` TR-1.2: `projectUserAccrualBalance` for pro user, 3 unclaimed hours, returns `unclaimedHours:3` with correct `tier*apnRate` credit per hour
  - `rule` TR-1.3: `upsertTask` twice for same taskId preserves original `createdAt` (second call does not overwrite)
  - `rule` TR-1.4: `generateCsv(30 rows)` output splits `\n` → length === 31; first line equals the required quoted header
  - `rule` TR-1.5: Token with `iat = now-16min` returns `{ok:false, error:'expired'}`
  - `rubric` TR-1.6: Shared-reward-transaction reuse; scale 1-5; anchors 1=duplicated balance+= in 3+ files, 3=two helpers, 5=single `rewardUserForTaskTx` used by task/quiz/hourly paths; threshold >= 4; evidence = grep for `balance \+= reward` pattern
- **Notes**: All subsequent tasks depend on these foundational additions. Do NOT add new npm deps.

## Task 2: Hourly accrual engine (claim action + worker route + tx logs)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Rewrite `claimHourlyAccrualAction` in `server/actions/userActions.ts` with all FR-3.2 gates (cooldown, inactivity, cap, tier multiplier, deterministic id, Firestore transaction, lastHourlyClaimAt write, `rewardUserForTaskTx` helper, audit tx log, append snapshot).
  - Add `applyScheduledHourlyAccrualForUser(uid)` server-only helper (gate `server-only`) that performs the identical check+credit and uses the SAME `earningReferenceId = claim-uid-hourBucket` so repeated runs are no-ops (idempotent); use `withDeterministicEarningTx`.
  - Add Next.js POST route at `src/app/api/worker/hourly-accrual/route.ts`: Bearer-token auth (env `WORKER_TOKEN` or fallback `HMAC_SECRET`), 401 on mismatch, page through users (limit=500), call helper per user, write `worker_run` tx_log with counts + runId.
  - Surface the new deterministic `referenceId` and `txId` fields on any existing earning creation sites.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-9, AC-11
- **Test Requirements**:
  - `rule` TR-2.1: Two sequential `claimHourlyAccrualAction` calls <1h apart → second returns `too-soon` with `retryAfterMs` >3_500_000 and balance unchanged
  - `rule` TR-2.2: `applyScheduledHourlyAccrualForUser` called twice in same bucket → exactly 1 earning doc created, balance increments exactly once
  - `rule` TR-2.3: `/api/worker/hourly-accrual` POST with no Bearer → HTTP 401; with wrong Bearer → 401; with correct Bearer → HTTP 200 JSON `{ ok:true, runId, processed:N, skipped:M }`
  - `rule` TR-2.4: User with balance >= 100_000 returns `cap-reached` error from claim action and worker skips them
  - `rule` TR-2.5: Every successful path writes one `tx_logs` document of correct `event` type
- **Notes**: Critical security hardening; must be completed before any reward crediting is tested end-to-end.

## Task 3: Quiz server actions (initiate + completeQuiz) + shared reward plumbing
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Add `initiateTaskAction({ taskId })` in `taskActions.ts`: verify session, check user eligible (emailVerified, not banned), load task, return `{ ok:true, taskSessionToken, task, expiresAtMs }` with HMAC-signed token.
  - Add `completeQuizTaskAction({ taskSessionToken, answers })`: HMAC verify + load task, validate answers array length ≤ questions length, score server-side per `TaskDoc.questions[q].answerIndex` / `correctMapping` for matching, threshold `ceil(n*0.6)`, pass → `rewardUserForTaskTx` with `source:"quiz"` + deterministic `referenceId = quiz-${uid}-${taskId}-${YYYYMMDD}` (day bucket), write Submission status=`verified`; fail → Submission status=`failed` + no reward, count toward 5-fail/1h throttle.
  - Add 24h cooldown: submission count query `verified` in last 86_400_000 ms per uid per taskId → returns `cooldown-24h` with `retryAfterMs`.
  - Wire up `completeProofTaskAction` (placeholder body): video duration check + survey proof check (case-insensitive trim). Uses same `rewardUserForTaskTx`.
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-12
- **Test Requirements**:
  - `rule` TR-3.1: All-wrong quiz submission → no reward, submission=failed; all-correct → reward + submission=verified + earning written
  - `rule` TR-3.2: Same token resubmitted after 1 minute → `invalid-token` or `replay` before any DB write (enforced by determinism check or token nonce uniqueness)
  - `rule` TR-3.3: Fresh token on same task <24h after pass → `cooldown-24h` with `retryAfterMs > 0`
  - `rule` TR-3.4: Proof action with survey code matching in different case/whitespace → pass; wrong code → fail
- **Notes**: Server scoring is the most critical anti-cheat fix.

## Task 4: Tasks list page (server component + filter/sort/completed badges + video/survey flows)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 3
- **Description**:
  - Server component `tasks/page.tsx` fetches `listTasksAction + listSubmissionsByUser(userId)` composite; computes per-task `completedToday`, `completedEver`; passes to client composition.
  - Extract `_components/TasksPage/TasksPageClient.tsx` (client): filter chips (All/Video/Survey/Quiz), sort selector, paginated "Load more". Each card: type badge, title, desc, reward, status pill (`Completed ✓` / `Available` / `In progress`).
  - Video task: start button → opens `externalUrl` new-tab + starts client timer; after `minDurationSec` elapses → "I've completed" button becomes clickable → calls `completeProofTaskAction({taskSessionToken, durationSec: measured})` → toast success/error + router.refresh.
  - Survey task: start → inline `<Input>` for completion code → "Verify" → calls `completeProofTaskAction({ proof })` → toast.
  - Add `aria-live` for task completion announcements; reduced-motion disables any CSS fade slide animations on active state.
  - Remove the existing React-in-render `load()` call (gap).
  - Fix any TypeScript strictness violations: no `setTasks(data as any)`, validate via schema if dynamic.
- **Acceptance Criteria Addressed**: AC-5, AC-6, AC-13, AC-14, AC-15
- **Test Requirements**:
  - `rule` TR-4.1: Server tasks data prop includes submission-status map with correct taskIds
  - `rule` TR-4.2: Already-completed task has CTA disabled with tooltip "Daily limit reached"
  - `rule` TR-4.3: Grep for `data as any` in tasks folder → 0 matches
  - `rubric` TR-4.4: Tasks page responsive fidelity; scale 1-5; anchors 1=horizontal scroll on 320px, 3=usable but awkward filter wrap, 5=perfect at 320/768/1280; threshold >= 4
  - `rubric` TR-4.5: Tasks page design fidelity; scale 1-5; threshold >= 4 (per AC-13 standards); evidence = snapshots + source Tailwind classes
- **Notes**: UI design should mirror dashboard card styling for consistency.

## Task 5: Quiz flow page (server-rendered quiz list + client QuizFlow renderer with 3 question types + HMAC round-trip)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - Server page `quiz/page.tsx`: fetches active quiz tasks list (SSR), empty state if none. Each quiz in list-card shows reward. Click "Start quiz" fetches a token via `initiateTaskAction` client-action then mounts `<QuizFlow>`.
  - Client `_components/QuizFlow.tsx`: uses the HMAC token + canonical questions array fetched from the server-response task (NOT a static hardcoded array — remove `STATIC_QUIZ`). Renders MC/TF/Match per question `type`. Immediate feedback for wrong: shows "Correct answer: X" in aria-live. Progress tracker.
  - Per-question 45s countdown timer (disabled on reduced motion). Session state lives in `useState` only (no localStorage resume).
  - Final submit calls `completeQuizTaskAction({token, answers})` → toast; router.refresh; show pass/fail screen with "Play again (after cooldown if 24h)".
  - Fix old duplicated `border-apron-pink` wrong-answer CSS class.
- **Acceptance Criteria Addressed**: AC-3, AC-13, AC-14, AC-15
- **Test Requirements**:
  - `rule` TR-5.1: `STATIC_QUIZ` constant removed from source; quiz uses Firestore questions
  - `rule` TR-5.2: Wrong answer styling has only ONE `border-apron-pink` class (no duplicate); grep for the duplicated pattern matches 0
  - `rule` TR-5.3: Quiz flow client has `useState` session only; no localStorage session read/write detected (grep localStorage under quiz folder → 0)
  - `rubric` TR-5.4: Design/UX fidelity; scale 1-5; threshold >= 4
  - `rubric` TR-5.5: A11y coverage; scale 1-5; anchors 1=no labels, 3=labeled but no aria-live, 5=labels everywhere + aria-live on correct/incorrect toast + reduced motion honored; threshold >= 4
- **Notes**: Eliminate the hardcoded `quizzes[0]` first-task-only pick — list ALL available quizzes.

## Task 6: History page rewrite (cursor pagination, filters, CSV export, discriminated Row narrowing)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - Server `history/page.tsx` calls `listHistoryActionWithFilters` returning initial 20 rows + cursor; passes Row discriminated union (earnings+withdrawals) properly typed with `kind`.
  - Client `_components/HistoryToolbar.tsx`: source chips, date-from/date-to, withdrawal-status select, "Export CSV" button uses shared `generateCsv(rows)` with Blob download.
  - Client "Load more" with cursor; hides when cursor null.
  - Remove all `(it as any).amount` casts; narrow via `if (it.kind === 'earning')`.
  - Add deep-links: withdrawal rows → `/wallet/receipt/[wdId]` for paid ones; earning rows link to appropriate page as per FR-4.3.
  - Add optional running-total column on wide screens.
- **Acceptance Criteria Addressed**: AC-7, AC-8, AC-13, AC-14
- **Test Requirements**:
  - `rule` TR-6.1: Grep history folder for `as any` → 0 matches; every amount access goes through discriminated `kind` narrow
  - `rule` TR-6.2: Pagination first 10 rows → cursor, next page uses cursor; server returns rows with ids > lastId correctly
  - `rule` TR-6.3: Export CSV yields valid blob with matching row count (headers + 30 rows = 31 lines when split)
  - `rubric` TR-6.4: Responsive toolbar layout; threshold >= 4; scale 1-5 (1=overflow, 5=wraps perfectly)
- **Notes**: Keep Row types compatible with recent dashboard activity section (do not break the dashboard).

## Task 7: Validation harnesses (`scripts/test-earning-system.ts`) + reconciliation script
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 4, Task 5, Task 6
- **Description**:
  - Create `scripts/test-earning-system.ts`: uses tsx, imports env, uses admin firestore (or server action modules that accept injected `session_uid` overrides in test mode — or a harness that directly exercises helper functions for those that cannot be called without HTTP session cookie). Must cover H1–H8 in FR-7 exactly.
  - Create `scripts/reconcile-user.ts <uid>`: load user + all earnings + all withdrawals; sum up; print PASS/FAIL with deltas.
  - Create `scripts/test-hourly-math.ts`: dedicated small harness that calls `projectUserAccrualBalance` 100x for different inputs and validates the projection set matches the worker helper for the same inputs (exact credit totals).
  - Harnesses exit codes: 0 = all cases PASS, 1 = any FAIL; every case prints case id `H#` + name + PASS/FAIL.
- **Acceptance Criteria Addressed**: AC-1 through AC-9, AC-12
- **Test Requirements**:
  - `rule` TR-7.1: Running `npx tsx scripts/test-earning-system.ts` with proper env prints 8 PASS lines (H1-H8) and exits 0
  - `rule` TR-7.2: `scripts/reconcile-user.ts <uid>` after H1-H8 transactions prints PASS (balance matches)
  - `rule` TR-7.3: `test-hourly-math` 100 random fixtures → 0 mismatches between projected & actual worker helper math
- **Notes**: Server actions that require session cookies need test-exposed variants via a `verifySessionCookie` override OR use helper functions that accept uid directly. Prefer the latter (testing pure helpers) to avoid HTTP overhead. Keep `use server` on the public action; extract the logic to a pure helper for testing.

## Task 8: Build hygiene pass + regression check
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 4, Task 5, Task 6, Task 7
- **Description**:
  - Fix any new TypeScript strict errors surfaced by `tsc --noEmit` (typically `userId` optionality, env var typings in `types/env.d.ts` for `HMAC_SECRET`, `WORKER_TOKEN`; add them to `env.d.ts` if missing).
  - Fix any lint errors from `next lint` (enforce consistent return paths; no React-in-render side effects; no unused imports).
  - Smoke test browser snapshots via dev server: open /tasks, /quiz, /history, click at least one button each, confirm no JS errors in console.
  - Confirm server-only boundary: no admin SDK import exists in any client-marked component under `_components` (grep scan).
- **Acceptance Criteria Addressed**: AC-10, AC-11
- **Test Requirements**:
  - `rule` TR-8.1: `npm run build` exit 0
  - `rule` TR-8.2: `npm run typecheck` exit 0
  - `rule` TR-8.3: `npm run lint` exit 0 with 0 warnings
  - `rule` TR-8.4: Grep for `getAdminDb|firebase-admin|server-only` in `src/**/_components/**` and client files → 0 matches
  - `rubric` TR-8.5: Diff hygiene and type safety coverage; scale 1-5; anchors 1=new any/ts-ignore, 3=1-2 unavoidable casts, 5=zero new `any`/`@ts-ignore`; threshold >= 4
- **Notes**: This task captures any remaining breakages after the other tasks finish. Cannot be done in parallel.
