# Phase 3 — Fully-Functional User Dashboard — Product Requirements Document

## Overview
- **Summary**: Implement a production-ready, responsive user dashboard for the Apron rewards platform that (1) displays the user's balance breakdown with balance-trend mini-charts and interactive hover animations, (2) shows the current hourly APN rate with a 24-hour history sparkline and up/down fluctuation indicators plus 60-minute auto-refresh, (3) renders a referral link card with copy-to-clipboard success/error toast feedback and referral statistics (clicks & sign-ups), (4) exposes a user-editable quick links section (add / remove / reorder) persisted per user in Firestore with smart defaults, (5) provides a persistent mobile/tablet bottom navigation bar with active-state indicators and smooth transitions, and (6) ships a desktop-class swipeable left side-menu drawer with hamburger / escape / backdrop / swipe dismiss, plus a user profile summary card and settings entry. The scope also includes typed TypeScript scripted validation harnesses, WCAG 2.1 AA accessibility affordances, and a full-coverage independent review gate.
- **Purpose**: Replace the basic Phase 2 dashboard scaffold with a rich, end-to-end interactive dashboard so users can see financial standing at a glance, act on frequent tasks in one tap, share referral links reliably, and navigate comfortably on phones, tablets, and desktops — while keeping Next.js 14 / Firebase v10 / Tailwind / glassmorphic design conventions consistent with Phases 1-2.
- **Target Users**: Authenticated + email-verified Apron end users on mobile (320–430px), tablet (768–1023px), and desktop (≥1024px) viewports; platform maintainers (via type-safe data contracts + test harnesses).

## Goals
- Build 6 required dashboard sections with pixel fidelity to the Apron dark purple + gold + glassmorphic design system, responsive across 320px → 1600px.
- Add Firestore-persisted per-user state fields where required: `quickLinks[]`, `referralClicks`, `referralSignups`, and `balanceHistory[]` snapshots so UI charts and referral stats are data-backed.
- Implement copy-to-clipboard with toast feedback; custom pointer-event side-menu swipe gestures; 60-minute auto-refresh of hourly rate data.
- Leave no dashboard section in the "scaffold" state — every enumerated requirement must have a verifiable behavior.
- Ship typed tsx validation harnesses for server actions and data contracts; ship a rendered-UI snapshot via the dev server + integrated browser.
- Maintain strict build/lint/type hygiene (`npm run build`, `npm run lint`, `npm run typecheck` exit 0) as in Phases 1-2.

## Non-Goals
- Full cross-browser automation on a remote Selenium/Playwright grid (browser verification is performed via the integrated Chromium-based preview, and CSS compatibility is kept to standard properties).
- Real WebSocket / Firestore Realtime listeners. "Real-time" in this scope means: 60-minute client-side polling for the hourly rate card, + a manual refresh button, and fresh server re-render on page navigation. No long-lived snapshots.
- Deep analytics tracking for referral link *click* attribution on the server. Clicks are counted via an incremental server action when the share card is rendered (simplified but tracked per user; click-count integrity is a best-effort client-fired tally).
- Add / remove of *custom* navigation items in the bottom nav or side menu (bottom nav and side menu retain their canonical platform nav sets; only the Quick Links section supports full user CRUD+reorder).
- External push notifications, browser extensions, or native wrappers.
- Vitest / Jest unit tests (per user preference: only scripted tsx TypeScript harnesses, no new test runner deps).
- New npm runtime deps beyond recharts (already installed); UI-only implementations use custom code.

## Background & Context
Phase 2 delivered a scaffold dashboard at `(app)/dashboard/page.tsx` that had:
- A static "Hourly coin rate" line with no trend chart, no fluctuation indicator, and no auto-refresh;
- Four hard-coded StatCards (Total Balance, Task Balance, Total Withdrawn, Indirect (Referrals)) but no pending-balance card and no historical trend charts;
- A referral URL card with a DOM-id-coupled `copy-status` element and `document.execCommand` fallback, but no toast component, no click/sign-up stats, and no accessible live-region feedback;
- A hard-coded 4-item quick-links list with no add / remove / reorder affordance, no per-user persistence, no behavioral defaults;
- An existing `SideMenu` component (`components/layout/SideMenu.tsx`) that supports hamburger + backdrop dismiss but **not** swipe gestures or a user profile summary / settings row;
- An existing `BottomNav` (`components/layout/BottomNav.tsx`) with 4 items that shows active state but lacks platform-appropriate transition details and tablet viewport behavior;
- Existing Firestore `UserDoc` schema missing `quickLinks`, `balanceHistory`, `referralClicks`, `referralSignups`;
- `recharts@2.13.0` already present in `package.json` and unused.

