# Authentication

Atty has one role — `admin` — and no user records. Staff prove who they are
with an 8-digit PIN. There is no sign-up, no password reset, and no account
recovery, by design: one deployment is run by one school office, and the
operational cost of real accounts would buy nothing.

The **data** model is multi-organization — one spreadsheet can hold several
organizations, and events reference the organization that owns them — but the
**access** model is not. Every authenticated caller has the same admin
authority over every organization. Sharing one deployment between two
organizations is therefore not a supported security boundary; the organization
field is a data grouping, not a tenant isolation boundary.

## Configuration

Four environment variables, all server-only, none prefixed `NEXT_PUBLIC_`.
Copy `.env.example` to `.env.local` and fill them in.

| Variable | Purpose | Constraint |
|---|---|---|
| `ADMIN_PIN` | The staff PIN. | Exactly 8 digits. |
| `SESSION_SECRET` | Signs the session cookie. | ≥ 32 characters. |
| `ADMIN_SERVICE_KEY` | Second Apps Script credential. | ≥ 32 characters. |
| `APPS_SCRIPT_SECRET` | Existing Next.js ↔ Apps Script secret. | Any strong value. |

Generate the two high-entropy keys with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Every variable **fails closed**. If one is missing or malformed, requests fail
with `503 CONFIGURATION_ERROR` rather than falling open. An auth system that
opens up when misconfigured is worse than one that breaks, because the breakage
is visible.

## Why the PIN is not hashed

An 8-digit PIN is a 10⁸ keyspace. An offline attacker holding `SESSION_SECRET`
could brute-force any derived hash in minutes, so hashing buys nothing. What
actually protects a space that small is:

1. a **constant-time** comparison (`crypto.timingSafeEqual`), so response time
   does not leak how many leading characters were correct, and
2. a **request ceiling** on login attempts.

Storing the PIN directly also keeps the comparison exact — no salt management,
no version field, nothing to get wrong at rotation time.

`lib/auth/pin.ts` checks the format *before* comparing, so malformed input is
rejected without reaching the compare at all. That early return leaks only the
length, which is public.

### Leading zeros are significant

`Number("04812075")` is `4812075`. A numeric comparison would therefore accept
a 7-character submission that was never a valid PIN. The PIN is a string at
every layer, the input uses `inputMode="numeric"` rather than `type="number"`
(so the browser does not coerce it either), and the format check requires
exactly 8 digits.

## Signing in

1. `POST /api/auth/login` with `{ "pin": "••••••••" }`.
2. The throttle is consulted. Over the limit → `429` with `Retry-After`.
3. The PIN is compared in constant time.
4. On success a session cookie is set and `{ "success": true }` is returned.
5. On failure → `401` with the message `"Incorrect PIN."`.

The failure message is fixed and never distinguishes a wrong PIN from a
misconfigured one, so the response carries no information that would help
narrow the search. The `429` is deliberately a different response: it reveals
only that the window is exhausted, never whether any individual guess was
right.

**The PIN is never logged.** Neither is the client IP — it is personal data and
nothing downstream needs it. The route logs only that an attempt was rejected.

## Brute-force protection

`lib/auth/rate-limit.ts` allows **5 attempts per 15 minutes per client**.

