# Phase 7 — Firebase Security Rules & Database Seed Script — Product Requirements Document

## Overview
- **Summary**: Implement production-grade Firestore security rules with granular role-based access controls across the `users`, `withdrawals`, and `plans` collections, plus an idempotent Admin-SDK-powered seed script that populates the `plans` collection with three default tiers (Basic, Premium, Enterprise) and a TypeScript-based security rules test harness with 10+ coverage cases verified against the Firebase Local Emulator Suite.
- **Purpose**: Harden the Firestore data plane so standard users cannot escalate privileges or read cross-user data, admins cannot be impersonated via client writes, plan configuration is admin-only, and new deployments reliably receive a consistent default plan catalog without duplicates.
- **Target Users**: Platform maintainers (deploy operators), admin role holders (approving withdrawals, editing plans), standard authenticated end users, and unauthenticated visitors (must be locked out of all protected paths).

## Goals
- Enforce uid-own-read/write + admin-escalation-only for the `users` collection; block every non-admin cross-user read and write.
- Gate withdrawal *updates/approvals* to admins while preserving standard users' ability to CREATE their own pending withdrawals and READ their own history.
- Restrict `plans` collection writes exclusively to admin users; grant authenticated users read-only access to **active** plan documents only; unauthenticated reads on `plans` are blocked.
- Deliver an idempotent seed script (`scripts/seed-plans.ts`) that inserts/updates exactly three plans (Basic / Premium / Enterprise) using deterministic IDs, never duplicates, reports every failure case, and exits non-zero on unrecoverable errors.
- Add an npm script `seed:plans` that runs the seed script via tsx.
- Ship a typed rules test harness with 10+ test cases covering: unauthenticated, standard user A, standard user B, and admin identities against each collection, exercising both allow and deny paths.
- Perform an end-to-end validation pass that asserts cross-user isolation, admin-only plan mutation, and first-run seed idempotency.

## Non-Goals
- Adding Storage Rules or Realtime Database Rules (scoped to Firestore only).
- Writing Cloud Functions triggers to enforce rules server-side (rules must be declarative only).
- Installing a new test runner such as Jest or Vitest; the rules harness is a standalone tsx script that either uses the Local Emulator REST API or, if an emulator is unavailable, performs static rule analysis plus Admin-SDK-level behavioral validation against a live test project with cleanup.
- Seeding users, tasks, settings, or any collection other than `plans`.
- Introducing role=admin provisioning via the seed script (admin promotion remains a manual Admin SDK operation documented in the report).

## Background & Context
The repository currently ships a `firestore.rules` file at project root that already approximates some of these boundaries but has three material gaps:
1. `/plans/{planId}` currently `allow read: if true`, which leaks plan data (including inactive/archived plans) to unauthenticated visitors. Requirements specify authenticated-only access to **active** plans.
2. `/withdrawals/{wdId}` `create` rule requires `request.resource.data.userId == uid()`, which prevents an admin from creating a withdrawal record on a user's behalf (e.g., manual bank-transfer processing entry).
3. No rules-level guard prevents standard users from reading inactive `plans` documents.

The existing seed script `scripts/seed-plans.ts` uses three plan IDs (`starter` / `pro` / `elite`) with names that do not match requirements ("Basic / Premium / Enterprise"); it also lacks structured error handling for DB connection failures, per-document write-failure reporting, and explicit idempotency logging (uses `set(…, { merge: true })` without reporting "skipped / updated / created").

The project already depends on:
- `firebase-admin@12.6.0` (Admin SDK for seeding)
- `firebase@10.14.1` (client SDK for rules tests if emulator is reachable)
- `tsx@4.19.1` (for script execution)
- `dotenv@16.6.1` (already a dev dependency for env loading)
- Existing npm scripts: `seed:plans` already maps to `tsx scripts/seed-plans.ts` (needs verification after script rewrite).