These gaps are the primary drivers of the Functional Requirements below.

## Functional Requirements

### FR-1 Balance cards (section)
- **FR-1.1 Render 4 balance cards** in a 1-col mobile / 2-col tablet / 2-col desktop responsive grid. The cards MUST be:
  1. **Available Balance** = `user.balance` (total spendable balance; primary card, gold gradient text).
  2. **Task Balance** = `user.taskBalance` (pink accent).
  3. **Pending Balance** = sum of pending-withdrawal `netAmount`s (calculated server-side from withdrawals); card shows a "Processing…" hint sublabel.
  4. **Historical Earnings (30 days)** = sum of all earning-doc `amount`s whose `createdAt` is within the last 30 days.
- **FR-1.2 Trend mini-charts**. Each card (Available Balance, Historical Earnings) MUST show an inline sparkline. Use recharts `<AreaChart>` for these mini sparklines. The trend data set fed to the chart is the new `UserDoc.balanceHistory[]` snapshots array (up to 30 most recent entries); if fewer than 3 exist, render a dashed empty-state placeholder instead of a chart.
- **FR-1.3 Interactive hover states**. Each balance card MUST have:
  - Glass base styling + `hover:bg-white/15` elevation (glow via `shadow-gold` on the Available card);
  - Subtle `active:scale-[0.99]` press feedback;
  - Focus-visible ring for keyboard users;
  - Tooltip on the ℹ️ question-mark badge explaining the balance definition (aria-describedby for a11y).

### FR-2 Hourly APN rate display
- **FR-2.1 Current rate rendering**. Render the current rate (`user.apnRate`) in a dedicated banner card with "Plan" pill (matching Phase 2 style).
- **FR-2.2 24-hour trend sparkline**. Show a recharts `<LineChart>` sparkline of the hourly rate over the last 24 hours. Data source: deterministic rolling window built from
  - Plan-doc `hourlyRate` (current rate repeated for the last 24h window as a baseline);
  - Plus the most recent `balanceHistory[]` snapshots within the 24h window (if any exist, projected to an effective APN rate per hour bucket based on `delta / hours elapsed` as a fallback visual).
  If `balanceHistory` contains fewer than 2 entries, the trend line may show a single flat line of the current rate.
- **FR-2.3 Fluctuation indicator**. Show a visual pill:
  - Green ↑ pill + text `+X%` when last snapshot rate > previous snapshot rate;
  - Red ↓ pill + text `-X%` when lower;
  - Grey ─ pill `0%` otherwise.
  Percentage is relative (% change between the two most recent balance-history effective rates). When only one or zero data points exist, show the grey "—" neutral pill.
- **FR-2.4 Auto refresh every 60 minutes**. Client-side `setInterval` fires a `refreshDashboardRateAction()` server action every 60 minutes, updating state without a full page reload. A manual "Refresh now" button must also exist. A loading spinner (reduced-motion friendly) is shown during refresh, with `aria-busy` applied to the rate card.
- **FR-2.5 Respects reduced motion**. `prefers-reduced-motion: reduce` disables the line animation on the sparkline chart and suppresses fade transitions.

### FR-3 Referral link card with copy-to-clipboard
- **FR-3.1 Referral link + code**. Render `SITE_URL/register?ref=<code>` in a monospace display box, and show the code separately as a pill (same as Phase 2 design but with proper semantics).
- **FR-3.2 One-click copy with visual toast feedback**. The Copy button MUST:
  1. Try `navigator.clipboard.writeText(text)` (HTTPS/secure contexts);
  2. Fall back to a hidden `<textarea>` + `document.execCommand("copy")` for insecure contexts;
  3. Emit an accessible toast notification (see FR-7 Toast system below) — ✅ **Copied!** success toast on 200-like success, or ❌ **Copy failed — try selecting manually** error toast when both strategies fail;
  4. Announce copy result via an `aria-live="polite"` region so screen readers read the outcome.
