# Phase 8 — Build Fixes / Responsive / Admin Provisioning — Implementation Plan

## Task 1: Build error resolution — create Sheet.tsx component and fix any latent build errors
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Audit the two failing admin pages (admin/plans/page.tsx line 24 Sheet import; admin/tasks/page.tsx line 33 Sheet import) for exact Sheet API usage.
  - Write new file `src/components/ui/Sheet.tsx` mirroring `Modal.tsx` accessibility pattern (focus trap, ESC close, scrim click close, ARIA roles) but with `side` prop anchored (left/right/top/bottom) + slide-in animation matching side. Expose `Sheet` as default export with compound subcomponents `Sheet.Header`, `Sheet.Title`, `Sheet.Body`, `Sheet.Footer` for API compatibility if needed. Signature MUST accept: `open`, `onOpenChange`, `onClose`, `side` (default right), `title`, `description`, `children`, `className`, `size`.
  - Run `npm run build`. If new module-not-found or type errors surface (e.g., other UI components missing), repeat: diagnose → minimal surgical fix → re-run build. Do not alter business logic.
  - Verify `GetDiagnostics` for Sheet.tsx shows 0 errors.
- **Acceptance Criteria Addressed**: AC-A.1, AC-A.2, AC-A.3, AC-NFR.2
- **Test Requirements**:
  - `rule` TR-1.1: `src/components/ui/Sheet.tsx` exists; default export named `Sheet` present.
  - `rule` TR-1.2: Sheet API accepts `{ open, onOpenChange, onClose, side?, title?, description?, children?, className?, size? }` and each of these is consumed in render logic.
  - `rule` TR-1.3: `npm run build` exit code 0; captured output contains no "Module not found" lines.
  - `rule` TR-1.4: Sheet implements focus trap, ESC key close, and scrim click close (Modal.tsx pattern mirrored).
  - `rule` TR-1.5: GetDiagnostics for Sheet.tsx = 0.
  - `rubric` TR-1.6: Sheet visual behavior appropriateness for call sites (version history right drawer). Scale 1-5: 1=breaks existing callers, 3=renders but missing styling, 5=seamless side drawer matching plans-page usage with enter animation; threshold >= 4. Evidence: source inspection.