The rules testing strategy: we ship a `scripts/test-firestore-rules.ts` TypeScript harness that performs two tiers of validation:
- **Tier A (Static)**: Parses `firestore.rules`, enumerates matchers, and asserts that every required clause is present (e.g., `/plans` read requires `isSignedIn()` AND `resource.data.active == true` or `isAdmin()`).
- **Tier B (Behavioral)**: If the Firebase Local Emulator Suite is running (`FIRESTORE_EMULATOR_HOST` set), it uses the Admin SDK against the emulator to seed fixtures and exercises client-write scenarios using the emulator's rules evaluation. If the emulator is unavailable, Tier B is marked skipped with clear instructions.

All ACs treat Tier A as required and Tier B as strongly recommended; the task itself records the emulator status as a note rather than a hard failure.

## Functional Requirements

### FR-1 Users collection — uid-own-only for standard users, admin escalation allowed
- **FR-1.1 Standard user reads**. A standard authenticated user with `uid=A` MUST be allowed to read `users/A` and MUST be blocked from reading `users/B`.
- **FR-1.2 Standard user writes (create)**: A standard user MUST be allowed to create only `users/{their own uid}`. The document being created MUST have `uid` field equal to `request.auth.uid`.
- **FR-1.3 Standard user writes (update)**: A standard user MUST be allowed to UPDATE only their own document, and only for a field-level allow list: `name`, `phone`, `bankDetails`, `quickLinks`, `balanceHistory`, `referralClicks`. All other fields (including `role`, `balance`, `taskBalance`, `plan`, `emailVerified`, `status`) MUST be blocked from client-side writes by standard users.
- **FR-1.4 Admin reads/writes**: Any user whose `users/{uid}.role == 'admin'` MUST be allowed to read any user document and update/delete any user document (no field restrictions on admin updates).
- **FR-1.5 Unauthenticated users**: All reads/writes on `/users` MUST be denied when `request.auth == null`.
- **FR-1.6 Status gating**: Banned users (`status == 'banned'`) MUST be blocked from performing ANY update on their own document; read MAY still be permitted so the app can display a "banned" screen.

### FR-2 Withdrawals collection — standard user create-own + read-own; admin create/update/approve/delete any
- **FR-2.1 Standard user reads**: Standard user uid=A MUST be allowed to read `withdrawals/{id}` only when `resource.data.userId == A`.
- **FR-2.2 Standard user create**: Standard user uid=A MUST be allowed to CREATE a new withdrawal document only when `request.resource.data.userId == A` AND `request.resource.data.status == 'pending'`. All other fields are permitted within the created document but no status other than 'pending' is allowed at creation time from a standard user.
- **FR-2.3 Admin reads**: Admin MUST be allowed to read ALL withdrawal documents regardless of owner.
- **FR-2.4 Admin create**: Admin MUST be allowed to CREATE withdrawal documents with ANY userId and ANY initial status (pending/paid/rejected). Supports manual entry for reconciliation flows.
- **FR-2.5 Admin update / approve / reject**: Admin MUST be allowed to UPDATE any withdrawal document including changing `status` to `paid` or `rejected`, setting `rejectReason`, `processedAt`, `transactionId`, `note`. Standard users MUST NOT be allowed to UPDATE any withdrawal document at all (not even their own; the client is expected to create new rows, not mutate submitted ones).
- **FR-2.6 Admin delete**: Admin MUST be allowed to DELETE any withdrawal document. Standard users MUST NOT delete any.
- **FR-2.7 Unauthenticated users**: All reads/writes on `/withdrawals` MUST be denied when `request.auth == null`.

### FR-3 Plans collection — admin write-only; authenticated read-only to active documents
- **FR-3.1 Authenticated user reads**: Any signed-in user (standard or admin) MUST be allowed to READ a plan document IF `resource.data.active == true`.
- **FR-3.2 Admin reads**: Admin MUST additionally be allowed to READ inactive / archived plan documents (`active == false`).
- **FR-3.3 Unauthenticated reads**: All reads on `/plans` MUST be denied when `request.auth == null` (no catalog disclosure to anonymous visitors).
- **FR-3.4 Admin writes**: Admin MUST be allowed to create, update, archive (`active=false`), and delete plan documents.
- **FR-3.5 Standard user writes**: Standard users MUST be denied all write operations (create/update/delete) on `/plans`.
- **FR-3.6 Field restrictions**: On update operations by admin, `updatedAt` and `updatedBy` are optional at the rules layer (enforced at the application layer via server actions); rules do not block writes missing these fields.

