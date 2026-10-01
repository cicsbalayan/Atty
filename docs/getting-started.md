# Getting Started

Setup, running, and using both tiers. Read this first if you are new to the
project.

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 22 or newer | Next.js 16 requires it. CI pins 22. |
| npm | 10 or newer | Ships with Node. |
| A Google account | — | Owns the spreadsheet and the Apps Script project. |
| clasp (optional) | latest | Only for pushing backend changes from the CLI. |

## 1. Configure the environment

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

Four variables control authentication. Generate the two high-entropy ones:

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ADMIN_SERVICE_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Constraint | Notes |
|---|---|---|
| `APPS_SCRIPT_URL` | deployed `/exec` URL | From step 3. |
| `APPS_SCRIPT_SECRET` | any strong value | Must match a Script Property. |
| `ADMIN_SERVICE_KEY` | ≥ 32 characters | Must match a Script Property. |
| `ADMIN_PIN` | exactly 8 digits | What staff type at `/login`. |
| `SESSION_SECRET` | ≥ 32 characters | Signs session cookies. |

Everything **fails closed**: a missing or malformed value produces
`503 CONFIGURATION_ERROR` rather than a permissive default. `.env.local` is
gitignored — never commit it.

## 2. Prepare the spreadsheet

One spreadsheet, four kinds of sheet.

**`Masterlist`** — one row per student:

| SRCODE | Full Name | College | Program | Year Level | Gender |
|---|---|---|---|---|---|

**`Organizations`** — the entities that use the tracker. One row each:

| Org ID | Org Name | Email | Address | Phone | Website | Deleted |
|---|---|---|---|---|---|---|

Only `Org Name` is required. `Org ID` is assigned by the app as `ORG-001`,
`ORG-002`, and so on. The contact fields are free text and print on the report
exactly as typed.

`Deleted` is a soft-delete stamp, left empty for an active organization. Do not
edit it by hand — use the delete and restore endpoints. A deleted organization
disappears from the app but its **row stays**, and looking it up by ID still
works, so reports for its past events keep printing the correct letterhead.

**`Events`** — created and maintained by the app:

| Event ID | Event Name | Event Date | Status | Sheet Name | Location | Description | Org ID | Time |
|---|---|---|---|---|---|---|---|---|

`Org ID` references a row in `Organizations` and may be left blank. `Time` is
free text for the report — enter the range as it should appear, e.g.
`12:00 pm - 5:00 pm`. It is stored and printed verbatim, never parsed.

> `Org ID` and `Time` are appended to an existing `Events` sheet on the next
> event creation. Events written before that read as blank for both.

Leave the first two rows free: row 1 is the header, data starts at row 2.
`Date` accepts `MM/DD/YYYY` or `YYYY-MM-DD`. `Status` is `Upcoming`, `Active`,
or `Closed`.

Per-event attendance sheets named `EVT-XXX` are **created automatically** when
an event is created. Do not add them by hand.

