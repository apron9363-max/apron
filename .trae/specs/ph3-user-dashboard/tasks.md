# Phase 3 — User Dashboard — Implementation Tasks & Test Requirements

Derived from `spec.md` of the same folder. Every task has a stable heading (no status markers inside heading text); status, priority, Blocked By, and Completion Evidence are tracked in per-task sections below the heading.

## Task 1: Expand UserDoc types & update getCurrentUserDataAction payload

**Priority**: `high`
**Status**: `pending`
**Depends On**: (none)
**Covers ACs**: AC-2, AC-6, AC-15, AC-16
**Related Files**: `src/types/index.ts`, `src/server/actions/userActions.ts`, `src/lib/firestore.ts`

### Task Description
1. Update `UserDoc` type in `src/types/index.ts` to add optional fields:
   - `balanceHistory?: BalanceSnapshot[]` where `BalanceSnapshot = { at: number; balance: number; effectiveRate?: number }`
   - `quickLinks?: QuickLink[]` where `QuickLink = { id: string; href: string; label: string; iconName: string; custom?: boolean; order: number; }`
   - `referralClicks?: number` (default 0)
   - `referralSignups?: number` (denormalized counter; optional — defaults calculated live)
2. Add the derived types `BalanceSnapshot` and `QuickLink` to `src/types/index.ts` exports.
3. Update `getCurrentUserDataAction()` to return a payload extended with:
   - `pendingBalanceSum` (sum of `netAmount` where `withdrawal.status === 'pending'`)
   - `historicalSum30d` (sum of earning amounts where `createdAt > now - 30d`)
   - `referralSignupsCount` (count Firestore users whose `referredBy === session.uid` AND `emailVerified === true`)
   - `quickLinks` (user doc quickLinks or defaults when empty)
   - `balanceHistory` (user doc array, trimmed to latest 30 entries)
   - `planDoc` (matching `getPlan(user.plan)`)
4. Ensure default behavior for users *without* these new fields returns sensible empty/zero defaults so no runtime `undefined.*` reads occur.
5. Update `verifySessionCookie` path is unchanged; action derives user identity from session cookie only (never accepts uid from body).

### Test Requirements (task-local)
- **TR-T1.1 (rule)**: `tsc --noEmit` passes after type changes, no new `any` introduced.
  - Pass Condition: `npm run typecheck` exit code 0
  - Evidence: Terminal log capture
- **TR-T1.2 (rule)**: `getCurrentUserDataAction` returns all 6 new top-level keys even on a user doc missing the new fields (defaults returned).
  - Pass Condition: harness calls action and asserts existence of each key with non-undefined values
  - Evidence: `scripts/test-dashboard.ts` assertion output + lines of code producing defaults
- **TR-T1.3 (rule)**: `pendingBalanceSum` calculation correctly matches sum of pending withdrawals only (not paid/rejected).
  - Pass Condition: harness seeds 1 pending (2000), 1 paid (3000), 1 rejected (1000), asserts pendingBalanceSum === 2000
  - Evidence: test harness output
- **TR-T1.4 (rubric)**: Server-only boundary preserved.
  - Dimension: Leak-safety
  - Scale 0-2: 2 = no client-importable route touches admin SDK; 1 = one file missing guard; 0 = leak present
  - Threshold: >=2
  - Evidence: `lib/firestore.ts` still starts with `import "server-only"`, and action module uses it only server-side.

---

## Task 2: Create ToastContext + ToastViewport & Modal (if missing) shared UI

**Priority**: `high`
**Status**: `pending`
**Depends On**: (none)
**Covers ACs**: AC-5, AC-11, AC-13
**Related Files**: `src/components/ui/Toast.tsx`, `src/components/layout/AppShell.tsx`, `src/components/ui/Modal.tsx` (verify)

### Task Description
1. Create `src/components/ui/Toast.tsx` exporting:
   - `ToastProvider` (React Context wrapping children with a `toast` controller)
   - `useToast()` hook returning `{ show }` where `show({ message, kind, duration? })`
   - `ToastViewport` rendered inside provider, fixed-positioned (bottom-28 for mobile, top-right for desktop) with aria-live="polite"
   - Per-toast styling: glass card, rounded-2xl, 2.4s success fade, 3.6s error fade, dismiss ✕ button