### FR-4 Plan seed script — idempotent, error-handled, Admin-SDK-based
- **FR-4.1 Plan catalog**: Exactly three deterministic-id plans MUST be seeded. IDs and names:
  - `id: "basic"`, `name: "Basic"` (free tier)
  - `id: "premium"`, `name: "Premium"` (mid tier)
  - `id: "enterprise"`, `name: "Enterprise"` (top tier)
  Each `PlanDoc` MUST include fields `id`, `name`, `price`, `hourlyRate`, `features[]`, `active: true`, `createdAt`, `updatedAt`. Price and rate values are sensible business defaults (documented in the script source; no external config required).
- **FR-4.2 Idempotency**: Re-running the seed script MUST NOT result in duplicate plan documents. The script MUST read each doc first and choose the correct behavior per plan:
  - If doc does not exist: CREATE it with `createdAt = updatedAt = now`.
  - If doc exists AND differs from canonical (comparing `name`, `price`, `hourlyRate`, `features`, `active`): UPDATE it, preserving `createdAt` from the existing document and setting `updatedAt = now` (upsert-with-diff semantics).
  - If doc exists AND matches canonical exactly: SKIP writing and emit a clear "no change" log line.
- **FR-4.3 Error handling**: The script MUST handle the following failure cases distinctly:
  - Admin SDK initialization failure (missing env vars) → print actionable setup guidance and exit code 2.
  - Firestore unreachable (network / permissions) → log the specific Firebase error code + a human summary and exit code 3.
  - Per-document write failure for 1 or more of the 3 plans → continue processing remaining plans, then after loop, log the list of failures and exit code 4.
  - Success (all 3 plans handled without error) → exit code 0.
- **FR-4.4 Secure access**: The seed script MUST use the project's existing `getAdminApp()` / `getAdminDb()` helpers from `src/lib/firebase/admin.ts` (which already enforce `server-only` and env-derived credentials). The script MUST NOT embed or hardcode any credential strings.
- **FR-4.5 Dotenv loading**: If a `.env.local` file exists, the script MUST load it via `dotenv` before Admin SDK initialization so operators can run `npm run seed:plans` with the same env config as the Next.js app.
- **FR-4.6 npm script**: `package.json` MUST expose `"seed:plans": "tsx scripts/seed-plans.ts"` (check existing; update if script path changes). Running `npm run seed:plans` MUST be the canonical invocation.

### FR-5 Security rules test harness — 10+ cases
- **FR-5.1 Coverage requirement**: The test script MUST contain at least 10 test cases (`TC-1…TC-10+`). Each case has a stable identifier, descriptive title, expected verdict (ALLOW / DENY), actor identity, collection, operation, and document/seed context.
- **FR-5.2 Identity matrix**: Cases MUST exercise four identity classes: unauthenticated, standard user A (uid=alice, role=user), standard user B (uid=bob, role=user), and admin (uid=admin01, role=admin).
- **FR-5.3 Required cases (10 minimum)**:
  1. Unauthenticated read `/users/alice` → DENY.
  2. Unauthenticated read `/plans/basic` → DENY.
  3. Alice reads `/users/alice` → ALLOW.
  4. Alice reads `/users/bob` → DENY (cross-user).
  5. Alice tries to UPDATE her own `role` to admin → DENY (protected field).
  6. Alice tries to CREATE a withdrawal for userId=bob → DENY (cross-user create).
  7. Alice CREATEs her own withdrawal with status=pending → ALLOW.
  8. Alice tries to UPDATE her withdrawal status from pending→paid → DENY (admin-only update).
  9. Admin CREATEs a plan `/plans/test-plan` → ALLOW.
  10. Standard user Alice tries to CREATE `/plans/test-plan` → DENY.
  11. Standard user Alice reads `/plans/basic` (active=true) → ALLOW.
  12. Standard user Alice reads `/plans/legacy` (active=false) → DENY; admin READ of same → ALLOW.
