# Session Handling

## Token format

A compact JWS, signed HS256, produced by `jose`:

```
atty_admin = base64url(header) "." base64url(payload) "." base64url(signature)

header  = { "alg": "HS256" }
payload = { "role": "admin", "iat": <unix seconds>, "exp": <unix seconds> }
```

The payload carries a role and two timestamps. Nothing else — no name, no
email, no PIN, no student data. That is deliberate: the Next.js guidance is
that a session payload should hold the minimum unique data needed for later
requests and no personally identifiable information.

Sessions are **stateless**. Nothing is stored server-side, so a token cannot be
looked up, enumerated, or individually revoked before it expires.

### Algorithm pinning

`jwtVerify` is called with `algorithms: ["HS256"]`. That option is what
prevents algorithm confusion: without it, an attacker could re-sign a token
with `alg: none` or swap in an asymmetric algorithm and have it accepted. The
verify path also re-checks the decoded shape — a valid signature over an
unexpected payload is still an unexpected payload — and returns `null` rather
than trusting `role` blindly.

## Cookie attributes

| Attribute | Value | Why |
|---|---|---|
| Name | `atty_admin` | Distinct from any framework cookie. |
| `HttpOnly` | `true` | Blocks `document.cookie`, so an XSS cannot exfiltrate the session. |
| `Secure` | `true` in production | HTTPS only. Off in development so `http://localhost` works. |
| `SameSite` | `Lax` | Blocks cross-site POST replay while allowing top-level navigation. |
| `Path` | `/` | Covers every app route. |
| `Max-Age` | `43200` (12 h) | Matches `exp`. |

No `Domain` attribute, so the cookie stays host-only.

## Lifetime

`SESSION_TTL_SECONDS = 43_200` — 12 hours, **absolute, not sliding**.

The length covers a full event day including setup, so kiosk staff authenticate
once rather than at every break.

Absolute rather than sliding for two reasons. A sliding window means the cookie
must be re-issued as the user browses, and the only places that can legally
mutate a cookie are a Route Handler, a Server Action, or the proxy — not a
render path, since Next.js forbids cookie mutation during render. Keeping
expiry absolute keeps verification a pure function with no side effects, which
is what makes it cheap to test.

The cost is that a session genuinely ends after 12 hours even if it is in active
use. For this application that is the right trade: re-entering a PIN is cheap,
and an unbounded session on a shared device is not.

## The three enforcement layers

A session check in one place is one mistake away from being bypassed. There are
three, and only the middle one is load-bearing.

### Layer 1 — `proxy.ts` (optimistic)

Runs before any route renders. Sends unauthenticated page requests to `/login`
and answers unauthenticated API calls with `401`, without booting React or
touching Apps Script.

Two Next.js 16 details matter here:

- `middleware` was **renamed to `proxy`** and the old name is deprecated.
- Proxy runs on the **Node.js runtime**, so `lib/auth/session` imports without an
  edge-runtime caveat.

Its matcher covers both pages and `/api`, excluding only static assets —
otherwise the login page could not load its own CSS or JS. `_next/data` is
deliberately *not* excluded: Next.js invokes proxy for those routes even when
the pattern omits them, precisely so a protected page cannot leak its data
route.

**This layer is not a security boundary.** The Next.js documentation is explicit
that a matcher change "can silently remove Proxy coverage" and that proxy
"should not be your only line of defense". `lib/auth/rate-limit.ts` is
deliberately *not* imported here — it is stateful, and the proxy docs warn
against relying on shared module state.

### Layer 2 — `lib/auth/dal.ts` (authoritative)

Every page and every route handler calls one of:

- `requireAdmin()` — Route Handlers. Throws `HttpError(401, "UNAUTHORIZED")`,
  which `lib/api.ts` already maps to `401`.
- `requireAdminPage()` — pages. Redirects to `/login` instead of throwing, so a
  visitor gets the sign-in page rather than an error boundary.

This is the check that protects the data. Deleting `proxy.ts` would not open
the application.

Checks live in pages and handlers, never in a layout: a layout does not control
whether child segments render, so a layout check is advisory only.

