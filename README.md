# School Event Attendance System

A web-based attendance system for school events built with **Next.js**,
**Google Apps Script**, and **Google Sheets**.

- A centralized `Masterlist` sheet holds all student information (keyed by
  `SRCODE`).
- The `Events` sheet is the event registry.
- Every event gets a dynamically created attendance sheet named after its
  Event ID (e.g. `EVT-001`) that stores only `Timestamp` + `SRCODE`.
- The **Apps Script Web App** is the backend/API: it validates requests,
  records attendance, prevents duplicates, and generates reports. It requires
  two credentials on every request, so the URL alone grants nothing.
- The **Next.js server** is a thin BFF: it forwards client requests to the
  Web App with the shared secrets, so credentials never reach the browser.
- Access is **admin-only**: staff sign in with an 8-digit PIN at `/login`.

## Architecture

```
Browser
   │  HTTPS
   ▼
Next.js App Router (app/api/* route handlers)
   │  POST { secret, action, ... }  (shared secret, server-only)
   ▼
Google Apps Script Web App (apps-script/)
   │  SpreadsheetApp services
   ▼
Google Sheets (Masterlist, Events, EVT-XXX)
```

Next.js never talks to Google Sheets directly, and per the requirements no
student data is duplicated into event sheets.

## Repository layout

| Path                | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `apps-script/`      | Apps Script backend, deployed as a Web App        |
| `models/`           | Shared domain types (Student, Event, Organization, Attendance…) |
| `integration/`      | Server-side client for the Apps Script API        |
| `app/api/`          | Next.js route handlers (BFF)                      |
| `lib/api.ts`        | Route handler validation + error mapping          |

Each source file stays under 400 lines to keep the codebase maintainable.

## Setup

1. Deploy the Apps Script backend — see `apps-script/README.md`.
2. Create `.env.local` from `.env.example` and fill in all five values:
   `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`, `ADMIN_SERVICE_KEY`, `ADMIN_PIN`,
   and `SESSION_SECRET`. The last three gate admin sign-in; the two high-entropy
   ones can be generated with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Run the app:

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with the 8-digit `ADMIN_PIN`.

Full walkthrough, including the spreadsheet layout and every page, is in
[`docs/getting-started.md`](docs/getting-started.md).

## Documentation

Reference documentation lives in [`docs/`](docs/):

| Document | Covers |
| --- | --- |
| [`docs/getting-started.md`](docs/getting-started.md) | Setup, spreadsheet layout, backend deployment, using every page |
| [`docs/tech-stack.md`](docs/tech-stack.md) | Technologies, versions, and why each choice was made |
| [`docs/architecture.md`](docs/architecture.md) | Request lifecycle and trust boundaries |
| [`docs/authentication.md`](docs/authentication.md) | The PIN, keys, rotation, brute-force limits, kiosk operation |
| [`docs/session-handling.md`](docs/session-handling.md) | Token format, cookie attributes, the three enforcement layers |
| [`docs/api-security.md`](docs/api-security.md) | Apps Script credentials, per-action authorization, headers |
| [`docs/testing.md`](docs/testing.md) | Running tests and verifying changes by hand |

## Access control

The application is **admin-only**. There is one role and no user records: staff
sign in at `/login` with an 8-digit PIN and receive a signed session cookie.
Every page and every API route requires a valid session, enforced in three
independent layers so no single mistake opens the app. On the way to Google
Sheets, the Next.js server presents two credentials, because the Apps Script web
app is deployed `ANYONE_ANONYMOUS` and its URL alone must never be enough to
reach the spreadsheet.

## API surface

The Next.js app exposes these endpoints (all return JSON):

| Method | Path                                    | Description                    |
| ------ | --------------------------------------- | ------------------------------ |
| GET    | `/api/organizations`                    | List active organizations      |
| POST   | `/api/organizations`                    | Create an organization         |
| GET    | `/api/organizations/[orgId]`            | Organization details (cached 30s) |
| PATCH  | `/api/organizations/[orgId]`            | Update organization fields     |
| DELETE | `/api/organizations/[orgId]`            | Soft delete (hides, keeps the row) |
| POST   | `/api/organizations/[orgId]/restore`    | Undo a soft delete             |
| GET    | `/api/events`                           | List events                    |
| POST   | `/api/events`                           | Create an event                |
| GET    | `/api/events/[eventId]`                 | Event details (cached 30s)     |
| POST   | `/api/events/[eventId]/open`            | Open an event (mark Active)    |
| PATCH  | `/api/events/[eventId]`                 | Close (empty body) or update fields (`name`, `date`, `location`, `description`, `status`, `orgId`, `time`) |
| GET    | `/api/events/[eventId]/attendance`      | Attendance records (`?q=&college=&program=&yearLevel=&gender=`) |
| POST   | `/api/events/[eventId]/attendance`      | Record attendance              |
| POST   | `/api/events/[eventId]/attendance/check`| Verify a student's attendance  |
| GET    | `/api/events/[eventId]/attendance/export`| CSV export (same filters)     |
| GET    | `/api/events/[eventId]/report`          | Attendance report              |
| POST   | `/api/students/lookup`                  | Look up a student by SRCODE     |

## Scripts

```bash
npm run dev        # start the development server
npm run build      # production build
npm run start      # start the production server
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest unit tests
npm run format     # prettier --write
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, typecheck, lint, test, and build
on every push and pull request.

## Manual end-to-end check

With `npm run dev` running and `.env.local` pointing at a test spreadsheet:

```powershell
# create, then prove Upcoming blocks attendance (409)
Invoke-RestMethod http://localhost:3000/api/events -Method Post -ContentType "application/json" -Body '{"name":"E2E","date":"2026-10-01","location":"Gym"}'
Invoke-RestMethod http://localhost:3000/api/events/EVT-XXX/attendance -Method Post -ContentType "application/json" -Body '{"srcode":"<REAL-SRCODE>"}'

# open, record, prove duplicate blocked (409)
Invoke-RestMethod http://localhost:3000/api/events/EVT-XXX/open -Method Post
Invoke-RestMethod http://localhost:3000/api/events/EVT-XXX/attendance -Method Post -ContentType "application/json" -Body '{"srcode":"<REAL-SRCODE>"}'
Invoke-RestMethod http://localhost:3000/api/events/EVT-XXX/attendance -Method Post -ContentType "application/json" -Body '{"srcode":"<REAL-SRCODE>"}'

# update, filter, export, report
Invoke-RestMethod http://localhost:3000/api/events/EVT-XXX -Method Patch -ContentType "application/json" -Body '{"location":"Auditorium"}'
Invoke-RestMethod "http://localhost:3000/api/events/EVT-XXX/attendance?q=<PART-OF-NAME>"
Invoke-WebRequest "http://localhost:3000/api/events/EVT-XXX/attendance/export" -OutFile "$env:USERPROFILE\Desktop\export.csv"
Invoke-RestMethod http://localhost:3000/api/events/EVT-XXX/report

# close, prove post-close writes blocked but reads work
Invoke-RestMethod http://localhost:3000/api/events/EVT-XXX -Method Patch
Invoke-RestMethod http://localhost:3000/api/events/EVT-XXX/attendance
```

Replace `EVT-XXX` with the created ID and `<REAL-SRCODE>` with a Masterlist
code. Delete the test event row + tab when done.