- **FR-3.3 Referral statistics card**. Display two stats:
  - **Referral clicks** = `user.referralClicks` integer (default 0);
  - **Verified sign-ups** = number of Firestore users `where("referredBy", "==", uid) AND emailVerified=true` (computed server-side, returned alongside dashboard data).
  Two mini StatCards side-by-side. Clicks are incremented on-demand via `incrementReferralClickAction()` when the user clicks the share card buttons (WhatsApp/Twitter/Copy button) as a proxy indicator (best-effort, not server-verified per link).
- **FR-3.4 Share buttons**. WhatsApp and Twitter share buttons (same pattern as current referrals page) live in the referral card (share URLs encode the referralLink).

### FR-4 Quick links section
- **FR-4.1 Per-user Firestore persistence**. Quick links are stored in `UserDoc.quickLinks: QuickLink[]` where `QuickLink = { id: string; href: string; label: string; iconName: string; custom?: boolean; order: number; }`. The server action `saveQuickLinksAction({ links })` overwrites the array for the current user; `getCurrentUserDataAction` returns it.
- **FR-4.2 Smart default links**. If `user.quickLinks` is missing or empty, auto-populate a default set based on user behavior / plan (default set: Tasks → Quiz → Contest → Wallet).
- **FR-4.3 Add / Remove / Reorder UI**. The section header has:
  - A "Edit" toggle; when active:
    - Each tile shows a ✕ (remove) button in the top-right;
    - A ⋮⋮ drag-handle affordance on the left, with HTML5 drag-and-drop reorder support (onDragStart / onDragOver / onDrop); also expose arrow-up / arrow-down buttons as keyboard-reorder fallback.
    - An **"Add link"** modal opens a small form with fields: label, href, and icon (from a predefined set: HelpCircle, ClipboardList, Trophy, Banknote, Wallet, Gift, Crown, GraduationCap, Share2). Saving fires `saveQuickLinksAction`. Custom links get `custom: true`.
- **FR-4.4 Responsive grid**. 2 columns mobile (<640px), 3 columns tablet (≥640px), 4 columns desktop (≥1024px). Each tile is glass-styled and matches the Phase 2 quick-link appearance.

### FR-5 Bottom navigation bar (mobile + tablet)
- **FR-5.1 Persistent across (app) routes**. The existing `BottomNav` continues to render only in the `(app)` variant of `AppShell` (not on admin or auth). It must NOT render on `/login` or `/register` (same guard as current).
- **FR-5.2 Five core items**. Change to five tabs:
  1. `/dashboard` — Home icon
  2. `/tasks` — ClipboardList icon
  3. `/wallet` — Wallet icon
  4. `/referrals` — UserPlus icon (new)
  5. `/history` — History icon
- **FR-5.3 Active indicator**. Active item highlight is an animated gold pill that smoothly slides (translateX) when the route changes (a CSS transition on the `left` / `width` of a decorative indicator bar, not a jarring swap).
- **FR-5.4 Tablet viewport behavior**. At viewports ≥768px but <1024px, bottom nav remains present but grows slightly taller and uses larger tap targets (padding adjusts).
- **FR-5.5 Tablet safe zones**. Uses `pb-[env(safe-area-inset-bottom)]` or equivalent so the iOS home indicator never covers a button.

### FR-6 Side menu drawer (desktop + larger screens)
- **FR-6.1 Slides in from left, overlay backdrop**. Reuse existing SideMenu backbone; keep its overlay backdrop + left slide-in. Animation timing stays `duration-200`.
- **FR-6.2 Swipe gesture support**. Implement custom pointer-event swipe-to-open / swipe-to-close (no deps):
  - Touch / pointer down on the leftmost 32px edge of the viewport → if `dx` (horizontal delta) exceeds 80px and `|dy| < |dx|` → trigger open.
  - Once open, a pointer drag with `dx` negative (leftward) exceeding 80px → trigger close.
  - All gesture state is React-managed local state with `usePointerCapture` / `releasePointerCapture` where appropriate; does NOT interfere with vertical scroll gesture (`|dy| > |dx|` releases capture and lets the page scroll).
  - Swipe gestures are *disabled* when `prefers-reduced-motion: reduce` (only button / backdrop / escape works).
