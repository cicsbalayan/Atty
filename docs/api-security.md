# API Security

Covers the Next.js ↔ Apps Script boundary: the two credentials, the
`ANYONE_ANONYMOUS` posture, what each action exposes, and the response headers.

## The deployment posture

`apps-script/appsscript.json` sets:

```json
"webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }
```

`ANYONE_ANONYMOUS` means the web app URL is callable by anyone who has it, with
no Google account. This is deliberate — it is what lets the Next.js server call
the backend without exporting a service-account key — but it makes the web app
URL itself a sensitive asset. Treat it like a password.

`USER_DEPLOYING` means every request runs with the deploying user's own access
to the spreadsheet. **The deploying account should therefore have access to
nothing but this one spreadsheet.** A broadly-privileged account turns any
backend compromise into a Google-account compromise.

Changing `access` to `ANYONE` (requiring a Google login) would break the
server-to-server call, since the Next.js server has no Google identity. The
credential check below is what compensates.

## Two credentials, both required

Every `POST` to the web app must carry both:

| Field | Property on the Apps Script side | Purpose |
|---|---|---|
| `secret` | `APPS_SCRIPT_SECRET` | Proves the caller is the Next.js server. |
| `adminKey` | `ADMIN_SERVICE_KEY` | Proves the caller holds a valid admin session. |

```js
Auth.verify(body.secret)        // constant-time
Auth.verifyAdminKey(body.adminKey)  // constant-time
```

Both checks run **before** the action name is looked up, so an unauthenticated
caller cannot enumerate valid action names. `doPost` returns `UNAUTHORIZED`
rather than `INVALID_REQUEST` in that case.

Both are stored as **Script Properties** and compared with `safeCompare`, an
XOR-accumulate loop that does not short-circuit on the first differing
character. A plain `===` returns faster the earlier two strings diverge, which
is a measurable oracle for recovering a secret one character at a time.

Both **fail closed**. An unconfigured property rejects every request with
`CONFIGURATION_ERROR` — a distinct code from `UNAUTHORIZED`, so an operator can
tell "not signed in" from "not deployed correctly".

### Why a second credential is necessary

With only `APPS_SCRIPT_SECRET`, anyone holding both the web app URL and that
secret had full read and write access to the spreadsheet — bypassing the
application's PIN, its session cookie, and every other control in the Next.js
tier. `ADMIN_SERVICE_KEY` exists so that neither credential is sufficient
alone.

