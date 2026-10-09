# Phase 8 — Build Fixes, Responsive Design, Admin Credential Provisioning — Product Requirements Document

## Overview
- **Summary**: Three tightly-scoped deliverables executed in strict-change isolation from unrelated code: (A) fix every Next.js production build error so `npm run build` exits 0 cleanly; (B) harden responsive layout fidelity across ALL 28 project pages for mobile 320px / tablet 768px / laptop 1024px / desktop 1440px breakpoints with no horizontal scroll, no truncation, and no layout breaks; (C) ship an idempotent Admin SDK script and npm command that creates / verifies the admin account with email `apron9363@gmail.com`, password `Apron@2026`, `role=admin`, `emailVerified=true`, and no interactive login prompts required during provisioning.
- **Purpose**: Eliminate production build failures currently blocking deployment (missing `@/components/ui/Sheet` import), ensure the UI renders correctly on any target device, and provide repeatable, documented, one-command admin onboarding that matches the specified credentials — without breaking or altering unrelated existing functionality.
- **Target Users**: Deployment operators (build/script invocation), device end users (responsive layout), admin role holders (admin dashboard login via exact credentials).

## Goals
- Goal A: `npm run build` (Next.js production build) exits with code 0. Zero module-not-found, zero webpack, zero type-level blocking errors.
- Goal B: Tailwind `screens` customised exactly to sm≥320px, md≥768px, lg≥1024px, xl≥1440px; every page individually visually inspected via rule-based static validation (grid columns, overflow classes, container max-widths, table scroll wraps) so each page degrades gracefully from 1440 → 1024 → 768 → 320 without overflow, invisible content, or broken CTA tap targets.
- Goal C: Admin account provisioned deterministically — create Auth user + Firestore `users/{uid}` doc with `role:admin`, `emailVerified:true`, full-access admin privileges. Idempotent on re-run (update password only if changed; never throws for "email already exists"). Validation: login with exact credentials through existing `/login` flow yields a session that successfully reaches `/admin` overview page.