2. Mount `ToastProvider` + `ToastViewport` inside `AppShell` (variant=app branch) so all dashboard subpages have toasts available. Keep ToastViewport out of admin layout (non-essential, safe to omit).
3. Verify `src/components/ui/Modal.tsx` exists with API: `open, onClose, title, children, footer?`. If not present, create a new Modal (glassmorphic, focus trap, Esc/backdrop close). Update file to ensure focus management.

### Test Requirements (task-local)
- **TR-T2.1 (rule)**: ToastProvider renders ToastViewport with aria-live attribute.
  - Pass Condition: DOM snapshot of `ToastViewport` contains `aria-live="polite"`
  - Evidence: Source text `aria-live="polite"` + browser snapshot
- **TR-T2.2 (rule)**: `toast.show({ kind: 'success' })` and `toast.show({ kind: 'error' })` create visible toasts.
  - Pass Condition: Simulated via unit code — harness imports Toast context and asserts controller enqueues items.
  - Evidence: Source inspection of show() implementation with queue push logic
- **TR-T2.3 (rubric)**: Shared UI design fidelity.
  - Dimension: Glass/gold system match
  - Scale 1-5, threshold 4
  - Evidence: Snapshot of toast rendered

---

## Task 3: Implement 4 balance cards + sparkline charts + pending/historical server aggregation

**Priority**: `high`
**Status**: `pending`
**Depends On**: T1 (types + payload), T2 (tooltips/toasts not required by cards directly but ok to start in parallel if payload ready)
**Covers ACs**: AC-1, AC-2, AC-3, AC-11, AC-12
**Related Files**: `src/app/(app)/dashboard/page.tsx`, `src/components/ui/StatCard.tsx` (enhance), optionally `src/components/features/BalanceSparkline.tsx`

### Task Description
1. Refactor dashboard StatCard section to 4 cards: Available Balance (`user.balance`), Task Balance (`user.taskBalance`), Pending Balance (`pendingBalanceSum`), Historical Earnings 30d (`historicalSum30d`).
2. Enhance StatCard to accept optional `trend?: { values: number[] }` and a `tooltip?: string` prop. Render the trend as a recharts sparkline if values.length >= 3, else render a dashed placeholder `<div>` (with dashed border + empty label).
3. Available Balance card trend → values = `balanceHistory.map(bh => bh.balance)` (latest 12).
4. Historical Earnings card trend → values = last 12 earning docs' `amount` (or build from balanceHistory deltas).
5. Add hover animations (already partially done with `glass-hover`) — ensure each card has `transition hover:shadow-gold`, `active:scale-[0.99]`, and `focus:outline-none focus-visible:ring-2 ring-apron-gold focus-visible:ring-offset-2 ring-offset-transparent`.
6. Add an info icon with a tooltip (a small native `title` attribute + a visually-hidden tooltip element via aria-describedby for screen readers).

### Test Requirements (task-local)
- **TR-T3.1 (rule)**: Dashboard renders all 4 cards using the new payload keys.
  - Pass Condition: Source of dashboard/page.tsx imports payload and renders 4 StatCards with matching labels & values.
  - Evidence: Source inspection + rendered browser snapshot
- **TR-T3.2 (rule)**: Sparkline shows placeholder (not a broken chart) when < 3 trend values.
  - Pass Condition: DOM contains placeholder (dashed border div) in that card's trend slot
  - Evidence: Rendered snapshot with empty user and placeholder classes visible
- **TR-T3.3 (rubric)**: Hover/focus behavior and overall visual polish.
  - Dimension: Interactivity & visual
  - Scale 1-5, threshold 4
  - Evidence: Focus ring visible on snapshot; transition classes present

---

## Task 4: Hourly rate card — 24h sparkline, fluctuation pill, 60-min auto-refresh + manual refresh

