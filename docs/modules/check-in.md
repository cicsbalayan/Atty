# Check-in (Kiosk)

The door tablet flow at `/events/[eventId]/check-in`: look up a student by
SR code, verify whether they already attended, and record attendance with
one tap. Only `Active` events accept records.

## How it works

- `CheckInForm` validates the SR code format (`00-00000`) before any request.
- **Verify first** (`POST …/attendance/check`): if the student already
  attended, the form shows the original timestamp instead of recording again —
  duplicate scans can never create a second row.
- **Record** (`POST …/attendance`): appends `[Timestamp, SRCODE]` to the
  event sheet and shows an inline success state with the student details.
  All feedback here is inline by design; this flow never fires toasts, so the
  kiosk rhythm is never interrupted by popups.
- Recording against an `Upcoming` or `Closed` event fails closed (409); the
  form disables itself when the event is not Active.
- `FullscreenToggle` hides the app chrome for distraction-free door operation.
  The tab title is `Check in · <name> · Atty`.

## Key files

| File | Role |
|---|---|
| `app/(app)/events/[eventId]/check-in/page.tsx` | Kiosk page (gate, event header) |
| `components/attendance/CheckInForm.tsx` | Validate → verify → record flow |
| `components/attendance/FullscreenToggle.tsx` | Kiosk fullscreen control |
| `app/api/events/[eventId]/attendance/route.ts` (POST) | Record endpoint |
| `app/api/events/[eventId]/attendance/check/route.ts` | Verify endpoint |
| `app/api/students/lookup/route.ts` | Student lookup by SRCODE |

## Related docs

- [attendance-records.md](attendance-records.md) — viewing what the kiosk recorded
- [../api-security.md](../api-security.md) — per-action authorization
