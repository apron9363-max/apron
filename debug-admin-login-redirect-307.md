# Debug Session: admin-login-redirect-307
Status: [OPEN]
Created: 2026-10-08
Bug: GET /admin returns 307 → redirects to /admin/login even with valid credentials.
Expected: GET /admin returns 200 with dashboard content.

## Hypotheses
| # | Hypothesis | Falsification Observation |
|---|-----------|---------------------------|
| H1 | Browser does not receive or store the `admin_session` cookie from `/api/admin/login` response (Cookie header serialization issue). | HTTP trace shows no `Set-Cookie` on login response, or `Cookie:` header missing from subsequent `GET /admin`. |
| H2 | `verifySessionCookie()` in session.ts rejects the token (HMAC secret mismatch between cookie-generation and verification paths, e.g., dev-ephemeral key rotation). | Log shows `verifyAdminSessionCookie()` returns null even with a non-empty cookie value present. |
| H3 | `middleware.ts` runs before cookie is available to the request — middleware gating redirects at path `/admin` before the layout/server-component auth check can see the cookie. | Middleware log shows `adminSessionCookie` undefined for the GET /admin request that has Cookie: header in HTTP layer. |
| H4 | Admin layout (`/admin/layout.tsx`) redirect in Server Component triggers a 307 because cookie-store read via `cookies()` does not see the HTTP-transmitted cookie in the Server Component execution context. | Layout calls `verifySessionCookie()` → null → redirects, even when middleware saw the cookie via `req.cookies`. |
| H5 | Credentials comparison fails in `verifyAdminCredentials()` (e.g., encoding/timingSafeEqual buffer mismatch), so no cookie is ever set. | API route log shows `valid === false` even with `apron9363@gmail.com` / `Apron@2026`. |

## Evidence Log

### Runtime traces (6 events in trae-debug-log-admin-login-redirect-307.ndjson)
| # | runId | Hypo | Location | Finding |
|---|-------|------|----------|---------|
| 1 | pre | E (cred) | api/admin/login/route.ts:33 | email=apron9363@gmail.com valid=**true** → **REJECT H5** |
| 2 | pre | A (cookie set) | api/admin/login/route.ts:44 | Set-Cookie header written (270 chars), token starts `eyJzdWIiOiJ…` → **H1 (issuance side) cannot yet be rejected** |
| 3 | pre | B (cookie read) | adminSession.ts:170 | `verifyAdminSessionCookie()` for GET /admin reads cookie successfully (hasCookie=true, len=208, prefix matches) → **REJECT H1 (storage side) & REJECT H3 (middleware)** |
| 4 | pre | B (token verify) | adminSession.ts:182 | `verifyAdminToken()` → **`payloadValid: false`** despite exact same token content being present in cookie → **CONFIRM H2 (HMAC mismatch)** |
| 5 | pre | D (layout session) | admin/layout.tsx:50 | `hasSession:false` role:null → layout redirects |
| 6 | pre | D (layout redirect) | admin/layout.tsx:58 | `redirect → /admin/login` at pathname `/admin` → **CONFIRMS the 307 is from Server Component redirect(), NOT middleware** |

### Browser Network Trace (integrated browser, 20 requests)
- `[10] POST /api/admin/login (Fetch)` → responds 200 ok:true, Set-Cookie present.
- `[11] GET /admin/login (Document)` immediately follows. Navigated `window.location.href` → `/admin` (full nav) gets 307 (Server Component `redirect()`) → browser ends on `/admin/login` doc (request [11]).
- No middleware redirect log (H3) → middleware cookie visibility was fine (passed through).

## Hypothesis Verdict
| # | Hypothesis | Status | Reason |
|---|-----------|--------|--------|
| H1 | Cookie not received/stored by browser | REJECTED | Trace [3] shows cookie read with matching prefix and correct length (208). |
| H2 | HMAC secret mismatch | **CONFIRMED** | `payloadValid=false` with cookie intact. Root cause: `resolveHmacSecret()` in dev fallback uses `Date.now()` appended to a string, and is called on-demand in Route Handler (ts ~0ms) vs Server Component (ts ~20s later) → two different keys. |
| H3 | Middleware redirect (cookie not visible to req.cookies) | REJECTED | No middleware `report()` log in evidence (lines 1-6) → request passed middleware. The 307 originates at admin/layout.tsx (trace 6). |
| H4 | Layout `cookies()` store can't read HTTP cookie | REJECTED | Trace [3] (H2 cookie read) shows `hasCookie:true len:208 same-prefix` → `cookies()` store reads it correctly. |
| H5 | Credentials themselves rejected | REJECTED | Trace [1] shows `valid:true`. |

## Fix Summary
Root cause: `resolveHmacSecret()` **regenerates** a new dev ephemeral secret on **every invocation** because it embeds `Date.now()` inline with no caching. Different module-resolution contexts (Next.js Route Handler vs Server Component rendering) each resolve the function at different wall-clock times → different keys → token rejected.

### Targeted Fix: Lazy-singleton cached HMAC secret
In `adminSession.ts`:
1. Add module-scoped variable: `let _hmacSecretCache: string | undefined = undefined;`
2. In `resolveHmacSecret()`: if cache hit, return cached; otherwise compute ONCE and store.
3. Preserve behavior for prod env: env-var-derived secrets are still cached.

This is the **minimal surgical change** (< 6 lines) and only modifies code directly responsible. All 3 other hypotheses were falsified with direct evidence; no other code paths need to change.

## Pre/Post Verification
| Metric | Pre-fix (Observed) | Post-fix (Target) |
|--------|--------------------|-------------------|
| POST /api/admin/login HTTP status | 200 ok:true | 200 ok:true |
| POST /api/admin/login Set-Cookie present | Yes (270 chars) | Yes |
| HMAC key at signing vs verification | DIFFERENT (Date.now drift) | IDENTICAL (cached singleton) |
| `verifyAdminToken()` payloadValid | **false** | **true** |
| GET /admin HTTP status | 307 → /admin/login | **200 /admin** |
| Admin dashboard loads? | No (redirected back) | **Yes** |

## Fix Summary
(To be filled)

## Pre/Post Verification
| Metric | Pre-fix | Post-fix |
|--------|---------|----------|
| POST /api/admin/login HTTP status |  |  |
| POST /api/admin/login Set-Cookie present |  |  |
| GET /admin HTTP status | 307 |  |
| GET /admin → location | /admin/login |  |