- **FR-5.4 Harness output**: Each case MUST print `[PASS] TC-N title` or `[FAIL] TC-N title: expected DENY/ALLOW but got ...`. On completion, print a totals line `Passed X/Y, Failed Z` and exit 0 if Z=0 else 1.
- **FR-5.5 Fixture cleanup**: The harness MUST create fixture docs (users, plans, withdrawals) using the Admin SDK with deterministic IDs using a `__test_` prefix and MUST delete them at the end of the run (in a `finally` block) so no data leaks into production.
- **FR-5.6 Emulator mode**: If `process.env.FIRESTORE_EMULATOR_HOST` is set, the harness explicitly logs `[INFO] Running against Firestore emulator at ${host}` and operates against it. If unset, the harness runs in Admin-SDK + static-assertion mode and clearly marks Tier B checks as `[SKIP]` with instructions to run `firebase emulators:start --only firestore`.

### FR-6 End-to-end validation report (deliverable: test report in terminal output + review artifact)
- **FR-6.1 Cross-user isolation**: Given Alice and Bob fixture users, run the rules harness and confirm every cross-user read/write is denied.
- **FR-6.2 Admin-only plan mutation**: Confirm admin can create/edit a plan, Alice cannot.
- **FR-6.3 Seed idempotency**: Run the seed script twice against a clean emulator. After run 1: 3 plans exist (basic, premium, enterprise). After run 2: still exactly 3 docs, `updatedAt` of unchanged docs matches original (no writes occurred).
- **FR-6.4 Deliverable report**: A structured terminal pass is sufficient; the `Completeness Evidence` column in `tasks.md` MUST capture actual command output.

## Non-Functional Requirements
- **NFR-1 (Rules correctness)**: Every match clause in `firestore.rules` MUST have a corresponding test case in the rules harness (1:1 coverage for top-level collections `users`, `withdrawals`, `plans`). Catch-all `match /{document=**} { allow read, write: if false; }` MUST remain as the final fallback (deny by default).
- **NFR-2 (Security best practices)**: Rules use helper functions `isSignedIn()`, `uid()`, `userDoc()`, `isAdmin()`, `isActive()` that cache the same lookups; rules never trust `request.resource.data.role == 'admin'` as a permission check — admin verification MUST go through the actual existing user doc via `userDoc().data.role`.
- **NFR-3 (Type safety)**: Seed script and rules test script MUST be TypeScript modules passing `tsc --noEmit` against the project's existing `tsconfig.json`. No `any` types beyond the minimum required for Firebase error-code inspection.
- **NFR-4 (Build hygiene)**: After all changes, `npm run build && npm run typecheck && npm run lint` MUST exit 0.
- **NFR-5 (Reproducibility)**: Seed script uses canonical constants exported at the top of the file; re-running produces byte-identical plan data for unchanged plans.
- **NFR-6 (Error message quality)**: Every error path in both the seed script and the test harness prints a message that includes (a) what failed, (b) which input/entity caused it, and (c) suggested fix when known.
- **NFR-7 (Environment safety)**: Neither script writes credentials or plan values to stdout that could be captured in CI logs; only IDs, statuses, and non-secret counts are printed.

