# Architecture

## Shape of the system

```
Browser
  │  HTTPS
  ▼
Next.js 16 (App Router)  ── frontend + backend-for-frontend
  │    app/(app)/**        authenticated pages, inside AppShell
  │    app/login           public sign-in page, no AppShell
  │    app/api/**          route handlers (the BFF)
  │    proxy.ts            layer 1: optimistic authorization
  │    lib/auth/**         layers 2: the authoritative gate
  │
  │  POST { secret, adminKey, action, ...fields }
  ▼
Google Apps Script  (Web App, deployed ANYONE_ANONYMOUS)
  │    auth.gs             requires BOTH credentials
  ▼
Google Sheets
  Masterlist · Events · EVT-XXX (one sheet per event)
```

The browser never talks to Apps Script or Google Sheets directly, and never
sees a credential. Every data request goes to a same-origin `/api/*` route.

## Why a BFF

Apps Script Web Apps are slow: every call is a cold-start round trip measured in
seconds. Three things absorb that cost.

| Layer | File | Job |
|---|---|---|
| In-process read cache | `integration/http.ts` | Per-instance `Map` with short TTLs, in-flight dedupe, and mutation-driven invalidation. |
| Persistent read cache | `integration/cached.ts` | `unstable_cache` with tags, so data survives deploys and is shared across serverless instances. |
| Client cache | `hooks/useCached.ts` | Stale-while-revalidate map so repeat views cost nothing. |

Mutations expire exactly the affected tags — see `integration/invalidate.ts`.

This caching is the single most important constraint on the auth design. See
[session-handling.md](session-handling.md#the-read-cache-constraint).

## Trust boundaries

There are three, and credentials do not cross them.

| Boundary | Guarded by | Trusts |
|---|---|---|
| Browser → Next.js | `atty_admin` session cookie | Nothing from the client. Every page and handler re-verifies. |
| Next.js → Apps Script | `APPS_SCRIPT_SECRET` + `ADMIN_SERVICE_KEY` | Only its own environment. |
| Apps Script → Sheets | The deploying user's OAuth grant | The deploying account. |

`SESSION_SECRET` never leaves the Next.js server. `ADMIN_SERVICE_KEY` is only
ever sent upstream. The PIN is compared during login and never transmitted
afterwards. The three are independent, so leaking one does not weaken the
others.

## Request lifecycle

### Unauthenticated page request

1. `proxy.ts` finds no valid cookie.
2. `307` to `/login?next=<path>`, so the destination survives.
3. `/login` renders outside `AppShell`: one centred card, no sidebar.

### Unauthenticated API request

1. `proxy.ts` finds no valid cookie.
2. `401` with `{"success":false,"code":"UNAUTHORIZED"}`.
3. Never a redirect — a `fetch()` caller expects JSON, and an HTML body would
   surface as a confusing parse error in `lib/api-client.ts`.

### Authenticated read

1. `proxy.ts` verifies the signature and passes through.
2. The page or handler calls `requireAdminPage()` / `requireAdmin()`, which
   verifies again. **This is the check that matters.**
3. The cached read function runs.
4. `integration/http.ts` attaches `secret` and `adminKey` to the request body.
5. Apps Script verifies both, then dispatches to the action handler.

### Mutating request

Identical, plus the handler calls the matching `expire*()` helper so the
affected cache tags are dropped immediately.

## Route inventory

Every route below requires a valid session except `/login` and
`/api/auth/*`.

### Pages

| Route | File | Notes |
|---|---|---|
| `/` | `app/(app)/page.tsx` | Dashboard: active/upcoming/closed counts. |
| `/events` | `app/(app)/events/page.tsx` | List, search, status filter, create dialog. |
| `/events/[eventId]` | `app/(app)/events/[eventId]/page.tsx` | Detail, open/close/edit, attendance table, report summary. |
| `/events/[eventId]/check-in` | `app/(app)/events/[eventId]/check-in/page.tsx` | Kiosk. Fullscreen support. |
| `/events/[eventId]/report/print` | `app/(app)/events/[eventId]/report/print/page.tsx` | Print-optimised report. |
| `/login` | `app/login/page.tsx` | **Public.** |

### API routes

| Route | Methods |
|---|---|
| `/api/auth/login` | `POST` — **public** |
| `/api/auth/logout` | `POST` — **public** (only clears a cookie) |
| `/api/organizations` | `GET`, `POST` |
| `/api/organizations/[orgId]` | `GET`, `PATCH`, `DELETE` (soft delete) |
| `/api/organizations/[orgId]/restore` | `POST` |
| `/api/events` | `GET`, `POST` |
| `/api/events/[eventId]` | `GET`, `PATCH` (empty body closes) |
| `/api/events/[eventId]/open` | `POST` |
| `/api/events/[eventId]/attendance` | `GET`, `POST` |
| `/api/events/[eventId]/attendance/check` | `POST` |
| `/api/events/[eventId]/attendance/export` | `GET` (CSV) |
| `/api/events/[eventId]/report` | `GET` |
| `/api/students/lookup` | `POST` |

## Why the `(app)` route group

`AppShell` used to live in `app/layout.tsx`, which wrapped every route —
including the sidebar and primary nav on the sign-in page. It now lives in
`app/(app)/layout.tsx`, a route group that does not appear in any URL, so the
sign-in page renders bare while every other URL is unchanged.

The print report stays **inside** the group: `@media print` and `:fullscreen`
both target `.app-shell` and `.app-chrome` in `app/globals.css`, so removing
the shell would break printing and kiosk fullscreen.

## Module map

| Path | Responsibility |
|---|---|
| `app/(app)/**` | Authenticated pages. |
| `app/login/**` | Sign-in page and PIN form. |
| `app/api/**` | Route handlers. Every one calls the auth gate. |
| `components/` | Presentational components. No `fetch` outside `lib/api-client`. |
| `hooks/` | Client cache and query wrappers. |
| `lib/api.ts` | BFF helpers: body parsing, validation, error → status mapping. |
| `lib/api-client.ts` | Typed browser fetcher. Same-origin `/api/*` only. |
| `lib/auth/**` | Credentials, PIN check, session signing, gates, throttle. |
| `integration/**` | Server-only Apps Script client, caching, invalidation. |
| `models/**` | Shared types. Single source of truth for both tiers. |
| `apps-script/` | Backend. Apps Script V8, tested in a `node:vm` harness. |
| `proxy.ts` | Layer 1 authorization. |