- **FR-6.3 Hamburger trigger + Esc close + backdrop close**. Existing hamburger (Header) opens drawer. Keyboard `Escape` key closes drawer. Backdrop click closes drawer. All three triggers must fire the same `onClose` callback.
- **FR-6.4 User profile summary card**. A card at the top of the drawer shows:
  - User avatar (first-letter circle initial colored gold, same as dashboard greeting section);
  - `user.name` as heading;
  - `user.email` in smaller text;
  - Active plan badge: `STARTER` / `PRO` / `ELITE` uppercase pill with appropriate accent colors (starter grey, pro gold, elite pink).
- **FR-6.5 Settings link + logout**. Add a "Settings" row pointing to `/settings` before the divider; logout button remains below divider.
- **FR-6.6 Accessibility**: drawer uses `role="dialog"`, `aria-modal="true"`, `aria-label="Main menu"`, traps focus when open (first focusable element receives focus via `useEffect` + focus() call), and returns focus to the hamburger trigger on close.

### FR-7 Shared UI — Toast system (required by FR-3)
- **FR-7.1 Global toast controller**. Export a singleton or React-context `ToastContext` with `toast.show({ message, kind: "success" | "error" | "info", duration? })`.
- **FR-7.2 Rendering**. A `ToastViewport` component is mounted in the `AppShell` (variant=app) fixed at `bottom-28 left-1/2 -translate-x-1/2` (above bottom nav) for mobile viewports, or `top-4 right-4` (toast stack) for desktop.
- **FR-7.3 Kinds**: Success (green/emerald border, checkmark), Error (red border, X icon), Info (purple border, info icon). Every toast auto-dismisses at 2.4s (success/info) or 3.6s (error); they also have a ✕ manual dismiss and emit `aria-live="polite"` messages.

### FR-8 Shared UI — Modal / Dialog (required by FR-4.3 "Add link")
- **FR-8.1 Reusable `<Modal open onClose title>`** from existing `components/ui/Modal.tsx` (must exist and be used for add-link form, otherwise create one). Supports title, body children, primary + secondary action footer. Focus trap + escape close + backdrop close.

### FR-9 Server actions & Firestore schema additions
- **FR-9.1 New Firestore UserDoc fields** (added to `types/index.ts` with fallback reads so existing users without fields are treated as defaults):
  - `balanceHistory?: BalanceSnapshot[]` where `BalanceSnapshot = { at: number; balance: number; effectiveRate?: number; }`
  - `quickLinks?: QuickLink[]` (as FR-4.1)
  - `referralClicks?: number` (default 0)
  - `referralSignups?: number` (computed, never written; but cached/denormalized counter optional for perf)
- **FR-9.2 Server actions** (all "use server", session-gated via verifySessionCookie, Zod typed input/output):
  - `getCurrentUserDataAction()` — enriched to return pendingBalanceSum, historical30dSum, referralSignupsCount, quickLinks, balanceHistory, planDoc for plan hourlyRate.
  - `refreshDashboardRateAction()` — returns fresh `{ apnRate, plan, balanceHistoryLast24h, fluctuation }` for live card.
  - `saveQuickLinksAction({ links })` — Zod-schema QuickLink array, writes to user doc. Input max 12 links.
  - `incrementReferralClickAction()` — `FieldValue.increment(1)` on `referralClicks` (idempotent; call once per share button click per session).
  - `appendBalanceSnapshotAction()` — internal helper (called by `claimHourlyAccrualAction` end of transaction) that appends a new BalanceSnapshot to the tail of the array and trims to max 100 entries.