**Priority**: `high`
**Status**: `pending`
**Depends On**: T1 (payload + planDoc), T3 (can be parallel)
**Covers ACs**: AC-4, AC-11, AC-13
**Related Files**: `src/app/(app)/dashboard/page.tsx` (banner card refactor), `src/server/actions/userActions.ts` (refreshDashboardRateAction), `src/components/features/HourlyRateCard.tsx` (optional, new component)

### Task Description
1. Introduce `refreshDashboardRateAction()` server action (Zod input: void, Zod output: `{ apnRate: number; planLabel: string; trend24h: {t: number; value: number}[]; fluctuation: { pct: number|null; dir: "up"|"down"|"flat" } }`).
   - `trend24h` is a 24-bucket array. For each hour build effectiveRate from balanceHistory entries in that bucket; if no data, use `planDoc.hourlyRate` as flat fallback.
   - `fluctuation.pct` = `((latest - previous) / Math.abs(previous)) * 100` if both exist and previous != 0, else null (dir: flat).
2. Refactor the top dashboard greeting banner rate card into a standalone component or inline section that:
   - Displays rate in gradient gold
   - Displays pill: green ↑ +X%, red ↓ -X%, grey ─ 0% neutral / ─ insufficient
   - Shows a recharts LineChart 24h sparkline below rate (responsive container, prefers-reduced-motion disables line animation)
   - Includes "Refresh now" button loading spinner, aria-busy bound to loading state
   - Uses `useEffect` + `setInterval(…, 3_600_000)` to call refresh action every 60 minutes. Clear interval on unmount.
3. If `prefers-reduced-motion` media query matches, set interval to 60 minutes still but disable LineChart animation property.

### Test Requirements (task-local)
- **TR-T4.1 (rule)**: `refreshDashboardRateAction` returns shape matching Zod schema.
  - Pass Condition: `scripts/test-dashboard.ts` runs action + validates with Zod; exit 0
  - Evidence: Harness PASS output
- **TR-T4.2 (rule)**: 60-minute interval logic present and has cleanup.
  - Pass Condition: Rate card component source contains `setInterval(...)` with a `clearInterval` in the effect cleanup return function.
  - Evidence: Source inspection
- **TR-T4.3 (rubric)**: Fluctuation pill direction color correctness.
  - Dimension: Color & semantics
  - Scale 1-5 threshold 4
  - 5 = ↑ green, ↓ red, flat/insufficient grey — all correct labels; 3 = colors mismatch one direction
  - Evidence: Source of pill rendering logic

---

## Task 5: Referral card — copy with toast, share buttons, referralClicks & verifiedSignups stats, increment action

**Priority**: `high`
**Status**: `pending`
**Depends On**: T1 (payload + stats + referralClicks/singupsCount), T2 (toast)
**Covers ACs**: AC-5, AC-6
**Related Files**: `src/app/(app)/dashboard/page.tsx`, `src/server/actions/userActions.ts` (incrementReferralClickAction)

### Task Description
1. Add `incrementReferralClickAction()` server action: reads session, runs `updateUser(session.uid, { referralClicks: FieldValue.increment(1) })` via firestore lib. Guard against repeated clicks server-side by checking the action is called maximum 1 time per 60 seconds per uid (optional, if simple; otherwise allow — best-effort).
2. Rework the existing `CopyReferralButton` into a robust copy handler with clipboard API + fallback, that uses `toast.show()` from T2 for success / error toasts, and writes result into an aria-live region.
3. Referral card now contains:
   - Referral link display
   - Copy button (refactored)
   - Two mini stat cards: "Clicks" = `user.referralClicks ?? 0`, "Verified sign-ups" = `referralSignupsCount`
   - WhatsApp / Twitter share buttons (same pattern as referrals page). Each click → fires incrementReferralClickAction + toast "Share link copied!" or incremented if applicable.
4. Remove the legacy DOM-id coupled `document.getElementById("copy-status")` hack.