Clients are keyed on the **first** entry of `x-forwarded-for`, falling back to
x-real-ip`, then to a single shared bucket. Only the first hop is the real
client; the rest of the chain was appended by intermediate proxies. Trusting a
later entry — or the whole header — would let a caller rotate the value and get
a fresh budget per request.

Successful attempts count too. If only failures counted, a correct PIN would be
the one attempt that did not advance the counter, which is exactly the signal an
attacker wants. The trade-off is that five staff signing in back to back on one
shared tablet share a budget.

### Known limitation: the counter is per instance

The counter lives in module memory. It is **not** shared between instances and
it **resets on every deploy**. On a multi-instance or serverless deployment the
effective ceiling is `5 × instance count`, and an attacker who can spread
requests across instances gets proportionally more guesses.

There is no shared store in this architecture, so this is documented rather than
solved. It is a real limitation, not a rounding error — for a school deployment
on a single instance it is adequate; for a horizontally scaled one it is not.

Closing it properly needs a shared counter: Redis, a Cloudflare/WAF rule, or an
`Upstash`-style HTTP counter. The interface to swap is one function,
`consumeAttempt(key)`. When that happens, update this section and the comment at
the top of `rate-limit.ts`.

## Sessions

See [session-handling.md](session-handling.md) for the token format, cookie
attributes, and the three enforcement layers.

## Key rotation

| Rotate when | Effect |
|---|---|
| `SESSION_SECRET` | **Immediately invalidates every outstanding session.** Everyone is sent to `/login`. This is the recovery path for a suspected cookie leak. |
| `ADMIN_PIN` | Changes who can sign in. Existing sessions stay valid until they expire — a leaked cookie is unaffected. |
| `ADMIN_SERVICE_KEY` | Must be changed in two places, below. Existing requests in flight may fail. |
| `APPS_SCRIPT_SECRET` | Must be changed in two places, below. |

### Rotating a key that lives on both sides

`ADMIN_SERVICE_KEY` and `APPS_SCRIPT_SECRET` are verified on both sides, so a
rotation is only complete when **both** are updated. Update the Apps Script
Script Property first or last — either order leaves a window where one side
disagrees, and requests fail closed during it.

1. Set the Script Property in the Apps Script project.
2. Redeploy the web app (Project Settings → Deploy → Manage deployments).
3. Set the matching variable in the Next.js environment.
4. Redeploy the Next.js app.

## Kiosk operation

The check-in page is behind the same gate, because recording attendance is a
write to the spreadsheet.

A shared door tablet therefore holds a session for up to 12 hours. Two
behaviours matter:

- **Authenticate once.** Staff enter the PIN at the start of a shift, not per
  student.
- **Lock when done.** The lock button in the header clears the cookie
  immediately, so the next person to use the device does not inherit the
  previous one's access. Without it, a tablet left unattended stays open for
  the rest of the 12-hour window.

The kiosk also supports fullscreen, which hides the app chrome. That relies on
`.app-shell` and `.app-chrome` class names, which is why the print report stays
inside the `(app)` route group.

## Recovering from a suspected compromise

| Situation | Action |
|---|---|
| Leaked session cookie | Rotate `SESSION_SECRET`. Kills every session at once. |
| Suspected PIN disclosure | Change `ADMIN_PIN`. |
| Leaked `ADMIN_SERVICE_KEY` or `APPS_SCRIPT_SECRET` | Rotate on both sides (§ above). Then rotate `SESSION_SECRET` too, since an operator with environment access could also have read it. |
| Leaked `.env.local` | All three. Then audit the Apps Script execution log. |
| Device left unlocked on the kiosk | The lock button. A restart also works — the cookie is client-side only. |

## Adding a second role, or a second PIN

Not implemented, and each part needs more than it first appears:

- **Multiple PINs.** `verifyPin` would need to try each configured PIN, and
  `ADMIN_PIN` becomes a list. The constant-time property is harder to preserve:
  comparing against N pins in sequence leaks *which* one matched through timing.
  Use a hash-then-compare scheme, or hash each PIN and compare all hashes
  regardless of match.
- **Roles.** The token already carries `role`, and `requireAdmin` already
  checks it, so a second role is partly scaffolded. But see the cache
  constraint in [session-handling.md](session-handling.md#the-read-cache-constraint)
  — a per-user read cache is required before roles mean anything, and that is a
  real change, not a config flag.
- **Per-user attribution.** There is no user record and no audit trail of who
  recorded which attendance. Adding one means a store and a schema change on
  the Sheets side.