### FR-10 Accessibility (WCAG 2.1 AA)
- **FR-10.1 All interactive elements** (Copy, Refresh, Add link, Edit, Remove, Reorder arrows, Hamburger, Nav items, Claim, Toast dismiss, Modal close, Share buttons) MUST have accessible labels. Missing icons get `aria-label`; decorative-only icons use `aria-hidden="true"`.
- **FR-10.2 Color contrast**. Body text must be ≥4.5:1; large text ≥3:1 against background. Apron gold on dark purple must meet this; if not, darken gold or add a semi-transparent dark background pill behind gold text only where required.
- **FR-10.3 Focus management**. Modals + side drawer trap focus and return focus on close. `:focus-visible` styles (ring-2 ring-apron-gold) enabled globally via globals.css.
- **FR-10.4 Keyboard navigation**. Tab order is logical; all reachable elements have visible focus. Drag-and-drop reorder in quick links has an arrow-key fallback (FR-4.3).
- **FR-10.5 Reduced motion honored** (referenced in FR-2.5 and FR-6.2).
- **FR-10.6 `aria-live` regions** on toast container and copy result announcement.

### FR-11 Responsive & cross-browser
- **FR-11.1 Layouts** must be readable + usable (no horizontal scroll) at 320×640, 768×1024, 1280×800, and 1600×900. `max-w-[430px]` centered mobile container (app variant) is kept for phone screens; desktop variant (≥1024px) uses `max-w-6xl` with a sidebar-menu-on-left layout where nav sits in the page chrome *in addition to* the slide-in drawer.
- **FR-11.2 Use cross-browser safe CSS**: avoid non-standard -webkit- prefixes except scrollbar styling; all flex/grid is standard; vendor prefixed properties only where the Tailwind theme emits them.

### FR-12 Validation harnesses (tsx, no test runner deps)
- **FR-12.1 Dashboard server-action harness** `scripts/test-dashboard.ts` that:
  1. Loads env, seeds a test user if needed;
  2. Exercises `saveQuickLinksAction` → verifies round-trip;
  3. Exercises `incrementReferralClickAction` → verifies counter increases by 1;
  4. Exercises `refreshDashboardRateAction` → verifies shape matches Zod schema;
  5. Exercises `appendBalanceSnapshotAction` → verifies array grows and trims at 100;
  6. Prints a summary; exits non-zero on any failure.
- **FR-12.2 Accessibility + TypeScript shape check**: `scripts/test-dashboard.ts` must import `z.infer`-like shapes from the action schemas and validate returned objects. A failed Zod validation causes exit code 1.

## Non-Functional Requirements

- **NFR-1 (Design fidelity)**: Every new section uses purple gradient `bg-apron-gradient` wrapper, gold primary CTAs, `.glass` cards with `backdrop-blur-md bg-white/10 border-white/20`. Buttons inherit the existing `Button` component (primary / secondary / outline / ghost variants).
- **NFR-2 (Responsive / cross-browser)**: No horizontal scroll at 320px; grid breakpoints 2-col → 3-col → 4-col for quick links; 1-col → 2-col for balance cards.
- **NFR-3 (Secure boundaries)**: All server actions import `"use server"`; Firestore Admin reads/writes continue through `lib/firestore.ts` with `server-only` gating. No user ids accepted from request body without session verification (no `uid` field as plain input — always derive from session cookie).
- **NFR-4 (Type safety)**: Every server action uses a Zod schema for input and returns a discriminated-union `{ ok: true, ... } | { ok: false, error: ... }` shape where applicable. No `any` type additions; build `tsc --noEmit` must pass.
- **NFR-5 (No new runtime npm dependencies)**: Recharts already installed and is used. No other runtime deps. No Vitest/Jest. All validation happens with tsx scripts.
- **NFR-6 (Build hygiene)**: `npm run build && npm run typecheck && npm run lint` must exit 0 after implementation is complete.
- **NFR-7 (Performance)**: Dashboard LCP on mobile (emulated via Chrome DevTools slow 4G) remains under 3 seconds for the server-rendered shell; individual client hydration of charts happens via dynamic `import("recharts")` if necessary to keep first JS chunk small.
- **NFR-8 (Graceful degradation)**: If Firestore is down, user sees a friendly "Unable to load dashboard data" message instead of a white crash. If recharts fails to load, sparklines are replaced with a text summary (e.g. "Trend data unavailable").

