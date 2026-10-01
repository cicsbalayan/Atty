# Testing

How to verify this codebase, and what each suite is actually proving.

## The gate

CI (`.github/workflows/ci.yml`) runs exactly this, and all of it must pass:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm run build` is not optional. It is what proves no Client Component has
imported a `server-only` module — a check nothing else performs.

## Running tests

```bash
npm test                          # everything, once
npx vitest                        # watch mode
npx vitest run lib/auth           # one directory
npx vitest run apps-script/auth.test.ts
npx vitest run -t "tampered"      # by test name
```

18 files, 168 tests. Node environment by default; a suite needing a DOM opts in
with a `@vitest-environment jsdom` docblock at the top of the file. Tests are
co-located with their source as `*.test.ts`.

The Apps Script suites share `apps-script/script-harness.ts`, a fake Sheets API
that also exposes the row store so a test can assert on what was actually
written rather than only on the object returned.

## What each suite proves

### Authentication

| Suite | Proves |
|---|---|
| `lib/auth/session.test.ts` | A signed token round-trips. Tampered payloads, tampered signatures, expired tokens, foreign keys, and `alg: none` substitution are all rejected. The payload carries only `role`/`iat`/`exp`. A missing or weak `SESSION_SECRET` fails closed. |
| `lib/auth/pin.test.ts` | The configured PIN is accepted and others rejected. **Leading zeros survive** — `Number("04812075")` is `4812075`, so a numeric comparison would wrongly accept a 7-character input. 7-char, 9-char, non-digit, whitespace, and newline inputs are rejected. An unset or malformed `ADMIN_PIN` throws `503`, not `false`. |
| `lib/auth/dal.test.ts` | **Layer 2 rejects on its own**, with no proxy involved. No cookie, tampered cookie, foreign key, and missing `SESSION_SECRET` each produce a 401; pages redirect to `/login` instead. |
| `lib/auth/rate-limit.test.ts` | Exactly 5 attempts pass, the 6th is blocked with a `Retry-After`, the window resets, clients are independent, and **successful attempts count too** so a correct PIN is not distinguishable. |
| `lib/auth/redirect.test.ts` | `?next=` accepts same-origin paths and rejects `//evil.com`, `/\evil.com`, absolute URLs, `javascript:`, `data:`, and control characters. |
| `lib/auth/cache-isolation.test.ts` | **The structural guard.** `integration/cached.ts` imports nothing from `lib/auth`; no cached wrapper calls a gate; every route file has at least as many `requireAdmin()` calls as exported handlers; every page outside `(app)` calls `requireAdminPage()`; `/login` calls neither. |

That last suite is the one that matters most for the future. It is easy to
break the security model by accident — moving a check one line inside a cached
function looks harmless — and a test is the only thing that reliably notices.

### Backend

| Suite | Proves |
|---|---|
| `apps-script/auth.test.ts` | The real `doPost` entry point rejects a request carrying **only** the shared secret, rejects each credential independently, fails closed when either Script Property is unset, and does not leak which action names exist. Also asserts the comparison is the constant-time XOR loop. |
| `apps-script/attendance.test.ts` | Attendance behaviour **and** how many sheet reads each code path performs. |
| `apps-script/checkin-cost.test.ts` | The check-in path's read cost, and that `CacheService` is never touched — each cache get is a network round trip that previously exhausted the upstream timeout. |
| `apps-script/organizations.test.ts` | Organization sequencing and zero-padding, partial updates written through to the sheet, `ORG_NOT_FOUND`, a missing sheet returning `[]` rather than throwing, and that events read `orgId`/`time` as `""` on a pre-migration row. Also that a rejected create leaves no orphan attendance sheet. |

The Apps Script suites evaluate the real `.gs` sources in a `node:vm` sandbox
with Google globals stubbed. That is why they can assert on read counts, and
why `auth.test.ts` drives `doPost` rather than calling `Auth` directly — so the
wiring in `Code.gs` is covered too.

### Everything else

| Suite | Covers |
|---|---|
| `lib/api.test.ts` | Body parsing, field validation, and error-code → HTTP status mapping. |
| `lib/attendance.test.ts` | Filter parsing, filtering, CSV serialisation. |
| `lib/format.test.ts` | Date and SR Code formatting. |
| `integration/http.test.ts` | Read-cache hit, in-flight dedupe, mutation invalidation, `APPS_SCRIPT_CACHE=off`, and that both credentials reach the wire. |
| `integration/events.test.ts` | Request shapes for each event action. |
| `integration/organizations.test.ts` | Request shapes for each organization action, and that omitted contact fields default to `""` rather than being dropped. |
| `integration/cached.test.ts` | `unstable_cache` tag wiring and revalidation windows. |
| `hooks/useCached.test.tsx` | The client stale-while-revalidate cache. |

## Manual verification

Unit tests cannot prove a redirect happens or a cookie is set. After changing
auth, walk this:

```bash
npm run dev
```

| # | Do | Expect |
|---|---|---|
| 1 | Open `/` | `307` to `/login?next=%2F` |
| 2 | Wrong PIN | `Incorrect PIN.` |
| 3 | Same PIN 6 times | `Too many attempts` + `Retry-After` |
| 4 | Correct PIN | Dashboard loads |
| 5 | Lock button | Back to `/login` |
| 6 | DevTools → Application → Cookies | `atty_admin` is `HttpOnly` |
| 7 | Incognito → `/api/events` | `401` JSON |
| 8 | Incognito → `/events/anything/check-in` | Redirected to `/login` |

### The one that matters most

**Delete `proxy.ts`, restart, and repeat steps 1, 7, and 8.** They must still
hold.

Layer 2 is the authoritative gate; the proxy is a fast path in front of it. If
anything breaks without the proxy, the real gate is not where it is supposed to
be. The upstream Next.js documentation is explicit that a matcher change "can
silently remove Proxy coverage", which is why the gate does not depend on it.

### With curl

```bash
base=http://localhost:3000
pin=$(grep ADMIN_PIN .env.local | cut -d= -f2)

# Unauthenticated
curl -s -o /dev/null -D - "$base/" | grep -i location
curl -s "$base/api/events"

# Sign in, keep the cookie
curl -s -c /tmp/jar -X POST "$base/api/auth/login" \
  -H 'Content-Type: application/json' -d "{\"pin\":\"$pin\"}"

# Authenticated
curl -s -b /tmp/jar -o /dev/null -w '%{http_code}\n' "$base/api/events"
```

On PowerShell, write the JSON to a file and use `--data-binary "@file"`;
single-quoted inline JSON gets mangled by argument parsing.

### Organizations and event org/time

Manual verification for the Organizations registry and the two new event
fields. There is **no UI** for either — they are backend-only — so these steps
drive the API and confirm the result in the spreadsheet. See
[specs/2026-10-01-organizations-backend-design.md](specs/2026-10-01-organizations-backend-design.md)
for the design.

**Prerequisite: redeploy the Apps Script Web App.** `.gs` files do not
hot-reload. Paste the six changed files into the editor and create a **new
version** — saving is not enough, the old version keeps serving until you do.

| File | Change |
|---|---|
| `organizations.gs` | New file. |
| `config.gs` | Organizations sheet, headers, `Org ID`/`Time` columns, length limits. |
| `models.gs` | `organizationFromRow`; `orgId`/`time` on `eventFromRow`. |
| `events.gs` | `orgId` and `time` on create and update. |
| `responses.gs` | `ORG_NOT_FOUND`. |
| `Code.gs` | Four router entries. |

Confirm the redeploy landed before anything else. A stale backend answers
every call the same way:

```bash
curl -s -b /tmp/jar "$base/api/organizations"
# {"success":false,"code":"INVALID_REQUEST","message":"Unknown action: getOrganizations"}
```

`Unknown action: getOrganizations` means the redeploy did not take.

| # | Do | Expect |
|---|---|---|
| 1 | `POST /api/organizations` with `{ "name": "Test Org" }` | `201`, `id` is `ORG-001`, and `email`/`address`/`phone`/`website` are all `""`. A new `Organizations` tab now exists in the spreadsheet. |
| 2 | `POST /api/organizations` with all five fields | `201`, every field round-trips verbatim, and the sheet row matches. |
| 3 | Create a third org | `id` is `ORG-003`. IDs increment, they are not reused. |
| 4 | `PATCH /api/organizations/ORG-001` with `{ "email": "new@x.edu" }` | Only `email` changes. `name` and `website` keep their values, in the response **and** in the sheet. |
| 5 | Re-`GET /api/organizations` immediately after step 4 | Shows the new email. The 30s read TTL must not win: the write expires the tag. A stale value here is a cache bug. |
| 6 | `GET /api/organizations/ORG-999` | `404` with `code: "ORG_NOT_FOUND"`. |
| 7 | `POST /api/events` with `orgId: "ORG-001"`, `time: "12:00 pm - 5:00 pm"` | `201`, both fields echoed back. **Check the Events sheet now** — the header row has grown `Org ID` and `Time` at columns H and I, and the new row has both values. This is the migration moment. |
| 8 | `PATCH /api/events/{id}` with `{ "time": "9:00 AM - 12:00 NN" }` | Stored and returned byte-for-byte. Nonsense input proves nothing parses or reformats the string. |
| 9 | `PATCH /api/events/{id}` with a 150-character `time` | `400` `INVALID_FIELD`. The cap is 100 characters. |
| 10 | `PATCH /api/events/{id}` with `orgId: "ORG-999"` | `404` `ORG_NOT_FOUND`, **and the event's `orgId` is unchanged** — the patch must not half-apply. |
| 11 | `POST /api/events` with `orgId: "ORG-999"` | `404`, and **no new `EVT-XXX` tab appears** in the spreadsheet. The org is validated before the attendance sheet is created; an orphan tab here is the bug this check exists for. |
| 12 | Open the dashboard, then an event created **before** this change | Both load. That event's `orgId` and `time` are both `""`. Take attendance on it — it still records. This is the backward-compatibility check that matters most. |
| 13 | Create an event through the existing New Event dialog | Succeeds, with `orgId: ""`. The form collects no org, which is why `orgId` is optional on create. If this broke, `orgId` would have had to be required and the dialog rewritten. |
| 14 | `DELETE /api/organizations/ORG-001`, then `GET /api/organizations` | Gone from the list. The sheet row is still there with a timestamp in the `Deleted` column. |
| 15 | `GET /api/organizations/ORG-001` after the delete | Still `200`. A lookup resolves a soft-deleted organization on purpose. |
| 16 | `GET /api/events/EVT-001` for an event owned by the deleted org, and `PATCH` its `time` | `200` both times, and the `orgId` is unchanged. If the patch failed with `ORG_NOT_FOUND`, the event would be stranded and uneditable. |
| 17 | `POST /api/organizations/ORG-001/restore` | Back in the list, and the `Deleted` cell is empty. |
| 18 | Delete the same org twice | The original timestamp survives; the second delete does not re-stamp it. |