`lib/auth/dal.test.ts` covers this layer directly, because at runtime it is hard
to tell which layer produced a given 401. `lib/auth/cache-isolation.test.ts`
walks the source tree and fails if any route or page is missing its guard.

### Layer 3 — Apps Script (independent)

The web app is deployed `ANYONE_ANONYMOUS`, so its URL is callable by anyone
who has it. It requires two credentials, not one:

- `APPS_SCRIPT_SECRET` — proves the caller is the Next.js server.
- `ADMIN_SERVICE_KEY` — proves the caller holds a valid admin session.

Both are checked in constant time before the action name is even looked up, so
an unauthenticated caller cannot probe which actions exist. Both fail closed: an
unconfigured Script Property rejects every request.

Before this layer existed, holding the web app URL plus `APPS_SCRIPT_SECRET` was
enough to read and write the spreadsheet directly, bypassing the PIN entirely.
That is the specific hole this closes.

#### Why a service key and not the caller's session token

`ADMIN_SERVICE_KEY` is a server-to-server credential, not a forwarded user
session. The obvious alternative — passing the caller's own session token
upstream so Apps Script could verify a real login — is not viable here.

Every read goes through `integration/cached.ts`, which wraps the Apps Script
calls in `unstable_cache`. Cached reads execute **outside any request context**,
so the originating session is not available to `integration/http.ts` when the
request body is built. Plumbing it through would mean threading request context
into cached functions, which fights the cache and cannot be relied on for
correctness.

A service key closes the actual threat — an outsider holding the web app URL —
completely. An operator with access to the Next.js environment already has full
access through the application itself, so a per-user proof would not restrict
them either.

## The read-cache constraint

`integration/cached.ts` memoises read results across requests, instances, and
deploys. That is fine for a single role: every authenticated principal is an
`admin` and every admin sees identical data, so there is no per-user partition
to leak.

Two rules follow. Both are enforced by
`lib/auth/cache-isolation.test.ts`, not by convention.

### 1. No auth check may live inside a cached function

If `requireAdmin()` were called inside an `unstable_cache` wrapper, its verdict
would be cached too and replayed to later callers who never authenticated — a
complete bypass. Every check sits outside the cached data functions, in the
page or handler.

This is the rule most likely to be broken by accident: moving a check one line
inward looks harmless and inverts the security model.

### 2. `cachedJson` must stay `private`

`lib/api.ts` sets `Cache-Control: private`, keeping per-browser responses out of
shared caches. Correct under a single role; revisit if roles are ever added.

## Logout

`POST /api/auth/logout` deletes the cookie. There is no server-side record to
remove, and the browser discards the token.

Anything already captured by an attacker **stays valid until `exp`**. Logout is
a convenience for shared devices, not a revocation mechanism. To invalidate
outstanding sessions, rotate `SESSION_SECRET`.

The lock button performs a hard navigation rather than a client-side push, so
the previous page's RSC payload does not linger in the router cache where going
back could re-render authenticated content.

## Open redirects

`?next=` is untrusted input. `lib/auth/redirect.ts` accepts only a
single-slash-prefixed same-origin path and rejects:

| Rejected | Reason |
|---|---|
| `//evil.com` | Browsers treat a leading double slash as protocol-relative. |
| `/\evil.com` | Also treated as protocol-relative. |
| `https://evil.com` | Absolute URL. |
| `javascript:` / `data:` | Scheme injection. |
| `../admin` | Not rooted. |
| Anything with `\r`, `\n`, or `\0` | `Location` header injection. |

Everything else falls back to `/`. The same function is used by the proxy and
the login page, so there is one implementation to audit.

## What to check when changing this

| Change | Re-run |
|---|---|
| Token format, signing, or verification | `lib/auth/session.test.ts` |
| Adding a route or page | `lib/auth/cache-isolation.test.ts` |
| The proxy matcher | `lib/auth/redirect.test.ts`, then re-verify the layer-2 tests still pass — they do not depend on the proxy |
| Cookie attributes or TTL | `lib/auth/dal.test.ts`, then a manual sign-in |
| Anything in `apps-script/auth.gs` | `apps-script/auth.test.ts` |