## Constraints
- **Technical**: Next.js 14 App Router; `server-only` gating for admin imports; Firebase v10 client + firebase-admin; Tailwind + existing glass/gold/purple tokens; Zod for schema validation; existing pattern of single-object args for server actions.
- **Business**: Hourly rate "real-time" sync is 60-minute polling + manual refresh, *not* Firestore snapshot listeners (per NFR-3 / cost management). Referral click counts are best-effort client tallies — no guarantee of 100% accuracy (stated explicitly in UI via sublabel "Estimated").
- **Dependencies**: No new runtime packages. Dev deps stay the same. Firestore `users` collection must be writable by end users for their own `quickLinks` and `balanceHistory` fields — `firestore.rules` MUST be updated accordingly (see FR-9) so the client cannot escalate to `role=admin` or write protected fields.

## Assumptions
- Recharts (current v2.13.0) supports the responsive sizing we need out of the box with `ResponsiveContainer`.
- Windows NTFS `npm install` hangs remain addressed by the `--no-audit --no-fund` flags (as documented in project memory).
- Users have at most a few hundred earning documents; summing 30-day history on the server within the action is acceptable performance (no map-reduce).
- The existing `AppShell` mobile-first `max-w-[430px]` constraint is relaxed on desktop ≥1024px to a wider layout per FR-11 — this is achieved by adding a breakpoint-based class inside the existing `variant === "app"` path, not by creating a new layout variant.

## Open Questions
- [x] Chart library → recharts (answered).
- [x] Quick links persistence → Firestore per user (answered).
- [x] Side drawer gestures → Custom pointer-event based (answered).
- [x] Unit tests → TypeScript `tsx` harnesses only (answered). No Vitest deps.

## Acceptance Criteria

### AC-1: Four balance cards render + interact with responsiveness and hover states
- **Type**: `rule`
- **Given**: An authenticated user visits `/dashboard`
- **When**: The page renders on mobile (360px), tablet (768px), desktop (1280px)
- **Then**: Four cards (Available, Task, Pending, 30d Historical) appear in a 1-col mobile / 2-col tablet+ grid; on hover each card shows glass elevation + subtle lift; focus-visible state has a gold ring; tooltips explain each metric
- **Pass Condition**: Source of `dashboard/page.tsx` shows 4 cards in grid layout with appropriate Tailwind classes; snapshot of rendered page shows 4 distinct card containers with icons/values
- **Evidence**: Code inspection of dashboard section + browser snapshot showing 4 cards at 1280px width

### AC-2: Pending balance is computed from pending withdrawals; Historical sum uses 30-day window
- **Type**: `rule`
- **Given**: A user has 1 pending withdrawal (netAmount=5000) and earning documents spanning 40 days
- **When**: `getCurrentUserDataAction()` returns dashboard payload
- **Then**: `pendingBalance === sum(netAmount where status==='pending')` and `historicalSum30d === sum(amount where createdAt > now-30d)`
- **Pass Condition**: Scripted harness `scripts/test-dashboard.ts` seeds fixtures → calls action → assert equality
- **Evidence**: Harness output showing correct totals with known fixtures; source of the `getCurrentUserDataAction` computation logic

### AC-3: Available Balance + Historical have mini sparklines (recharts)
- **Type**: `rule`
- **Given**: A user with at least 3 `balanceHistory` snapshots
- **When**: Dashboard is rendered
- **Then**: Two recharts charts are mounted (AreaChart or LineChart as appropriate); empty state shows dashed placeholder otherwise
- **Pass Condition**: Dashboard source imports from `recharts` and uses them conditionally; DOM snapshot contains `<svg>` for the charts
- **Evidence**: Import statements + browser snapshot showing visible sparkline SVG elements

### AC-4: Hourly rate card shows current rate, 24h sparkline, fluctuation pill, and auto-refreshes every 60 minutes
- **Type**: `rule`
- **Given**: Dashboard mounted in a client browser tab
- **When**: (a) initial render; (b) fluctuation between last two effective rates is positive (+5%); (c) user waits 60 minutes or clicks "Refresh now"
- **Then**:
  - (a) Current `apnRate` displays as `formatAPN(X) / hour`
  - (b) Green ↑ "+5%" pill shows for +5% change
  - (c) `refreshDashboardRateAction` is called and the card has `aria-busy="true"` during refresh