### Test Requirements (task-local)
- **TR-T5.1 (rule)**: Copy handler has both strategies and routes to toast success/error.
  - Pass Condition: Source code path for `navigator.clipboard.writeText` with try/catch; fallback textarea creation + execCommand; catch-all toast.error.
  - Evidence: Source inspection
- **TR-T5.2 (rule)**: incrementReferralClickAction increases `referralClicks` by exactly 1 each valid call.
  - Pass Condition: Harness calls twice, asserts before=0 → after-1st=1 → after-2nd=2.
  - Evidence: Harness output.

---

## Task 6: Quick links — Firestore CRUD, Edit mode, add/remove/reorder with drag-and-drop + arrows, defaults on empty

**Priority**: `high`
**Status**: `pending`
**Depends On**: T1 (payload + types + action), T2 (Modal)
**Covers ACs**: AC-7, AC-11, AC-12
**Related Files**: `src/server/actions/userActions.ts` (saveQuickLinksAction), `src/app/(app)/dashboard/page.tsx` (quick links section), `src/components/features/QuickLinksGrid.tsx` optional

### Task Description
1. Add `saveQuickLinksAction(input: { links: QuickLink[] })` server action.
   - Zod schema: array of QuickLink; max 12 entries; hrefs must be internal (`href.startsWith('/')`) OR https:// URL (but we filter or normalize to safe set). IconName must be a whitelisted icon from defined set.
   - Write to user doc's `quickLinks`.
2. Default set: if `quickLinks` empty → default list returned by T1 is Tasks, Quiz, Contest, Wallet (order 0..3). Auto-save defaults first time user opens dashboard — do NOT overwritingly save every render; only when user clicks something in Edit mode.
3. Dashboard quick links section:
   - Header: "Quick Links" + right-side "Edit" toggle button.
   - When not Edit mode: plain links-only grid.
   - When Edit mode:
     - Each tile: left drag handle (⋮⋮) via `draggable=true`, HTML5 DnD handlers (`onDragStart, onDragOver, onDrop, onDragEnd`); right remove ✕ button; up/down arrow buttons keyboard-reorder fallback.
     - "Add link" button at grid end (empty tile placeholder) opens Modal (T2) with fields: label, href, icon selector (dropdown of whitelisted). Save calls saveQuickLinksAction.
4. Grid responsiveness: 2 cols <640px, 3 cols sm→lg, 4 cols ≥1024px. Each tile = glass, gap-3, align-left icon+label.
5. On reorder / remove / add, apply changes locally first, then debounce save — but for simplicity, save to server immediately on each change (cost: 1 extra write per change, acceptable for user-paced edits).

### Test Requirements (task-local)
- **TR-T6.1 (rule)**: saveQuickLinksAction round-trips a 4-item array and returns ok:true
  - Pass Condition: Harness writes array → reads back via enriched user action → deep equal (ignoring db write-timestamps)
  - Evidence: Harness PASS output
- **TR-T6.2 (rule)**: Defaults populate when user quickLinks empty/undefined.
  - Pass Condition: Harness user with empty quickLinks returns default 4 links
  - Evidence: Harness assertion
- **TR-T6.3 (rule)**: Schema rejects >12 links and non-whitelisted icon.
  - Pass Condition: 13-link array → ok:false; unknown icon → ok:false
  - Evidence: Harness assertion
- **TR-T6.4 (rubric)**: Keyboard reorder fallback present.
  - Dimension: A11y depth
  - Scale 1-5 threshold 4; 5 = drag-and-drop + arrow up/down buttons + focus management; 3 = DnD only
  - Evidence: Source of Edit-mode JSX shows arrow buttons

---

## Task 7: Bottom Navigation 5-item + smooth active indicator + safe areas + tablet sizing

**Priority**: `medium`
**Status**: `pending`
**Depends On**: (none, independent UI)
**Covers ACs**: AC-8, AC-12
**Related Files**: `src/components/layout/BottomNav.tsx`