## Constraints
- **Technical**: Firebase Security Rules v2 (`rules_version = '2';` header preserved). Firestore in Datastore-mode customers are out of scope; this is Native mode only. The Admin SDK pattern in `src/lib/firebase/admin.ts` MUST be used as-is; no credentials should be duplicated inside `scripts/`.
- **Business**: Plan tier names are **strictly** Basic / Premium / Enterprise. Any legacy Starter/Pro/Elite documents from the old seed script are explicitly NOT removed (operator may archive manually); idempotency checks only the three new IDs.
- **Dependencies**: Allowed new **devDependencies**: none required beyond what's installed (tsx, dotenv, firebase, firebase-admin are already present). Allowed new runtime deps: none.
- **Portability**: Scripts run on Windows (NTFS) and Unix shells; path handling uses Node's `path.resolve` and avoids shell-specific syntax; tsx shebangs are not required.

## Assumptions
- The Firebase Local Emulator Suite is available as an optional extra; if missing, the static Tier A assertions + Admin SDK behavioral checks serve as the verification baseline, and Tier B cases are reported as `[SKIP]` without failing the overall test suite.
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` are present in `.env.local` (per `.env.example` already committed) for seed-script runs against a real project; the seed script degrades gracefully with a clear exit code if these are absent.
- Admin promotion for test users happens via Admin SDK inside the harness itself (setting `role='admin'` on the `__test_admin01` fixture document) — no pre-existing admin account is required.
- The project-memory rule "Wrap `useSearchParams()` calls in Suspense" and other React/Next-specific constraints do not apply to this Phase since all deliverables are backend scripts and declarative rules files.

## Open Questions
- [x] Plan names enforced to Basic/Premium/Enterprise; legacy Starter/Pro/Elite left in place but not referenced by new seed.
- [x] Rules testing strategy: tsx-based harness with Tier A (static assertions) + Tier B (emulator if available); no new Jest/Vitest deps per project-memory guidance.
- [x] Plans read access for standard users is restricted to `active == true` plans only; admins see all.

## Acceptance Criteria

### AC-1: Standard user cannot read or write cross-user documents in `users` collection
- **Type**: `rule`
- **Given**: Two standard users Alice (uid=alice) and Bob (uid=bob) exist in `users`
- **When**: Alice attempts to (a) read `users/bob`, (b) update `users/bob`, (c) create `users/bob`, (d) delete `users/bob`
- **Then**: All four operations are rejected with a PERMISSION_DENIED-class error; Alice's own read/write operations against `users/alice` (within field allow-list) are permitted
- **Pass Condition**: Rules test harness TC-4 (Alice reads Bob) FAIL is marked `[PASS]`, plus Alice self-read TC-3 is `[PASS]`; source of `firestore.rules` contains the `userId == uid() || isAdmin()` clause on `/users/{userId}` match
- **Evidence**: Harness terminal log + rules file diff

### AC-2: Standard user cannot escalate role or modify protected fields on own user document
- **Type**: `rule`
- **Given**: Standard user Alice exists with `role=user, balance=0`
- **When**: Alice's client tries to update `{ role: 'admin' }`, `{ balance: 999999 }`, `{ plan: 'elite' }`, `{ status: 'active' }` respectively
- **Then**: All four updates are DENIED at the rules layer due to field-level allow-list `affectedKeys().difference([...]).size() == 0`
- **Pass Condition**: TC-5 harness case reports PASS; rules source for `/users/{userId}` update clause restricts to the explicit field set
- **Evidence**: Harness output + `/users` rules clause source

### AC-3: Withdrawals collection enforces standard create-own-pending + read-own; admin update/approve/delete all
- **Type**: `rule`
- **Given**: Withdrawal document owned by Alice (id=wd_alice_01, userId=alice, status=pending) exists; Admin user exists
- **When**:
  (a) Alice reads wd_alice_01 → ALLOW, Bob reads wd_alice_01 → DENY
  (b) Alice creates withdrawal with userId=alice, status=pending → ALLOW
  (c) Alice creates withdrawal with userId=bob → DENY (TC-6)
  (d) Alice updates status to paid → DENY (TC-8)
  (e) Admin updates status to paid → ALLOW
  (f) Admin deletes wd_alice_01 → ALLOW
- **Then**: All outcomes match the annotated verdict
- **Pass Condition**: Harness cases TC-6, TC-7, TC-8 PASS plus three Admin cases (read-all, update-status, delete) PASS
- **Evidence**: Rules test harness terminal output

### AC-4: Plans collection enforces admin writes + authenticated active-only reads; unauthenticated blocked
- **Type**: `rule`
- **Given**: `plans/basic` with active=true exists; `plans/legacy` with active=false exists; Admin and standard user Alice exist
- **When**:
  (a) Unauthenticated reads /plans/basic → DENY (TC-2)
  (b) Alice reads /plans/basic → ALLOW (TC-11)
  (c) Alice reads /plans/legacy (active=false) → DENY (TC-12)
  (d) Admin reads /plans/legacy → ALLOW
  (e) Admin creates a plan → ALLOW (TC-9)
  (f) Alice creates a plan → DENY (TC-10)
- **Then**: All outcomes match the annotated verdict
- **Pass Condition**: All six sub-cases PASS in the rules harness output
- **Evidence**: Harness output + firestore.rules `/plans` clause source showing `allow read: if isSignedIn() && (resource.data.active == true || isAdmin())` and `allow write: if isAdmin()`

### AC-5: Catch-all deny-by-default preserved
- **Type**: `rule`
- **Given**: A document path not matched by any explicit collection rule (e.g., `/unknownCollection/doc`)
- **When**: Any authenticated or unauthenticated read/write is attempted
- **Then**: DENY
- **Pass Condition**: Final clause of `firestore.rules` is `match /{document=**} { allow read, write: if false; }`
- **Evidence**: Static source inspection

### AC-6: Seed script produces exactly three plans with correct IDs and idempotency on re-run
- **Type**: `rule`
- **Given**: Clean Firestore project (or emulator) where `plans/basic`, `plans/premium`, `plans/enterprise` do not exist
- **When**:
  (a) `npm run seed:plans` is executed (run 1)
  (b) Operator inspects Firestore — counts docs in `plans` whose ID ∈ {basic, premium, enterprise}
  (c) `npm run seed:plans` is executed again (run 2) without any edits
- **Then**:
  (a) Run 1 exit code = 0; logs show "CREATED plan: basic", "CREATED plan: premium", "CREATED plan: enterprise"
  (b) Exactly 3 matching documents exist; all have `active=true` and the required fields
  (c) Run 2 exit code = 0; logs show "SKIPPED (no changes)" for all 3 plans; `updatedAt` timestamps are unchanged from run 1
- **Pass Condition**: Terminal logs from two consecutive runs match expected semantics and exit 0 both times; `getAdminDb().collection('plans').count().get()` returns ≥3 with the three required IDs present
- **Evidence**: Seed script source + captured terminal output of two consecutive runs

### AC-7: Seed script error handling yields distinct non-zero exit codes per failure class
- **Type**: `rule`
- **Given**: Three scenarios: (a) Admin SDK env vars missing entirely, (b) wrong credentials (DB unreachable / permission denied), (c) Firestore available but one of three write calls throws a transient error (harnessable via emulator offline toggle or mocking in test)
- **When**: `npm run seed:plans` runs in each scenario
- **Then**: (a) exit code 2 + "SDK init" message; (b) exit code 3 + "DB reachable" Firebase error code; (c) exit code 4 + per-document failure list
- **Pass Condition**: Source of `seed-plans.ts` contains 3 distinct `process.exit(N)` branches with N ∈ {2, 3, 4} and success N=0; a static path analysis of the catch/error-handling blocks shows the branches
- **Evidence**: Seed script source code with the four exit paths clearly marked

### AC-8: Seed script uses deterministic canonical IDs, never duplicates, and logs create/update/skip distinctly
- **Type**: `rule`
- **Given**: Seed script source code
- **When**: Code review
- **Then**: Three const PlanDocs with IDs `basic`, `premium`, `enterprise` are defined; for each, the script reads the current doc, diffs relevant fields, and branches to `db.collection('plans').doc(id).create(...)` OR `update(...)` OR no-write; each branch prints a distinct log prefix `[seed:plans] CREATED | UPDATED | SKIPPED`
- **Pass Condition**: Static inspection of `scripts/seed-plans.ts` reveals the three-way branch and unambiguous IDs
- **Evidence**: Seed script source

### AC-9: npm script `seed:plans` present and invokes tsx against the correct file
- **Type**: `rule`
- **Given**: package.json content
- **When**: Grep for "seed:plans"
- **Then**: scripts.seed:plans === "tsx scripts/seed-plans.ts" (or equivalent with npx)
- **Pass Condition**: package.json source
- **Evidence**: package.json source snippet

### AC-10: Rules test harness contains 10+ cases, prints per-case PASS/FAIL, totals line, and exit codes correctly
- **Type**: `rule`
- **Given**: `scripts/test-firestore-rules.ts` exists
- **When**: `tsx scripts/test-firestore-rules.ts` runs
- **Then**: Terminal output lists ≥10 TC-N lines, each [PASS] or [FAIL]; summary "Passed X/Y, Failed Z" prints; if Z=0 exit code 0 else 1
- **Pass Condition**: Harness source has ≥10 TC entries; captured run output shows ≥10 [PASS] lines and exit 0
- **Evidence**: Harness source + terminal run output

### AC-11: Rules harness fixture cleanup — no `__test_` documents leak after a successful run
- **Type**: `rule`
- **Given**: Harness completed a successful run
- **When**: Query Firestore / emulator for documents with `__test_` prefix in any collection used by the harness
- **Then**: Zero results
- **Pass Condition**: Harness source wraps fixture teardown in `finally {}` block; post-run admin query for `__test_%` IDs is empty
- **Evidence**: Harness source `finally` block + post-run query output

### AC-12: End-to-end cross-user isolation pass
- **Type**: `rule`
- **Given**: Harness fixtures Alice + Bob present; each has a user doc and a withdrawal doc
- **When**: Every cross-user (Alice↔Bob) operation defined in FR-1/FR-2 is executed via the harness
- **Then**: 100% of cross-user operations DENY; zero false ALLOWs
- **Pass Condition**: No "FAIL" lines in the harness output for cross-user cases
- **Evidence**: Captured harness output

### AC-13: End-to-end admin-only plan modification pass
- **Type**: `rule`
- **Given**: Admin fixture and standard-user Alice fixture
- **When**: Admin creates a new plan doc; Alice attempts the same create; Admin updates `plans/basic.active` to false and back to true; Alice attempts to update price
- **Then**: Admin operations ALLOW; standard user operations DENY
- **Pass Condition**: Harness TC-9, TC-10 plus admin update / standard user update scenarios PASS
- **Evidence**: Harness output

### AC-14: End-to-end seed idempotency pass (two consecutive runs)
- **Type**: `rule`
- **Given**: Clean plans collection; operator has valid env vars
- **When**: Run seed twice, capture logs + `updatedAt` timestamps after each
- **Then**: Run 1 creates all 3; run 2 SKIPs all 3; post-run-2 `updatedAt` timestamps equal the post-run-1 timestamps for all three docs
- **Pass Condition**: Terminal logs + Admin SDK get() of the three docs comparing timestamps
- **Evidence**: Captured consecutive-run logs + timestamp diff report

### AC-15: Build, lint, typecheck pass after all changes
- **Type**: `rule`
- **Given**: Repo state after changes
- **When**: `npm run build && npm run typecheck && npm run lint`
- **Then**: Exit code 0 for each
- **Pass Condition**: All three commands exit 0
- **Evidence**: Terminal log

### AC-16: No server-only / credential leakage into script stdout or client code
- **Type**: `rule`
- **Given**: Source of seed script + rules test script
- **When**: Searching for `PRIVATE KEY` / `BEGIN PRIVATE` / hardcoded key strings; checking for `console.log` of credential env vars
- **Then**: Zero occurrences of secrets in code or in stdout-only paths
- **Pass Condition**: Static grep returns nothing; code review of both scripts
- **Evidence**: Grep output of negative matches
