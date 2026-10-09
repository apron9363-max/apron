# Phase 7 — Firebase Security Rules & Database Seed Script — Implementation Plan

## Task 1: Update firestore.rules with granular access controls for users, withdrawals, plans collections
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Review existing `firestore.rules` for correctness against the new spec.
  - Update `/users/{userId}` match: ensure `update` rule blocks protected fields (role, balance, taskBalance, plan, emailVerified, status) for standard users; admins retain full update/delete.
  - Update `/withdrawals/{wdId}` match: split `create` into standard-user (own userId + status=pending) vs admin (any userId/status); preserve admin-only update/delete; enforce active status for standard users; keep read as own-or-admin.
  - Update `/plans/{planId}` match: change `allow read` from `if true` to `if isSignedIn() && (resource.data.active == true || isAdmin())`; keep admin-only write.
  - Verify catch-all `match /{document=**} { allow read, write: if false; }` is the final rule.
  - Validate rules syntax by ensuring the file still parses as valid Rules v2 via static inspection (helper functions reused correctly, no undefined symbols).
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5
- **Test Requirements**:
  - `rule` TR-1.1: `/users/{userId}` read clause requires `userId == uid() || isAdmin()`. Evidence: source grep for the conjunction in the match block.
  - `rule` TR-1.2: `/users/{userId}` update allow-list field difference is a superset of {name, phone, bankDetails, quickLinks, balanceHistory, referralClicks}. Evidence: source of affectedKeys().difference([...]).size() == 0 line.
  - `rule` TR-1.3: `/withdrawals/{wdId}` create permits admin path and standard user pending path. Evidence: source of create clause contains both `(userId == uid() && status=='pending')` and an `|| isAdmin()` branch.
  - `rule` TR-1.4: `/plans/{planId}` read rule requires `isSignedIn()` AND `(resource.data.active == true || isAdmin())`. Evidence: rules source line.
  - `rule` TR-1.5: `/plans/{planId}` write rule is admin-only. Evidence: `allow write: if isAdmin();` line present.
  - `rule` TR-1.6: Catch-all deny exists at end. Evidence: final match block source.
  - `rubric` TR-1.7: Rules readability / helper-function reuse; scale 1-5; anchors 1=duplicated logic, no helpers; 3=helpers used but some duplication across matches; 5=all repeated logic is DRY via isSignedIn/uid/userDoc/isAdmin helpers with no inline duplication; threshold >= 4. Evidence: source inspection.

## Task 2: Rewrite seed-plans.ts with Basic/Premium/Enterprise tiers, idempotency, and structured error handling
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Delete or overwrite existing `scripts/seed-plans.ts`.
  - Add `dotenv` load of `.env.local` at top of script.
  - Define canonical `PLANS: PlanDoc[]` with IDs `basic`, `premium`, `enterprise` and matching names. Populate sensible price (0 for Basic, mid for Premium, high for Enterprise) and hourlyRate, features, active=true, createdAt/updatedAt placeholders.
  - Create a `main()` function that:
    1. Tries `getAdminApp()` → on failure (catch) print SDK-init error message with env var names required → exit(2).
    2. Tries a no-op Firestore reachability probe (`db.collection('plans').limit(0).get()` or equivalent) → on failure print DB reachability error + Firebase code → exit(3).
    3. Iterates the 3 canonical plans, for each:
       - Reads existing doc `ref.get()`.
       - If missing: build create-data (createdAt=now, updatedAt=now), call `ref.create()`, log "CREATED".
       - If exists: compare existing fields (name, price, hourlyRate, features, active) with canonical. If different, build update-data (preserve createdAt, set updatedAt=now), call `ref.update()`, log "UPDATED". If identical, log "SKIPPED (no changes)".
       - If any single-plan write throws, add to failure list and continue loop.
    4. After loop: if failure list non-empty → log each failure (plan ID + message) → exit(4).
    5. Else → log summary "[seed:plans] Done: N created / M updated / K skipped" → exit(0).
  - Use `console.log` for info, `console.error` for errors only. Never log env vars or private key material.
  - Export nothing; use IIFE `main().catch(...)` that prints unhandled then `process.exit(1)`.