- **Pass Condition**: Source of rate card React component contains `setInterval(…, 3_600_000)`, fluctuation logic, and manual refresh trigger; harness asserts `refreshDashboardRateAction()` returns a Zod-validated result object
- **Evidence**: Code inspection + harness output for refreshDashboardRateAction shape check

### AC-5: Copy-to-clipboard fires success/error toast via aria-live
- **Type**: `rule`
- **Given**: User on dashboard page, referral link card visible
- **When**: User clicks "Copy" button (a) with `navigator.clipboard` working; (b) with it failing but fallback working; (c) with both strategies failing
- **Then**: (a/b) Success toast appears "Copied to clipboard!" announced via aria-live; (c) Error toast appears "Copy failed — try selecting manually"
- **Pass Condition**: Toast context is wired up in AppShell; copy-button function has two strategies and calls `toast.show(...)` with correct kind on each outcome; aria-live region exists in DOM
- **Evidence**: Source of CopyReferralButton (now enhanced) + ToastContext + ToastViewport wiring + browser snapshot of toast viewport in DOM

### AC-6: Referral card shows clicks & verified sign-ups stats; share buttons present with WhatsApp/Twitter URLs
- **Type**: `rule`
- **Given**: User has 3 referralClicks and 1 verified invitee in Firestore
- **When**: Dashboard renders the referral card
- **Then**: Two stat mini-cards show "3 clicks" and "1 verified"; WhatsApp/Twitter share URLs contain encoded referralLink; clicking any share button fires incrementReferralClickAction
- **Pass Condition**: Harness seeds user with referralClicks=3, then creates + verifies 1 invitee, calls enriched action and asserts counts; UI DOM snapshot shows both number values rendered
- **Evidence**: Harness assertion output + browser snapshot of the referral stats row

### AC-7: Quick links are Firestore-persisted, support add / remove / reorder with drag-and-drop and keyboard fallback
- **Type**: `rule`
- **Given**: User A opens dashboard with empty quickLinks then adds a link "Hello" href="/plans", removes Tasks link, reorders Quiz to first position
- **When**: User B (fresh device) logs in with same account and visits dashboard
- **Then**: Dashboard of B matches A's custom order; default links populate on first-ever visit; Edit-mode toggle shows Add/Remove affordances
- **Pass Condition**: saveQuickLinksAction round-trips via scripted harness; UI has drag handlers + arrow-up/arrow-down buttons; source shows Edit toggle
- **Evidence**: Harness round-trip test pass output; browser snapshot in Edit mode with remove handles visible; Add-link modal source

### AC-8: Bottom nav has 5 core items with smooth active indicator slide, tablet/mobile widths work correctly, iOS safe zones respected
- **Type**: `rule`
- **Given**: Authenticated user navigates `/dashboard` → `/wallet` → `/tasks`
- **When**: Route transitions complete
- **Then**: Bottom nav always shows 5 items; active item's gold pill slides smoothly between positions with transition; nav renders on 768px tablet but with increased padding; env(safe-area-inset-bottom) style applied
- **Pass Condition**: BottomNav source contains 5 items, transition CSS on indicator, safe-area padding class; navigation DOM snapshot on 3 routes shows correct active label highlighted
- **Evidence**: Source of BottomNav.tsx post-change + browser snapshot of nav on multiple routes

### AC-9: Side menu supports hamburger / Esc / backdrop / swipe gestures; profile summary card + settings row included; focus trap works
- **Type**: `rule`
- **Given**: Dashboard loaded on desktop viewport
- **When**: (a) click hamburger (b) press Escape while open (c) click backdrop (d) drag-left 100px from open state (e) on load focus check
- **Then**: (a) opens; (b/c/d) closes; (e) focus lands inside drawer on the first nav link and returns to hamburger on close
- **Pass Condition**: SideMenu source includes pointer event handlers (pointerdown/move/up/cancel) with capture release; useEffect for Escape key listener; profile card JSX present; focus trap code present
- **Evidence**: Source inspection of SideMenu.tsx showing pointer event handlers, profile card section, focus management useEffect