The trade-offs behind using a service key rather than forwarding the caller's
session token are documented in
[session-handling.md](session-handling.md#why-a-service-key-and-not-the-callers-session-token).
The short version: every read is served through `unstable_cache`, which runs
outside request context, so the caller's session is not available where the
request body is built.

## Errors carry no secrets

`doPost` returns a stable machine-readable code and a message safe to relay to
a browser. Internal detail goes to `console.error`, which lands in the Apps
Script execution log rather than in a response.

Error codes are mapped to HTTP status by the BFF in `lib/api.ts`:

| Code | Status | Meaning |
|---|---|---|
| `INVALID_REQUEST` / `INVALID_FIELD` | 400 | Malformed input. |
| `UNAUTHORIZED` | 401 | Credential rejected. |
| `METHOD_NOT_ALLOWED` | 405 | `GET` on the web app. |
| `EVENT_NOT_FOUND` / `SRCODE_NOT_FOUND` / `ORG_NOT_FOUND` | 404 | |
| `DUPLICATE_ATTENDANCE` / `EVENT_NOT_ACTIVE` | 409 | |
| `CONFIGURATION_ERROR` | 503 | A Script Property or env var is missing. |
| `UPSTREAM_UNAVAILABLE` | 502 | Network failure or non-JSON response. |
| `INTERNAL_ERROR` | 502 | Unexpected backend error. |

## Action authorization

There is one role, so every action requires a valid session and there is no
per-action permission table. All seventeen actions sit behind the same gate.

| Action | Method | Notes |
|---|---|---|
| `getOrganizations` | `POST` | Reads the Organizations sheet. Excludes soft-deleted rows. |
| `getOrganization` | `POST` | Reads one organization, **including** a soft-deleted one, so report letterheads keep resolving. |
| `createOrganization` | `POST` | **Write.** Appends an organization row. |
| `updateOrganization` | `POST` | **Write.** |
| `deleteOrganization` | `POST` | **Write.** Soft delete: stamps the row, keeps it. |
| `restoreOrganization` | `POST` | **Write.** Clears the soft delete stamp. |
| `getEvents` | `POST` | Reads the Events sheet. |
| `getEvent` | `POST` | Reads one event. |
| `createEvent` | `POST` | **Write.** Creates a new `EVT-XXX` sheet. `orgId` is optional; a non-empty value must resolve. |
| `updateEvent` | `POST` | **Write.** Accepts `orgId` and `time`. |
| `openEvent` | `POST` | **Write.** Enables check-ins. |
| `closeEvent` | `POST` | **Write.** |
| `recordAttendance` | `POST` | **Write.** Appends an attendance row. |
| `checkAttendance` | `POST` | Read. Pre-check before recording. |
| `getAttendance` | `POST` | Read. |
| `getAttendanceReport` | `POST` | Read. Aggregates by college, program, year, gender. |
| `lookupStudent` | `POST` | Read. Returns a student record by SR Code. |

**Personal data.** The Masterlist holds names, colleges, programs, year levels,
and genders for every student. Every action above can return it. This is the
reason the whole application is admin-only: there is no anonymous tier, and no
action returns student data without a valid session.

The frontend holds no student PII of its own. Attendance rows are joined on
render, and `lib/auth/dal.ts` returns only the minimum needed to render.

### Adding a per-action permission

The web app has no notion of roles, so this would mean: add a role to the
session payload (already scaffolded), forward something identifying the role
upstream, and have `doPost` consult a permission table before dispatch.

Do that only alongside the per-user read cache noted in
[session-handling.md](session-handling.md#the-read-cache-constraint). A role
that cannot see different data is a UI convenience, not a control.

## Security headers

Set in `next.config.ts` for every response:

| Header | Value | Reason |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Stops a response being reinterpreted as executable content. |
| `X-Frame-Options` | `DENY` | No framing need. Also removes a clickjacking vector against the PIN field, where an attacker could overlay a fake input and capture what is typed. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Keeps event IDs and filter strings out of third-party Referers while allowing same-origin ones, which shareable filter URLs rely on. |
| `X-Powered-By` | removed | Stops advertising the exact framework and version. |

### Content-Security-Policy: not yet set

Deliberately deferred. A correct CSP for the App Router has to account for
inline bootstrap scripts, `next/font` style injection, and the kiosk
`:fullscreen` path. Getting it wrong breaks the app in ways that are slow to
diagnose, so it needs verification in a real browser across every route rather
than a best guess in a config file.

When adding one, start in report-only mode and watch for violations:

```
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

Then narrow from the reported violations. Note that the report endpoint itself
needs to exist, and that `'unsafe-inline'` may be required for styles unless
nonces are threaded through — a nonce rollout touches every route.

## Testing the backend

`apps-script/auth.test.ts` runs the real `.gs` sources in a `node:vm` sandbox
with Google globals stubbed, and drives the actual `doPost` entry point rather
than calling `Auth` directly — so the wiring in `Code.gs` is covered too. It
asserts that a request carrying only the shared secret is rejected, that each
credential fails independently, that unconfigured properties fail closed, and
that action names are not probeable.

`apps-script/attendance.test.ts` and `checkin-cost.test.ts` use the same harness
and additionally count sheet reads, which is how the check-in latency work is
kept honest against the Apps Script quota.

## Deployment checklist

1. Set `APPS_SCRIPT_SECRET` and `ADMIN_SERVICE_KEY` as Script Properties.
2. Redeploy the web app.
3. Set all four environment variables in the Next.js host.
4. **Confirm the deploying Google account can reach only this spreadsheet.**
5. Sign in and confirm the dashboard loads — a `503 CONFIGURATION_ERROR` means a
   property or variable is missing on one side.
6. Confirm `/api/events` returns `401` from a signed-out client and `200` when
   signed in.