## Non-Goals
- NOT building new features on any page.
- NOT refactoring existing business logic (server actions, rules, types, seed scripts) unless it's blocking the build.
- NOT altering existing plan tiers, withdrawal flows, wallet logic, or session cookie architecture (maintain strict isolation as per user constraint #4).
- NOT installing new runtime dependencies; only new TypeScript files and config adjustments allowed.
- NOT adding new UI tests or screenshot regression frameworks; responsive validation is rule-based static checks plus build-time verification.
- NOT providing admin self-service registration UI; admin provisioning is script/CLI-only (server), not exposed in-app to public.
- NOT modifying firestore.rules Phase 7 rules; they are correct and should remain untouched.

## Background & Context
Current build failure (confirmed via `npm run build` terminal capture 2026-10-07):
```
./src/app/admin/plans/page.tsx  Module not found: Can't resolve '@/components/ui/Sheet'
./src/app/admin/tasks/page.tsx  Module not found: Can't resolve '@/components/ui/Sheet'
```
Grep confirms Sheet is imported only in those two pages, used exactly twice: for "Plan version history" right-side drawer in plans/admin, and (likely) for a task-details / task-editor side drawer in tasks/admin. Pattern of usage matches a shadcn-style Sheet: `open`, `onOpenChange`, `side="right"`, `title`, `description` props. Existing `Modal.tsx` in the same folder implements focus-stealing, escape-to-close, overlay + panel — so the Sheet is best implemented as a clone of Modal but anchored to the right edge (or passed `side`) with an enter-from-right animation rather than centered.

Tailwind current `tailwind.config.ts` uses Tailwind's default breakpoints (sm=640, md=768, lg=1024, xl=1280, 2xl=1536). Requirement says: Mobile ≥320, Tablet ≥768, Laptop ≥1024, Desktop ≥1440 — so sm should be changed to 320px to cover the smallest phones, and xl should drop from 1280 → 1440 to cover the "desktop" definition exactly. md/lg already match.

Admin credential validation against existing `passwordMinRules` in `src/lib/validations/schemas.ts:3-9`: `Apron@2026` → length 14 ≥ 8 ✓, contains uppercase `A` ✓, contains digits `2026` ✓. Email `apron9363@gmail.com` passes RFC5322 `z.string().email()`.

Constraint #4 critical: every file we touch must either be:
1. A NEW file (e.g., Sheet.tsx, ensure-admin script),
2. A CONFIGURATION file that needs tuning (tailwind.config.ts, package.json scripts),
3. A page file only when a responsive grid/overflow fix is required (never rewrite entire pages; surgical class-level edits only).

## Functional Requirements

### FR-A Build Repairs
- **FR-A.1**: Create `src/components/ui/Sheet.tsx` as a new component with the exact API surface expected by current callers in admin/plans/page.tsx and admin/tasks/page.tsx: props = `open: boolean`, `onOpenChange?: (o: boolean) => void`, `onClose?: () => void`, `side?: 'left' | 'right' | 'top' | 'bottom'` (at least right side required, callers use `side="right"`), `title?: ReactNode`, `description?: ReactNode`, `children?: ReactNode`, `className?: string`, plus a default-exported `Sheet` object with possible forwardRef or simple implementation matching `Modal.tsx` accessibility pattern (aria-modal, escape close, focus trap, scrim close).
- **FR-A.2**: After adding Sheet, re-run `npm run build` repeatedly to surface any further module-not-found, type, or webpack errors that were hidden by the Sheet failures. Fix each with minimal surgical edits using the same pattern (create missing components only if they were actually imported; never rewrite existing unrelated logic).
- **FR-A.3**: All lint rules already passing remain passing. Build output must include: `✓ Compiled successfully`, `Route (app)` listing of all 28 pages, no red errors, exit code 0.

### FR-B Responsive Design (4 Breakpoints)
- **FR-B.1 Tailwind breakpoints**: Override `theme.extend.screens` in `tailwind.config.ts` to four named breakpoints ONLY:
  ```
  sm: 320px   mobile+
  md: 768px   tablet+
  lg: 1024px  laptop+
  xl: 1440px  desktop+
  ```
  Remove default `2xl` or any other unused screens OR simply ignore them; four breakpoints are the defined set.
- **FR-B.2 Global page shell / scroll guards**:
  - Ensure root `body` / `html` / page layouts have `overflow-x: hidden` or equivalent to catch stray wide content.
  - All data tables MUST be wrapped in `overflow-x-auto` (existing admin tables need verification).
  - No page text element should rely on an unbroken `whitespace: nowrap` that overflows at 320px (wrap content or use truncation with a title attribute).
- **FR-B.3 Page-level responsive audits (28 pages enumerated in tasks.md)**: For each page, validate via static inspection:
  - (1) Grids start at `grid-cols-1` for base (mobile < 320); then `sm:cols-1 or 2 / md:cols-2 / lg:cols-3 or 4 / xl:cols-4 or 5` depending on content type.
  - (2) Flex rows use `flex-col` base with `md:flex-row` at tablet+ for row layouts.
  - (3) Admin stat cards (e.g., Admin Overview 4 cards) current class `sm:grid-cols-2 lg:grid-cols-4` should translate: `sm≥320 → cols-1 base + sm:cols-2` → good for phones, but at 320 we want base cols-1 stacked; adjust to explicit breakpoints.
  - (4) Modal / Sheet / Dialog max-width classes: use `max-w-[95vw]` base, then scale up at md/lg.
  - (5) Buttons / Inputs: `w-full` on mobile form layouts at base breakpoint to avoid overflow.
  - (6) No hardcoded pixel widths (`w-96`, `w-[500px]`) without responsive overrides.
  - (7) Text typography scales with fluid `text-sm` base, `md:text-base` if needed.
- **FR-B.4 Constraint preservation**: Only Tailwind className or wrapping div edits allowed on existing pages for responsiveness. No React logic rewrites, no state structure changes, no server action calls altered.

### FR-C Admin Provisioning (exact credentials)
- **FR-C.1 Script file `scripts/ensure-admin-user.ts`**: Uses Admin SDK (`getAdminAuth` + `getAdminDb` from the existing shared barrel at `src/lib/firebase/admin.ts` + `.env.local` loaded via dotenv). Implements an idempotent `main()` that:
  1. Determines target: `ADMIN_EMAIL=apron9363@gmail.com`, `ADMIN_PASSWORD=Apron@2026` (hardcoded inside the script ONLY as spec'd; never logged verbosely in a way that would be captured).
  2. Uses Admin Auth `getUserByEmail(adminEmail)`:
     - If no user: `auth.createUser({ email, password, emailVerified: true, disabled: false })`
     - If user exists: compare custom claims or skip-auth-password (we can't read password so safest: if user exists AND has verified email we leave password alone unless env `FORCE_ADMIN_PASSWORD_RESET=1` is set; idempotent by default, no aggressive reset). Idempotency behavior: no-op by default if account already exists.
  3. Writes Firestore doc `users/{uid}` exactly like `registerUserAction` does in authActions (same fields) with:
     - `uid = authUser.uid`, `email, role='admin'`, `status='active'`, `name='Platform Admin'` (sensible default), `plan = 'enterprise'` or existing if doc already exists (preserve existing), `emailVerified=true`, referral code auto-generated only if missing, `createdAt` = existing preserved if doc exists, else `now`.
  4. Prints a line distinguishing: `[ensure-admin] CREATED admin`, `[ensure-admin] UPDATED admin`, or `[ensure-admin] VERIFIED (already exists with correct role)`. No password printing.
- **FR-C.2 Exit codes** (distinct per failure class, consistent with seed script pattern Phase 7):
  - exit(0): success
  - exit(2): Admin SDK init failure / missing env
  - exit(3): Firestore or Auth unreachable / permission denied
  - exit(4): per-step update or write failure (e.g. Auth creates but Firestore fails) — multi-step logging each failure.
- **FR-C.3 npm script**: `"ensure-admin": "tsx scripts/ensure-admin-user.ts"` added to package.json.
- **FR-C.4 Security**: the exact password (`Apron@2026`) hardcoded only in the script source (as spec explicitly requires these credentials). No password logging. No credential duplication in any env.example (keep private only in script body + actual Auth). Email in logs only. Operator can rerun command safely any number of times (idempotent).

## Non-Functional Requirements
- **NFR-1 Strict Isolation (user constraint #4)**: For every file change, document its necessity and the pillar it belongs to. No changes to: `firestore.rules`, `scripts/seed-plans.ts`, `scripts/test-firestore-rules.ts`, any Phase 7-created files, any types module unless they directly block build, any wallet/withdrawal/dashboard business logic. Violations of this NFR require explicit approval and a diff note.
- **NFR-2 Type Safety**: All new files `Sheet.tsx`, `ensure-admin-user.ts` must be TypeScript strict mode passing — verified through GetDiagnostics = 0 for each new file + build passes (which implies type-level correctness within build).
- **NFR-3 Accessibility (WCAG 2.1)**: Sheet component MUST maintain the same accessibility baseline as Modal (role="dialog", aria-modal="true", focus-management, aria-labelledby pointing to title id, aria-describedby for description, ESC to close).
- **NFR-4 Idempotency / Reproducibility**: Running `npm run ensure-admin` multiple times → no duplicates; each run reports VERIFIED after the first run.
- **NFR-5 No horizontal overflow rule**: On viewport width 320px, `document.documentElement.scrollWidth === document.documentElement.clientWidth` for every page. Verified in static review via absence of `w-full + fixed pixel children` patterns plus `overflow-x-auto` wrapping on tables.
- **NFR-6 Performance**: Tailwind `screens` customisation only changes media queries; no client-side JS added. No new network calls on login page; admin provisioning is a CLI-side script only.

## Constraints
- **Technology**: Next.js 14.2.15 App Router only. Tailwind CSS only. No new third-party UI libraries (Sheet.tsx is homegrown to match Modal.tsx). Admin SDK v12.6.0 only.
- **Dependencies**: No npm install. No new runtime packages. No new dev dependencies. tsx and dotenv already exist as per project.
- **Isolation constraint #4 (USER HARD REQUIREMENT)**: Strictly maintain all existing project code, functionality, and configurations unrelated to tasks 1-3. Any file edit outside pillar A/B/C must be documented with a 1-line justification and is subject to independent review regression check.
- **Security**: Admin password never appears in `.env.example` or in stdout print statements (only print email, status, action type). No client-side paths to escalate a user to admin; provisioning is server-side script only requiring Admin SDK keys in .env.local.

## Assumptions
- Project already uses server actions + Firebase Auth client sign-in for login flow. The admin account created by `ensure-admin` script needs only a valid Auth user record + Firestore user row with `role=admin` and `emailVerified=true`. Email verification link sending is skipped because the script sets `emailVerified=true` directly in the Auth record.
- After Sheet.tsx is added, `npm run build` will expose no more module-not-found errors in the current codebase. If any new failures appear, they were already latent before Sheet was fixed; tackle them under pillar A and log.
- Responsive static validation catches 95% of common overflow issues. Browser layout quirks that require live DOM testing are out of scope (user hasn't requested screenshots or browser tests). Rule-based catches include container max-w, grids stacked on mobile, tables overflow-x wrapped, forms using w-full for inputs.
- Operator has Admin SDK keys in `.env.local` (Phase 7 scripts proved the SDK initializes correctly).

## Open Questions
- [x] Sheet component API: callers pass `side="right"` only; we'll implement left/right/top/bottom anchors to avoid future breakage but default right. No other call sites exist currently.
- [x] Admin password handling for existing accounts: by default no reset (idempotent). If operator wants to reset after a credential rotation, they set `FORCE_ADMIN_PASSWORD_RESET=1` env (narrow, non-breaking).
- [x] Responsive scope: page files + shared UI components like StatCard/Card only; no responsive changes to individual icons, subpixel spacing, or color themes.

## Acceptance Criteria

### AC-A.1: `npm run build` production build exits with code 0 (build success)
- **Type**: `rule`
- **Given**: Clean cwd, `.env.local` present
- **When**: `npm run build` executed in PowerShell
- **Then**: Process exit code = 0; terminal output contains `Route (app)` lines listing all pages; no lines matching `Module not found` or `webpack errors` or `Failed to compile` appear in the output
- **Evidence**: Captured build log showing exit code 0 + final output lines

### AC-A.2: `@/components/ui/Sheet` import resolves in both admin pages
- **Type**: `rule`
- **Given**: Repo after Sheet creation
- **When**: TypeScript module resolution runs during tsc/next build
- **Then**: No `Can't resolve '@/components/ui/Sheet'` errors; grep `@/components/ui/Sheet` finds 1 definition + 2 usages
- **Evidence**: GetDiagnostics = 0 for Sheet.tsx; build log line "Compiled successfully"

### AC-A.3: Sheet component implements accessible side drawer with correct props
- **Type**: `rule`
- **Given**: Sheet.tsx source
- **When**: Source inspection of Sheet API + comparison to admin/plans call site (side, title, description, open, onOpenChange props)
- **Then**: All props consumed correctly; renders side-anchored drawer (right) with overlay, ESC closes, focus-stealing works per Modal pattern
- **Evidence**: Sheet.tsx source code lines for each prop + focus trap

### AC-B.1: Tailwind breakpoints exactly match required pixel widths
- **Type**: `rule`
- **Given**: `tailwind.config.ts`
- **When**: Read `theme.extend.screens` block
- **Then**: Object shape `{ sm: '320px', md: '768px', lg: '1024px', xl: '1440px' }` exactly
- **Evidence**: tailwind.config.ts source snippet

### AC-B.2: Every page layout stacks gracefully at 320px mobile (no horizontal overflow evidence via static inspection)
- **Type**: `rubric`
- **Scale**: 0-5. Anchors: 0=3+ pages have hardcoded wide children with no overflow wrap; 3=70% pages correctly use stacked grids + overflow wrap; 4=95% pages correct, only rare minor issues that don't block functionality; 5=every page checked individually with rule-based evidence recorded and 100% compliant.
- **Threshold**: ≥ 4
- **Evidence**: tasks.md table per-page checklist (28 rows) of grid cols, flex direction, table wrap, hardcoded width findings + fix lines applied per-file where needed, count of pages passing all 7 responsive rules per page.

### AC-B.3: Table overflow + form inputs full-width pattern present on every page containing tables or forms
- **Type**: `rule`
- **Given**: Every admin page with a table (admin/overview, /users, /withdrawals, plans); wallet withdrawal; login/register; settings forms
- **When**: Static grep `<table` → ancestor `overflow-x-auto` wrapping div exists in each file; inputs inside standalone forms have base breakpoint `w-full` class.
- **Then**: 100% of tables wrapped; 100% of standalone form inputs use w-full base breakpoint class
- **Evidence**: Grep output + file snippets for each occurrence

### AC-C.1: `npm run ensure-admin` creates Auth user + Firestore doc if missing, idempotent if exists
- **Type**: `rule`
- **Given**: Clean Firebase project with no `apron9363@gmail.com` account
- **When**: Run 1: `npm run ensure-admin` → Run 2: `npm run ensure-admin`
- **Then**: Run 1: print `CREATED admin apron9363@gmail.com with role=admin`; Firestore user doc query for the created uid has role=admin AND emailVerified=true; Auth record emailVerified=true; Run 2: print `VERIFIED (already exists …)` no writes; exit code 0 both runs
- **Evidence**: Captured terminal output two runs; Firestore admin user document snapshot showing role/emailVerified correct

### AC-C.2: Exact credentials allow login on the /login page with valid session leading to successful /admin route access
- **Type**: `rule`
- **Given**: Admin account provisioned via AC-C.1
- **When**: Existing login form filled with email=apron9363@gmail.com password=Apron@2026 and submitted
- **Then**: Client-side `signInWithEmailAndPassword` succeeds → `createSessionFromIdToken` succeeds → since `emailVerified` is true, redirects to `/dashboard` (or specified `next=/admin`) → admin middleware allows `/admin` access because session user doc has `role=admin` (not re-redirected to /dashboard because not admin check fail)
- **Evidence**: Static verification via code path: login page redirect rule line 52-56 + admin guard logic in admin routes; password policy `passwordMinRules` accepts `Apron@2026` (14 chars, uppercase A, 2026 digits) via schema source.

### AC-C.3: Script exit codes distinct per failure class
- **Type**: `rule`
- **Given**: Source of `ensure-admin-user.ts`
- **When**: grep `process.exit(`
- **Then**: Four distinct exits at N ∈ {0, 2, 3, 4}; each in a unique failure/success block matching FR-C.2 semantics
- **Evidence**: 4 lines matched with exit class comment or context

### AC-C.4: npm script `ensure-admin` present
- **Type**: `rule`
- **Given**: `package.json` scripts section after changes
- **When**: grep for `ensure-admin`
- **Then**: Script literal `"ensure-admin": "tsx scripts/ensure-admin-user.ts"` present
- **Evidence**: package.json source snippet

### AC-NFR.1: No unrelated regressions on Phase 7 files
- **Type**: `rule`
- **Given**: Git diff scope files list
- **When**: Static inspection of changed files
- **Then**: Zero modifications to `firestore.rules`, `scripts/seed-plans.ts`, `scripts/test-firestore-rules.ts`, any types module unless it directly caused a build module-not-found, any wallet/withdrawal/submission React logic, any server action business logic
- **Evidence**: List of changed files with per-file pillar annotation (A/B/C) and justification; reviewer independent regressions check; build passes; lint passes as before

### AC-NFR.2: New files pass `GetDiagnostics` with zero errors
- **Type**: `rule`
- **Given**: New files `src/components/ui/Sheet.tsx` and `scripts/ensure-admin-user.ts`
- **When**: VS Code GetDiagnostics run after edits
- **Then**: Zero diagnostic errors for both files (no type errors, no unused imports, no JSX issues)
- **Evidence**: GetDiagnostics output = 0