### Task Description
1. Change items array to 5 entries: Home (/dashboard), Tasks (/tasks), Wallet (/wallet), Referrals (/referrals), History (/history). 5th entry added.
2. Active indicator: add an absolutely-positioned decorative pill element (not per-item) that has a `transition: left 250ms ease, width 250ms ease`; compute its left from `offsetLeft` of active `<li>` + `width` from `offsetWidth` using a `useLayoutEffect` + `ResizeObserver` to recalc on window resize.
3. Tablet sizing: at ≥768px increase nav height (py-3), increase icon size (size=20), enlarge label text (text-sm).
4. Safe area: `pb-[calc(env(safe-area-inset-bottom)+12px)]` on outer container.
5. `BottomNav.tsx` already has `aria-label="Bottom navigation"`. Keep that. Ensure each `<Link>` has an `aria-current="page"` when active.

### Test Requirements (task-local)
- **TR-T7.1 (rule)**: 5 items, correct hrefs.
  - Pass Condition: DOM snapshot shows 5 `li` items with matching hrefs
  - Evidence: Snapshot + source
- **TR-T7.2 (rule)**: Active `aria-current="page"` applied to active item.
  - Pass Condition: Source renders with `aria-current={active ? "page" : undefined}`.
  - Evidence: Source line
- **TR-T7.3 (rubric)**: Smooth indicator animation polish.
  - Dimension: Motion feel
  - Scale 1-5 threshold 4; 5 = indicator translates with easing, resizes correctly on window resize
  - Evidence: ResizeObserver code present + transition CSS class applied

---

## Task 8: Side Menu swipe gestures + profile card + settings row + focus trap + Esc close

**Priority**: `high`
**Status**: `pending`
**Depends On**: T1 (optional — to render user/plan info; can fetch session user from client if needed)
**Covers ACs**: AC-9, AC-13
**Related Files**: `src/components/layout/SideMenu.tsx`, `src/server/actions/userActions.ts` (optionally, add getSideMenuProfileAction)

### Task Description
1. Add pointer-event-based swipe gestures to `SideMenu`:
   - Open gesture: `pointerdown` on a hidden touch target along 0→32px left edge of viewport (detect at document level). If drag meets `dx >= 80 && Math.abs(dy) < Math.abs(dx)`, set menuOpen=true. Capture pointer on first move; release on pointerup/cancel.
   - Close gesture: When menu open, `pointerdown` inside drawer plus horizontal drag leftwards >80px (dx negative). Trigger close. Never interfere with vertical scroll (if |dy| > |dx|, release pointer capture and let default scroll happen).
   - Honor `prefers-reduced-motion`: when true, skip all gesture code entirely (add a hook result); only button/Esc/backdrop close work.
2. Enhance SideMenu content:
   - Add a **profile summary card** section before the nav list: avatar circle initial, name, email, plan pill (starter/pro/elite with colors). User data: fetch via new small server action `getSideMenuProfileAction()` returning `{ name, email, plan }`; SideMenu loads it in a client-side useEffect with minimal loading placeholder, OR pass from AppShell (AppShell can fetch and pass down as prop from layout — but since AppShell is "use client", choose client effect). Fallback to first letter + email placeholder.
