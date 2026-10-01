# Atty Documentation

Reference documentation for the School Event Attendance System, covering the
Next.js frontend/BFF and the Google Apps Script backend.

## Start here

| Document | Read it when |
|---|---|
| [getting-started.md](getting-started.md) | **New to the project.** Setup, spreadsheet layout, backend deployment, and how to use every page. |
| [tech-stack.md](tech-stack.md) | You want to know what it is built with and why each choice was made. |
| [architecture.md](architecture.md) | You need to know how a request travels to Google Sheets and where the trust boundaries are. |
| [testing.md](testing.md) | You are writing tests, or verifying a change by hand. |

## Security

| Document | Read it when |
|---|---|
| [authentication.md](authentication.md) | Setting up or operating sign-in: the PIN, the keys, key rotation, brute-force limits, kiosk operation. |
| [session-handling.md](session-handling.md) | Touching cookies, session expiry, the authorization gates, or the read cache. |
| [api-security.md](api-security.md) | Changing the Apps Script contract, deploying the backend, or reviewing what each action exposes. |

## In one paragraph

Atty is admin-only. There is one role and no user records: staff prove who they
are with an 8-digit PIN at `/login`, receive a signed session cookie, and every
page and API route requires a valid session. That check happens in three
independent layers, so no single mistake opens the app. On the way to Google
Sheets the Next.js server presents **two** credentials, because the Apps Script
web app is publicly reachable and must not be usable by anyone who merely has
its URL.

## Design documents

These predate this folder and remain the source of truth for their topics:

| Document | Covers |
|---|---|
| [`../README.md`](../README.md) | Repository layout, full API surface, manual verification recipe |
| [`../DESIGN.md`](../DESIGN.md) | The claymorphic UI system, component specs, interaction states |
| [`../requirements.md`](../requirements.md) | The original client specification |
| [`../apps-script/README.md`](../apps-script/README.md) | Backend deployment and actions |

Feature work in flight, newest first:

| Document | Covers |
|---|---|
| [`specs/2026-10-01-organizations-backend-design.md`](specs/2026-10-01-organizations-backend-design.md) | Why organizations exist as an entity, the `Organizations` sheet, soft delete, and why the report letterhead falls back the way it does. Implemented, uncommitted. |
| [`plans/2026-10-01-organizations-ui.md`](plans/2026-10-01-organizations-ui.md) | The task-by-task plan for the organizations UI: pages, dialogs, the org picker, and wiring the print letterhead. Not started. |