A note on step 15, because it looks like a bug and is not. Lists exclude
soft-deleted organizations but a lookup by ID still returns one, on purpose: the
report letterhead resolves by ID, so if a deleted organization stopped
resolving, every past report for its events would quietly reprint with the
default letterhead. Deleting an organization must never rewrite history.

The print report is still the hardcoded letterhead with a blank Time line.
That is expected until the UI lands — see the
[UI plan](plans/2026-10-01-organizations-ui.md), Task 7. The data is
stored and served correctly; nothing displays it yet.

```bash
base=http://localhost:3000
pin=$(grep ADMIN_PIN .env.local | cut -d= -f2)
curl -s -c /tmp/jar -X POST "$base/api/auth/login" \
  -H 'Content-Type: application/json' -d "{\"pin\":\"$pin\"}"

echo '{"name":"Test Org","email":"a@b.edu","address":"1 St","phone":"+63 43 000 0000","website":"https://b.edu"}' > /tmp/org.json
curl -s -b /tmp/jar -X POST "$base/api/organizations" \
  -H 'Content-Type: application/json' --data-binary '@/tmp/org.json'

echo '{"email":"new@b.edu"}' > /tmp/patch.json
curl -s -b /tmp/jar -X PATCH "$base/api/organizations/ORG-001" \
  -H 'Content-Type: application/json' --data-binary '@/tmp/patch.json'

echo '{"name":"Test Event","date":"2026-10-15","location":"Gym","orgId":"ORG-001","time":"12:00 pm - 5:00 pm"}' > /tmp/evt.json
curl -s -b /tmp/jar -X POST "$base/api/events" \
  -H 'Content-Type: application/json' --data-binary '@/tmp/evt.json'

# negative cases
curl -s -b /tmp/jar -X PATCH "$base/api/events/EVT-001" \
  -H 'Content-Type: application/json' -d '{"orgId":"ORG-999"}'

# soft delete and undo
curl -s -b /tmp/jar -X DELETE "$base/api/organizations/ORG-001"
curl -s -b /tmp/jar "$base/api/organizations/ORG-001"   # still 200
curl -s -b /tmp/jar -X POST "$base/api/organizations/ORG-001/restore"
```

Use a throwaway organization for this. Nothing here is destructive, but rows
created by the procedure persist.

## Writing a new test

- Co-locate it as `*.test.ts` beside the source.
- Default to the Node environment; add a `@vitest-environment jsdom` docblock
  only if you need a DOM.
- `vi.resetModules()` plus a dynamic `import()` when module state or
  `process.env` matters — `integration/http.test.ts` and the `lib/auth` suites
  both do this.
- Set required env vars at the top of the file, as
  `integration/http.test.ts` does for `ADMIN_SERVICE_KEY`.
- Assert on behaviour, not implementation, except where the implementation *is*
  the invariant — `cache-isolation.test.ts` reads source text precisely because
  the rule has no runtime expression.

### Do not fake a mutation by appending a character

A tampered-token test that does `token.slice(0, -1) + "x"` is **flaky**: the
last character of a base64url signature is heavily constrained, so it is often
already `x` and the "tampered" token comes out identical. This caused 3
failures in 8 runs here before it was caught. Flip a character that is
guaranteed to differ — see the `tamper()` helper in `lib/auth/dal.test.ts`.

## Adding a route or page

Run `npm test` first. `lib/auth/cache-isolation.test.ts` will fail until the
new route calls `requireAdmin()` and the new page calls `requireAdminPage()`.
That is intentional — it is the cheapest possible reminder that authorization
is not automatic.