3. Add a Settings nav row pointing to `/settings` (before divider).
4. Focus management:
   - Open → first nav link focus via `useEffect` + `ref.current?.focus()`.
   - While open, listen for Tab/Shift+Tab and wrap focus within drawer (basic trap).
   - Close → focus hamburger trigger (accept a `triggerRef?: RefObject<HTMLButtonElement>` prop; AppShell passes the Header's open menu button ref).
5. Add `role="dialog"`, `aria-modal="true"`, `aria-label="Main menu"` to drawer `<aside>`.
6. Ensure Escape key closes drawer (useEffect document keydown listener, clean up).

### Test Requirements (task-local)
- **TR-T8.1 (rule)**: Pointer event handlers, capture & release logic present.
  - Pass Condition: Source includes pointerdown/move/up handlers plus setPointerCapture / releasePointerCapture calls + dx/dy thresholds.
  - Evidence: Source inspection
- **TR-T8.2 (rule)**: Escape listener focus trap + focus back to trigger.
  - Pass Condition: Source includes useEffect with document.addEventListener('keydown', ... Escape check; focus() call on firstLinkRef on open; focus() call on triggerRef on close.
  - Evidence: Source inspection
- **TR-T8.3 (rule)**: Settings row & profile card rendered.
  - Pass Condition: DOM snapshot contains "Settings" line-item and a drawer header with email + plan pill + initial avatar
  - Evidence: Rendered browser snapshot of drawer open

---

## Task 9: Create `appendBalanceSnapshotAction` and hook it into `claimHourlyAccrualAction`

**Priority**: `medium`
**Status**: `pending`
**Depends On**: T1 (types — BalanceSnapshot)
**Covers ACs**: AC-1, AC-2 (data for sparklines), AC-4
**Related Files**: `src/server/actions/userActions.ts` (appendBalanceSnapshotAction), modify claimHourlyAccrualAction

### Task Description
1. Add `appendBalanceSnapshotAction({ at?: number, effectiveRate?: number })` server action.
   - Reads session; fetches current user; appends `{ at: at ?? Date.now(), balance: current.balance, effectiveRate }` to `balanceHistory`.
   - Trim the `balanceHistory` array to `Math.min(current.length + 1, 100)` (keep newest 100 only; slice tail).
2. At the end of `claimHourlyAccrualAction`, after successful Firestore transaction + earning doc write, **call** `appendBalanceSnapshotAction` with the just-added rate as `effectiveRate = reward`.
3. (Optional) During a user-visible "Check my balance" button if we add one — not required; rely on the hourly 60-min refresh and claim-triggered snapshots for sufficient data density.

### Test Requirements (task-local)
- **TR-T9.1 (rule)**: Calling append 3 times on a fresh user yields 3 entries; calling 103 times yields 100 entries (trim to 100).
  - Pass Condition: `scripts/test-dashboard.ts` harness seeds 3 → assert length=3; seeds 103 → assert length=100
  - Evidence: Harness PASS output

---

## Task 10: Update `firestore.rules` to whitelist writable fields (quickLinks, balanceHistory, referralClicks, etc.)

**Priority**: `high`
**Status**: `pending`
**Depends On**: (none)
**Covers ACs**: AC-10, AC-16
**Related Files**: `firestore.rules`

### Task Description
1. Edit `firestore.rules`:
   - Under `/users/{userId}`: `allow read: if request.auth.uid == userId || isAdmin(request.auth.uid);`
   - `allow write: if isAdmin(request.auth.uid) || (request.auth.uid == userId && isWhitelistedFieldsOnly(request.resource.data.diff(resource.data).changedKeys()));`
   - Define a helper function `whitelistedUserFields()` returning list of allowed keys: `["name", "phone", "bankDetails", "quickLinks", "balanceHistory", "referralClicks"]` — strings, no role/plan/balance direct writes.
   - `isWhitelistedFieldsOnly(keys)` = set of changedKeys ⊆ whitelistedUserFields.
2. Also ensure function `isAdmin` defined (checks role token claim or admin uid hardcoded list; prefer admin token if system set; keep existing convention).
3. If rules need to maintain any existing admin helpers, preserve them.

### Test Requirements (task-local)
- **TR-T10.1 (rule)**: Rules source contains whitelist set with exactly 6 writable non-privileged keys.
  - Pass Condition: Source line with array literal containing all 6; `role`, `plan`, `balance`, `taskBalance`, `apnRate`, `referralPaidOut` NOT present in whitelist.
  - Evidence: Source diff/grep
- **TR-T10.2 (rubric)**: Rules security integrity.
  - Dimension: Privilege-escalation resistance
  - Scale 0-2: 2 = admin gate + whitelist correct; 1 = one hole; 0 = missing write gate
  - Threshold >=2
  - Evidence: Rules inspection

---

## Task 11: Validate dashboard accessibility (manual + code checks against WCAG 2.1 AA)

**Priority**: `medium`
**Status**: `pending`
**Depends On**: T2–T10 implementation done (or at least UI skeleton)
**Covers ACs**: AC-13, AC-11

### Task Description
1. Global focus style: confirm `globals.css` has `:focus-visible { outline: 2px solid #FFC400; outline-offset: 2px }` or equivalent via Tailwind. If missing, add.
2. Audit every interactive element for aria-label where icon-only:
   - Hamburger, copy button, refresh button, remove quicklink, drag handle, modal close, share buttons (WhatsApp / Twitter need visible text too but aria-label helps).
3. Audit aria-live on toast + copy announcements; confirm modal and drawer have `role="dialog"` + `aria-modal`.
4. Audit reduced-motion in at least 3 places: rate line animation, drawer swipe gesture disabled, toast fade shorter or instant.
5. Manual contrast check: verify all paragraph text (text-white/60, text-white/70) against `#100422` background via calculation. If `text-white/50` used anywhere for body (size <18px) → bump to `text-white/70`.

### Test Requirements (task-local)
- **TR-T11.1 (rule)**: Focus-visible global styles exist.
  - Pass Condition: grep for focus-visible selector in globals.css or Tailwind utility applied at root level
  - Evidence: grep line
- **TR-T11.2 (rule)**: Every icon-only button has non-empty aria-label attribute.
  - Pass Condition: Grep for `<Button` missing children text, and assert aria-label on them
  - Evidence: Source diff review
- **TR-T11.3 (rubric)**: Overall accessibility coherence
  - Scale 1-5 threshold >=4
  - Dimension: WCAG coverage
  - Evidence: List of all changes

---

## Task 12: Build validation harness scripts/test-dashboard.ts, run build/typecheck/lint, verify dev-server renders

**Priority**: `high`
**Status**: `pending`
**Depends On**: T1–T11 all completed
**Covers ACs**: AC-14, AC-15, AC-2, AC-3 (indirectly)

### Task Description
1. Create `scripts/test-dashboard.ts` using tsx runner:
   - Load env with dotenv/config (dev dependency already present).
   - Initialize firebase-admin (mirror pattern from `scripts/test-firebase.ts`).
   - Create a temp test user doc (and clean it up finally).
   - Test cases:
     1. **SaveQuickLinks round trip** (asserts T6.1)
     2. **Referral clicks increment twice** (asserts T5.2)
     3. **refreshDashboardRateAction shape** (asserts T4.1)
     4. **Enriched dashboard payload: pending & 30d sum** (asserts T1.2, T1.3)
     5. **Balance snapshot append + trim (103 → 100)** (asserts T9.1)
   - Each case prints `[PASS] …` or `[FAIL] …` with error; process.exit(1) if any fail.
2. Run `npm run build && npm run typecheck && npm run lint` — must exit 0. Fix any new TS/build errors introduced.
3. Start dev server, visit dashboard via integrated browser and take a snapshot. Confirm no runtime errors in console (check console messages via browser tool).

### Test Requirements (task-local)
- **TR-T12.1 (rule)**: Test dashboard harness has ≥5 assertions and exits 0.
  - Evidence: Terminal log + exit code 0
- **TR-T12.2 (rule)**: Build/typecheck/lint exit 0.
  - Evidence: Terminal log
- **TR-T12.3 (rubric)**: Runtime console health.
  - Dimension: Dev-server runtime
  - Scale 1-5 threshold >=4; 5 = zero errors/warnings except Next.js boilerplate banners; 3 = some non-critical warnings
  - Evidence: Browser console messages dump

---

## Legend
- `rule` / `rubric` in task-local Test Requirements match the vocabulary: rules are pass/fail with observable evidence, rubrics are scored with thresholds.
- Status fields are the ONLY place where `pending`, `in_progress`, `blocked`, `completed`, `cancelled` markers appear.
- Blocked tasks must add `Blocked By: <task ref or external>` + `Unblock Condition: <>` below this section.
- On completion of each task, add `Completion Evidence:` subsection with:
  - For rules: list of files changed + terminal log line (or harness pass lines).
  - For rubrics: score, rationale, and link to evidence (browser snapshot, code snippet, etc.)