> The deploying Google account should be able to reach **only this
> spreadsheet**. The backend runs as that user, so its access is the backend's
> access. See [api-security.md](api-security.md#the-deployment-posture).

## 3. Deploy the backend

### Option A — from the Apps Script editor (no tooling)

1. <https://script.google.com> → **New project**.
2. **Project Settings** → tick *Show "appsscript.json" manifest file*.
3. Replace the manifest with `apps-script/appsscript.json` from this repo.
4. Add a `.gs` file per file in `apps-script/`, copying the contents
   (`Code.gs`, `auth.gs`, `config.gs`, `models.gs`, `responses.gs`,
   `sheets.gs`, `validators.gs`, `students.gs`, `events.gs`, `attendance.gs`,
   `reports.gs`).
5. **Project Settings → Script Properties**, add two:

   | Property | Value |
   |---|---|
   | `APPS_SCRIPT_SECRET` | same as your `.env.local` value |
   | `ADMIN_SERVICE_KEY` | same as your `.env.local` value |
   | `SPREADSHEET_ID` | the ID from the sheet URL |

6. **Deploy → New deployment → Web app**:
   - Execute as **Me**
   - Who has access **Anyone**

   That combination is intentional: the Next.js server has no Google identity,
   so the call must be anonymous. The two credentials are what protect it.
7. Copy the `/exec` URL into `APPS_SCRIPT_URL`.

### Option B — with clasp

```bash
npm i -g @google/clasp
clasp login
clasp create --type standalone --title "Atty Attendance"
# copy .clasp.json into apps-script/, then:
cd apps-script && clasp push
```

Set the Script Properties in the editor either way — `clasp push` does not
carry them.

> **After any backend change, redeploy.** Editing the sources does not affect
> the live deployment. Also note Apps Script issues a one-time `302` after each
> redeploy; `integration/http.ts` warms that up automatically, so a first slow
> request after deploying is normal.

## 4. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You are redirected to `/login`.

Sign in with your 8-digit `ADMIN_PIN`. If you get
`503 CONFIGURATION_ERROR`, a Script Property and an environment variable
disagree — see [troubleshooting](#troubleshooting).

## Using the frontend

Five pages, all behind sign-in. The header has a **theme toggle** and a
**lock button**.

### Dashboard — `/`

Counts of active, upcoming, and closed events, with a card per event linking to
its detail and check-in page.

### Events — `/events`

The working list. Filter by status and free-text search; both live in the URL,
so a filtered view is shareable. **Create event** opens a dialog asking for
name, date, location, and description. Creating an event also creates its
`EVT-XXX` attendance sheet.

### Event detail — `/events/[eventId]`

Everything about one event: open/close controls, the attendance table with
search and facet filters (college, program, year level, gender), the report
summary, and CSV export.

**Open** enables check-ins. **Close** disables them and finalises the event.
Both ask for confirmation. Filters persist into the export and the print
report, so you can export exactly what you filtered.

### Kiosk — `/events/[eventId]/check-in`

Built for a tablet at a gym door. Large SR Code field, autofocus, and a
fullscreen toggle that hides the app chrome.

The flow is two steps by design:

1. Staff types an SR Code and presses **Validate**. The app shows the
   student's department, name, and course.
2. The student confirms, and staff presses **Confirm Attendance**.

The gap between the two exists so a mistyped code cannot silently record
attendance for the wrong person. Outcomes: success, *already recorded*, or
*invalid SR Code* — each stated in words, never by colour alone.

Staff authenticate **once** per session, then check students in for up to 12
hours. **Press the lock button when finished** so the next person does not
inherit access.

### Report — `/events/[eventId]/report/print`

The official letterhead report, print-optimised to legal landscape with the
active filters. Use your browser's print dialogue, or the print button.

## Using the backend directly

The web app accepts JSON `POST` only; `GET` returns `METHOD_NOT_ALLOWED`.

```bash
curl -X POST "$APPS_SCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"$APPS_SCRIPT_SECRET\",\"adminKey\":\"$ADMIN_SERVICE_KEY\",\"action\":\"getEvents\"}"
```

Both credentials are required. Responses are
`{"success":true,...}` or `{"success":false,"code":"...","message":"..."}`.
The full action list, error codes, and authorization notes are in
[api-security.md](api-security.md).

## npm scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server. |
| `npm run build` | Production build. Also proves no client code imports server-only modules. |
| `npm start` | Serve the production build. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm test` | Vitest, once. |
| `npm run format` | Prettier over TS and TSX. |

`npm run build` needs the environment variables set, because it renders pages.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `SESSION_SECRET is not configured` | Missing from `.env.local` | Add it; restart `npm run dev` |
| `ADMIN_PIN must be exactly 8 digits` | Wrong length or non-digits | Exactly 8 digits |
| `ADMIN_SERVICE_KEY must be at least 32 characters` | Too short | Regenerate |
| `503 CONFIGURATION_ERROR` from the backend | A Script Property and an env var disagree | Compare `APPS_SCRIPT_SECRET` and `ADMIN_SERVICE_KEY` on both sides |
| `502` on data loads, then works on retry | Apps Script cold start | Retry; see [tech-stack.md](tech-stack.md#performance) |
| Events list empty but no error | `Events` sheet missing or header row wrong | Check row 1 headers and that data starts at row 2 |
| `Too many attempts` | Login throttle | Wait 15 minutes, or restart the dev server |
| Redirect loop on `/login` | `/login` is gated by mistake | `lib/auth/cache-isolation.test.ts` asserts it is not — run it |
| Stuck on stale data | Read cache | `APPS_SCRIPT_CACHE=off`, or use the in-page refresh button |

## Where to go next

| I want to… | Read |
|---|---|
| Understand the system | [architecture.md](architecture.md), [tech-stack.md](tech-stack.md) |
| Change sign-in or keys | [authentication.md](authentication.md) |
| Touch cookies or the gates | [session-handling.md](session-handling.md) |
| Change the backend contract | [api-security.md](api-security.md) |
| Write or run tests | [testing.md](testing.md) |
| Understand the UI system | `../DESIGN.md` §5 |
| Original requirements | `../requirements.md` |
