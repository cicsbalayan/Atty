# Offline Queue + Offline Viewing — Design

Date: 2026-10-08. Status: approved sections, pending spec review.

## Goal

The check-in kiosk keeps recording when gym Wi-Fi drops, and already-loaded
lists stay browsable offline. Queued scans sync automatically on reconnect
(with a manual trigger), and every sync ends in a per-scan report. No
attendance scan is ever silently lost or double-counted.

## Non-goals

- Excel snapshot export (separate project).
- Service-worker cold-start PWA (phase 2 follow-up).
- Apps Script changes. The sync replays through the existing
  `recordAttendance` endpoint, which means replayed rows carry the server's
  sync-time stamp, not the device scan time. Device `scannedAt` is stored and
  shown, and the spec reserves a timestamp-accepting replay action as the
  backend upgrade path.

## Architecture

New `lib/offline/` boundary, four units, each testable in isolation:

| Unit | Responsibility |
|---|---|
| `store.ts` | Promise wrapper over raw IndexedDB. DB `atty-offline`, stores `scans` and `snapshots`. Storage interface + in-memory implementation so unit tests need no browser APIs. No new dependencies. |
| `queue.ts` | Scan CRUD. Entry: `{ eventId, srcode, scannedAt, status, failReason? }`, status in `queued \| syncing \| done \| failed`. Keyed by event, never by session. |
| `snapshots.ts` | Persists successful reads (events list, event detail, loaded attendance pages + totals, report data) with a saved-at stamp. |
| `sync.ts` + `useOnline.ts` | Replay engine + connectivity (online/offline events plus treating failed fetches as offline). |

Online behavior is untouched: queue and snapshots activate only on failure
or offline reads.

## UI

- `OfflineBanner` under the header whenever offline.
- Pending-count pill + "Sync now" on the event detail header and the kiosk;
  button disabled while offline or syncing.
- Kiosk queued state: "Queued — will sync when reconnected" (online kiosk is
  pixel-identical to today).
- Sync report dialog for any non-clean outcome: per-scan
  recorded / already-present / failed-with-reason, "Keep queued" (default) or
  "Discard" per failure. Clean syncs toast success and stay out of the way.
- Offline views labeled with saved-at time ("Saved copy from 2:14 PM").

## Data flow and semantics

1. Kiosk attempts verify-then-record as today. Only on network failure does a
   format-valid scan enqueue (the Masterlist can't be consulted offline;
   unknown codes fail at sync with a reason, never at scan).
2. Replay is FIFO, one scan at a time, with persisted per-scan status, so an
   interrupted sync resumes exactly where it stopped.
3. `DUPLICATE` replays resolve as "already present" — benign, since the
   student is accounted for either way. The server duplicate guard makes
   replay naturally idempotent: two tabs racing the same scan cannot create
   two rows.

## Error handling

- 401 mid-sync (expired session): engine pauses, UI prompts re-login, queue
  untouched; auto-sync resumes after sign-in.
- IndexedDB unavailable or quota exceeded: in-memory queue fallback with a
  persistent warning (scans won't survive reload); snapshots skipped.
- Flaky/captive-portal connectivity: failed attempts count as offline
  regardless of `navigator.onLine`; the queue is the source of truth.

## Testing

- Unit: queue/snapshot logic on the in-memory backend; sync engine on mocked
  `api-client` (recorded, duplicate, unknown code, 401 pause, resume).
- Component (jsdom): banner, pending badge, report dialog, kiosk queued state.
- Manual: devtools offline drill (scan → queued → online → report),
  reload-mid-offline, session-expiry drill.

## Decisions log

- Scope: queue + offline viewing (not Excel export). Sync: auto + manual.
  Backend: frontend-only for now; timestamp fidelity deferred to a future
  Apps Script replay action.