- **Acceptance Criteria Addressed**: AC-6, AC-7, AC-8, AC-16
- **Test Requirements**:
  - `rule` TR-2.1: Canonical plan IDs are exactly `basic`, `premium`, `enterprise`. Evidence: source of PLANS array.
  - `rule` TR-2.2: Three-way create/update/skip branch exists per plan. Evidence: source code inspection.
  - `rule` TR-2.3: Four distinct `process.exit(N)` calls with N ∈ {0, 2, 3, 4}. Evidence: grep for `process.exit` in the script.
  - `rule` TR-2.4: `dotenv.config({ path: ".env.local" })` or equivalent is called before `getAdminApp()`. Evidence: source order.
  - `rule` TR-2.5: Script imports `getAdminDb/getAdminApp` from existing shared `src/lib/firebase/admin.ts` barrel. Evidence: import line.
  - `rubric` TR-2.6: Error message quality; scale 1-5; anchors 1=stack dumps only; 3=human messages but missing remediation hints; 5=every error message includes failure cause + entity ID + suggested fix; threshold >= 4. Evidence: source strings.

## Task 3: Verify / update package.json seed:plans script
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - Inspect existing `package.json` scripts block.
  - If `seed:plans` already equals `tsx scripts/seed-plans.ts` → leave as-is (mark evidence of existence).
  - If missing or pointing to different path → update to `"seed:plans": "tsx scripts/seed-plans.ts"`.
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `rule` TR-3.1: `scripts.seed:plans` matches `tsx scripts/seed-plans.ts`. Evidence: package.json source.