### AC-10: Firestore rules updated to allow users to write own `quickLinks` / `balanceHistory` / `referralClicks` while protecting `role` / `plan` / `balance` writes
- **Type**: `rule`
- **Given**: End user with uid=XYZ attempts to (a) modify their own quickLinks array; (b) escalate role to "admin"; (c) set balance to 1e9 directly
- **When**: Rules evaluator runs against paths
- **Then**: (a) allowed; (b) rejected; (c) rejected
- **Pass Condition**: firestore.rules file contains `/users/{userId}` match clause with allow-list of writable fields (quickLinks, balanceHistory, referralClicks, name, phone, bankDetails) and denies other writes
- **Evidence**: Firestore rules source diff showing field-level whitelist

### AC-11: Design fidelity — Purple gradient, gold CTAs, glass cards, hover animations
- **Type**: `rubric`
- **Dimension**: Visual design alignment with Apron system
- **Scale**: 1-5
- **Anchors**: 1 = missing gradient / non-glass cards / non-gold primary buttons; 3 = gradient present but inconsistent spacing or missing focus styles; 5 = gradient wrapper, glass cards everywhere, gold primary CTAs, hover + press micro-interactions, matching typography scale
- **Pass Threshold**: >= 4
- **Evidence**: Browser snapshot showing dashboard on desktop view; source inspection of tailwind classes

### AC-12: Mobile responsiveness + no horizontal scroll from 320px→1600px
- **Type**: `rubric`
- **Dimension**: Layout robustness across breakpoints
- **Scale**: 1-5
- **Anchors**: 1 = horizontal scroll < 400px; 3 = usable at 400px but awkward at 320px; 5 = perfect flow at 320px no overflow, grids collapse/expand correctly at 768px + 1280px, nav chrome doesn't overlap content
- **Pass Threshold**: >= 4
- **Evidence**: Source responsive classes + browser snapshots at 320px and 1280px widths

### AC-13: WCAG 2.1 AA basic accessibility rules satisfied
- **Type**: `rubric`
- **Dimension**: Accessibility coverage (a11y)
- **Scale**: 1-5
- **Anchors**: 1 = most icons lack aria-labels, no focus styles; 3 = mostly labeled but missing focus trap / aria-live; 5 = labels exist on every actionable item, focus-visible rings, focus traps (drawer/modal), aria-live toasts, color contrast ratio ≥4.5:1 for body text, reduced motion respected
- **Pass Threshold**: >= 4
- **Evidence**: Source shows aria-label / aria-hidden usage, ToastContext aria-live, SideMenu focus trap effect, reduced-motion conditionals, globals.css focus styles

### AC-14: Build, lint, typecheck all pass
- **Type**: `rule`
- **Given**: Repository state after changes
- **When**: `npm run build && npm run typecheck && npm run lint` runs
- **Then**: All three commands exit 0
- **Pass Condition**: Exit code 0
- **Evidence**: Terminal log capturing exit code 0 sequence

### AC-15: TypeScript validation harness `scripts/test-dashboard.ts` runs successfully with zero Zod errors
- **Type**: `rule`
- **Given**: FIREBASE_* env vars available (admin SDK can initialize)
- **When**: `npx tsx scripts/test-dashboard.ts` runs
- **Then**: It prints per-case PASS/FAIL, seeds + cleans up test data, and exits 0 if every test passes, 1 otherwise
- **Pass Condition**: Non-zero exit on any assertion failure; at least 5 passing assertions (saveQuickLinks, incrementReferralClick, refreshDashboardRate shape, enriched user data shape, balanceSnapshot append+trim)
- **Evidence**: Harness source file + terminal log showing PASS lines + exit 0

### AC-16: No session / secret leakage and server-only boundaries preserved
- **Type**: `rule`
- **Given**: Source of server actions + built client chunks
- **When**: Searching for `getAdminDb()` or `firebase-admin` imports in client-compiled code; check each server action file
- **Then**: Every server action that uses admin Firestore is in a file with `import "server-only"` (or the shared `lib/firestore.ts` already has the gate); no server-only code leaks to client
- **Pass Condition**: lib/firestore.ts first line is `import "server-only"` (already present); each action module either imports firestore.ts and uses `import "server-only"` in the calling file if the action file itself calls admin directly
- **Evidence**: `Grep` for server-only in relevant files; absence of admin SDK in any file under app/ that exports client components
