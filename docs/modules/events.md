# Events

The event lifecycle: listing with status filter, creation, status transitions,
and the per-event detail page. Statuses are `Upcoming`, `Active`, `Closed`.

## Pages and routes

| Route | Purpose |
|---|---|
| `/events` | Listing with status pills (All / Active / Upcoming / Closed) with counts, plus search |
| `/events/[eventId]` | Detail: header, report summary, filters, attendees table |
| `GET/POST /api/events` | List / create |
| `GET /api/events/[eventId]` | Details (cached 30s) |
| `POST /api/events/[eventId]/open` | Mark Active |
| `PATCH /api/events/[eventId]` | Close (empty body) or update fields |

## Rules

- **Listing order:** Active → Upcoming → Closed. Upcoming sorts soonest-first
  (ascending); Closed sorts most-recent-first (descending). Date ranges sort by
  their start date; unparseable dates sink. See `sortEventsForListing`.
- **Status filter** is URL-driven (`?status=`, `?q=`), so filtered views are
  shareable links; junk `?status=` values fall back to All.
- **Creation** (`EventFormDialog`): name, start/end dates (end optional,
  one-day events stay ISO), organizer picker (required), start/end times, and
  location/description. A range serializes into the single backend date string
  as pretty text, which the report prints verbatim. Success fires a toast.
- **Transitions** (`EventActions`): Upcoming → Active ("Mark Active"), any →
  Closed, each with success/error toasts. Only Active events show
  "Take Attendance".
- Browser tabs show the event name (`<name> · Atty`) via `generateMetadata`.

## Key files

| File | Role |
|---|---|
| `app/(app)/events/page.tsx` | Listing page (filter, sort, counts) |
| `app/(app)/events/[eventId]/page.tsx` | Detail page |
| `components/events/EventFilters.tsx` | Status pills + search (URL-driven) |
| `components/events/EventFormDialog.tsx` (+ `Lazy`) | Create dialog |
| `components/events/EventActions.tsx` | Open/close buttons |
| `components/events/EventCard.tsx`, `EventStatusBadge.tsx` | Card + badge |
| `lib/events.ts` | Status parse, start-date, listing sort |

## Related docs

- [attendance-records.md](attendance-records.md) — the table on the detail page
- [reports.md](reports.md) — summary + print view on the detail page
- [check-in.md](check-in.md) — recording attendance for Active events