## Task 2: Tailwind responsive breakpoints alignment and per-page responsive audits (28 pages)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1 (build must pass before responsive tuning)
- **Description**:
  - Step 2a: Update `tailwind.config.ts` to set `theme.extend.screens = { sm: '320px', md: '768px', lg: '1024px', xl: '1440px' }`. Preserve existing theme keys (colors, spacing, keyframes) without changes.
  - Step 2b: Enumerate ALL 28 pages from `src/app/**/page.tsx` glob. For each page:
    1. Check grids: explicit `grid-cols-1` base breakpoint at minimum for content grids; add responsive `sm: md: lg: xl:` col-classes where needed.
    2. Check flex rows: add `flex-col md:flex-row` for any horizontal flex container that would overflow at 320px.
    3. Check wrapping tables: every `<table>` element MUST have a parent div with `overflow-x-auto` (or equivalent).
    4. Check hardcoded pixel widths: replace any `w-96 / w-[400px]` classes without responsive overrides — either `max-w-full` + base `w-full` for mobile, or add `sm:w-[…] lg:w-[…]` breakpoint scaling.
    5. Check forms: standalone forms (login, register, wallet withdraw, settings, plan create, task create, bank) should use `w-full` base class on all Inputs/Buttons at base breakpoint to avoid overflowing phone screens.
    6. Check long inline text rows (user name + email + referral row): add `min-w-0` + `truncate`/`break-all` or wrap flex items so they break to next line, not force container width.
    7. Check admin stat card grids: Overview page tiles grid currently `grid-cols-2 sm:grid-cols-4 lg:grid-cols-4` → change to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4` (more correct stacking on 320px).
  - Step 2c: Add (if missing) `overflow-x-hidden` on root `<body>` in layout to catch any residual overflow.
  - Step 2d: Each page that required edits → apply classes surgically only. No JS logic changes.
- **28 pages list (from glob)**:
  1. src/app/page.tsx — Landing
  2. src/app/(app)/dashboard/page.tsx — User Dashboard
  3. src/app/(app)/tasks/page.tsx — Tasks
  4. src/app/(app)/quiz/page.tsx — Quiz
  5. src/app/(app)/plans/page.tsx — Plans (end-user)
  6. src/app/(app)/history/page.tsx — Earning/Withdrawal history
  7. src/app/(app)/referrals/page.tsx — Referrals
  8. src/app/(app)/wallet/page.tsx — Wallet Overview
  9. src/app/(app)/wallet/withdraw/page.tsx — Withdraw
  10. src/app/(app)/wallet/receipt/[wdId]/page.tsx — Receipt
  11. src/app/(app)/wallet/history/page.tsx — Wallet History
  12. src/app/(app)/settings/page.tsx — User Settings
  13. src/app/(app)/social-monetization/page.tsx
  14. src/app/(app)/skill-academy/page.tsx
  15. src/app/(app)/loans/page.tsx
  16. src/app/(app)/contest/page.tsx
  17. src/app/(auth)/login/page.tsx
  18. src/app/(auth)/register/page.tsx
  19. src/app/(auth)/verify/page.tsx
  20. src/app/(auth)/forgot-password/page.tsx
  21. src/app/(auth)/blocked/page.tsx
  22. src/app/admin/page.tsx — Admin Overview
  23. src/app/admin/users/page.tsx — Admin Users
  24. src/app/admin/users/[uid]/page.tsx — Admin User Detail
  25. src/app/admin/plans/page.tsx — Admin Plans
  26. src/app/admin/tasks/page.tsx — Admin Tasks
  27. src/app/admin/withdrawals/page.tsx — Admin Withdrawals
  28. src/app/admin/settings/page.tsx — Admin Settings
- **Acceptance Criteria Addressed**: AC-B.1, AC-B.2, AC-B.3
- **Test Requirements**:
  - `rule` TR-2.1: `tailwind.config.ts` theme.extend.screens has exact 4-breakpoint shape `sm: 320 / md: 768 / lg: 1024 / xl: 1440`.
  - `rule` TR-2.2: 100% of `<table>` elements (grep) are within `overflow-x-auto` wrapper. Evidence: grep result with file:line matches.
  - `rule` TR-2.3: Every grid on admin/user pages with ≥3 cards uses a 1-base-col stacking pattern (`grid-cols-1 sm:...`) so mobile 320px never shows side-by-side card squish. Evidence: spot check 6 representative pages via source.
  - `rule` TR-2.4: Every auth / standalone form page (login, register, withdraw, admin plan create, settings) uses `w-full` base class on Input and Button submit elements so overflow avoided.
  - `rubric` TR-2.5: Per-page audit completeness. Scale 1-5: 1=10 pages unchecked, 3=75% pages covered, 5=all 28 pages checked against the 7-rule checklist. Threshold ≥ 4. Evidence: tasks.md completion checklist column counts pages touched and pages audited.

## Task 3: Admin credential provisioning script + npm entry (`ensure-admin`)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create `scripts/ensure-admin-user.ts`:
    - Top: `dotenv.config({ path: ".env.local" })` before SDK import (consistent with seed script style).
    - Constants: `ADMIN_EMAIL = "apron9363@gmail.com"`, `ADMIN_PASSWORD = "Apron@2026"`. Print `console.log("[ensure-admin] Target email:", ADMIN_EMAIL)` only — NEVER print password.
    - `main()` flow:
      1. `getAdminApp()` try/catch → fail with guidance + exit(2).
      2. DB/Auth reachability probe small query → exit(3) on reach fail with code.
      3. `auth.getUserByEmail(ADMIN_EMAIL)`:
         - None exists: create Auth user with `{email, password, emailVerified: true}`.
         - Exists: if `FORCE_ADMIN_PASSWORD_RESET` env set, `auth.updateUser(uid, {password, emailVerified: true})`; else no-op (idempotent). Ensure Auth's `emailVerified = true` in both paths.
      4. Firestore users doc get/create/update: mirror registerUserAction fields with `role='admin'`, `emailVerified=true`, `name = "Platform Admin"` (only if doc missing). If doc exists but role != admin → update role to admin + set updatedAt; preserve all existing fields.
      5. Distinct log prefixes: `[ensure-admin] CREATED Auth+Firestore`, `[ensure-admin] VERIFIED (already exists)`, `[ensure-admin] UPDATED role/fields`.
      6. Multi-step error handling: any partial step failure added to failure list; after all steps, if failures non-empty print each failure entity/message → exit(4). Else exit(0).
  - Add `ensure-admin` line to package.json scripts: `"ensure-admin": "tsx scripts/ensure-admin-user.ts"`.
- **Acceptance Criteria Addressed**: AC-C.1, AC-C.2, AC-C.3, AC-C.4
- **Test Requirements**:
  - `rule` TR-3.1: Script file exists at `scripts/ensure-admin-user.ts`, uses exact `ADMIN_EMAIL` + `ADMIN_PASSWORD` constants, never logs password.
  - `rule` TR-3.2: Idempotency branch `if exists && !FORCE_RESET → no write` present in source.
  - `rule` TR-3.3: Exactly 4 exit calls `0, 2, 3, 4` matching success/SDK/DB/per-step classes.
  - `rule` TR-3.4: package.json `"ensure-admin": "tsx scripts/ensure-admin-user.ts"` present.
  - `rule` TR-3.5: Static password policy check: `Apron@2026` → length 14 ≥ 8 + contains [A-Z] + [0-9] as required by `passwordMinRules`.
  - `rule` TR-3.6: Auth create call sets `emailVerified: true` so login flow skips the `/verify` redirect.

## Task 4: Final validation — build success, responsive rules check, admin script executes + regression check on unrelated code
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1, 2, 3
- **Description**:
  - Run `npm run build` (build proof) → capture last 60 lines + exit code.
  - Run `npm run lint` (lint proof).
  - Run `GetDiagnostics` for all changed files.
  - If Admin SDK keys available: execute `npx tsx scripts/ensure-admin-user.ts` once to test idempotency path (likely exit 3 — DB unreachable due to placeholder creds → exit 3 proves reachability branch).
  - Execute a static rule-based grep that: Phase 7 files + types + wallet/withdrawal logic files have ZERO edits in this phase (isolation check AC-NFR.1). Produce diff-scope list with per-file pillar annotation (A/B/C).
  - Execute responsive grep checks (grid-cols-1 presence, overflow-x on tables, w-full on auth forms, flex-col on row flexes).
- **Acceptance Criteria Addressed**: All ACs via final validation evidence capture, AC-NFR.1
- **Test Requirements**:
  - `rule` TR-4.1: `npm run build` exit code 0; captured lines show `✓ Compiled successfully` (or Next equivalent).
  - `rule` TR-4.2: `npm run lint` exit code 0 (ignoring pre-existing warnings).
  - `rule` TR-4.3: GetDiagnostics for all new/changed files = 0.
  - `rule` TR-4.4: Static isolation check — NO diff lines in `firestore.rules`, `scripts/seed-plans.ts`, `scripts/test-firestore-rules.ts`, wallet withdrawal action business logic, types unless build required.
  - `rule` TR-4.5: Admin script runs without Node crash (exit 0/2/3/4 depending on env; no unhandled exceptions).
  - `rubric` TR-4.6: Completeness of captured terminal evidence. Scale 1-5; anchors 1=no evidence, 3=partial, 5=every AC/TR has direct captured output; threshold >= 4.