## Task 4: Create rules test harness scripts/test-firestore-rules.ts with 10+ test cases
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1 (reads firestore.rules for static assertions)
- **Description**:
  - Create `scripts/test-firestore-rules.ts`.
  - Add dotenv `.env.local` load at top.
  - Import admin helpers `getAdminApp`, `getAdminDb`, `getAdminAuth` from shared barrel.
  - Implement a small typed test framework within the file:
    - `type Case = { id: string; title: string; expect: "ALLOW" | "DENY"; run: () => Promise<"ALLOW" | "DENY" | "SKIP"> };`
    - `const cases: Case[] = [];` array of 12+ cases (to satisfy 10+ minimum with headroom).
    - A runner that awaits each case; on mismatch prints `[FAIL] TC-n … expected X got Y`; on match prints `[PASS] TC-n title`; prints totals at end and exits accordingly.
  - Fixture setup:
    - In a `setupFixtures()` function, create via Admin SDK:
      - `__test_alice` user doc (role=user, status=active, uid=alice).
      - `__test_bob` user doc (role=user, status=active, uid=bob).
      - `__test_admin01` user doc (role=admin, status=active, uid=admin01).
      - `__test_wd_alice_01` withdrawal (userId=alice, status=pending, amount=1000, fee=0, netAmount=1000, bankDetails=..., createdAt=now).
      - `__test_wd_admin_created` withdrawal (userId=bob, status=paid, createdAt=now) — created by admin flow.
      - `__test_plan_basic` plan doc (id=__test_plan_basic, name="Basic Test", active=true).
      - `__test_plan_legacy` plan doc (id=__test_plan_legacy, name="Legacy Archived", active=false).
  - Tier A (Static assertions on firestore.rules file content):
    - TC-1: Unauth read users rules clause present.
    - TC-2: Unauth read plans rule blocked (rule contains isSignedIn check on /plans read).
  - Tier B (Behavioral assertions via Admin SDK get/set against emulator or live DB with try/catch on PERMISSION_DENIED):
    - TC-3: Alice self read ALLOW → get doc(__test_alice) via admin then emulate by running a direct fetch against emulator; if emulator unavailable fall back to static rule inspection but mark SKIP with note.
    - TC-4: Alice cross-user read Bob → DENY expected.
    - TC-5: Alice update own role to admin → DENY expected (try update via set/merge; if emulator unavailable, statically verify update clause's affectedKeys allow-list excludes role).
    - TC-6: Alice create withdrawal for userId=bob → DENY expected (via rule content static check if emulator missing).
    - TC-7: Alice create withdrawal for herself with status=pending → ALLOW expected.
    - TC-8: Alice update her withdrawal to paid → DENY expected.
    - TC-9: Admin create a plan → ALLOW expected.
    - TC-10: Standard user (Alice) create a plan → DENY expected.
    - TC-11: Alice read active plan (basic_test) → ALLOW.
    - TC-12: Alice read inactive legacy → DENY; Admin read same → ALLOW (two assertions under one case).
    - TC-13: Admin approve Alice's withdrawal (update status to paid) → ALLOW.
    - TC-14: Unauthenticated withdrawal read → DENY (static rule check).
  - Implement `teardownFixtures()` in a `finally` block that deletes every fixture document using Admin SDK `ref.delete()` wrapped in individual try/catch so one failed delete does not skip others.
  - Emulator detection: at start print host env var status; when unset mark all Tier B behavioral assertions `[SKIP]` but still count Tier A cases toward pass/fail.
- **Acceptance Criteria Addressed**: AC-10, AC-11, AC-12, AC-13
- **Test Requirements**:
  - `rule` TR-4.1: `cases.length >= 10` static assertion at top of runner throws if violated. Evidence: source of runner function.
  - `rule` TR-4.2: Setup/Teardown wrap run in try/finally. Evidence: try/finally source.
  - `rule` TR-4.3: Totals line printed before exit: "Passed X/Y, Failed Z". Evidence: source of summary print.
  - `rule` TR-4.4: Exit code 0 if all pass, else 1. Evidence: `process.exit(Z === 0 ? 0 : 1)`.
  - `rubric` TR-4.5: Coverage of identity matrix (unauth, Alice, Bob, admin) across all three target collections; scale 1-5; anchors 1=1 identity tested; 3=3 identities tested; 5=all 4 identities × all 3 collections have at least one case each; threshold >= 4. Evidence: case matrix in source.

## Task 5: Run build/lint/typecheck, seed script idempotency, and rules harness; capture evidence
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4
- **Description**:
  - Run `npm run build && npm run typecheck && npm run lint` sequentially; capture exit codes.
  - If Admin SDK env vars are available (check process.env after dotenv):
    - Run seed script TWICE; capture both logs.
    - Verify three plan docs exist with correct IDs; compare `updatedAt` between runs (no change expected).
    - Run the rules harness; capture output.
  - If env vars / emulator unavailable, document the SKIP reason in task completion evidence and rely on Tier A static passes + source correctness.
  - For Task 2 evidence on Windows, run via `npm run seed:plans` in PowerShell.
  - For AC-14 end-to-end idempotency, if emulator is running, run against emulator; else perform static analysis only.
- **Acceptance Criteria Addressed**: AC-6, AC-14, AC-15, AC-12, AC-13
- **Test Requirements**:
  - `rule` TR-5.1: Build, lint, typecheck each exit 0. Evidence: captured terminal log lines.
  - `rule` TR-5.2: If env vars available: seed-run-1 shows 3 CREATED lines; seed-run-2 shows 3 SKIPPED lines; both runs exit 0. Evidence: terminal output blocks.
  - `rule` TR-5.3: Rules harness output shows totals line with Z failures == 0. Evidence: terminal output block.
  - `rubric` TR-5.4: Completeness of evidence (logs exist for every performed step; SKIPs are justified; gap analysis is explicit); scale 1-5; anchors 1=no evidence beyond "trust me"; 3=partial logs but some steps missing; 5=every enumerated step has a log block with timestamps; threshold >= 4. Evidence: completion evidence section content.
