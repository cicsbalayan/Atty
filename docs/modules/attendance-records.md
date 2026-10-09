# Attendance Records

The attendees table on the event detail page: search, facet filters,
server-side pagination, and CSV export.

## How it works

- **Filters** (`AttendanceFilters`, URL-driven `?q=&college=&program=&yearLevel=&gender=`):
  free-text search covers SR code and name; dropdown facets cover department,
  course, year level, and gender. Facet options derive from the full list so
  they never shrink as filters are applied.
- **Server pagination** (`GET …/attendance?page=&pageSize=`): only the current
  page (50 rows) travels to the browser. The upstream sheet read stays whole
  behind the 10s server cache, so page turns cost one cached read total.
  Garbage page params clamp to a valid page instead of erroring.
- **Order:** newest check-in first. Export and print stay chronological.
- **UX:** the previous page stays visible while the next loads ("Loading…"
  note, `aria-busy`); a filter change resets to page 1 and never flashes
  stale rows. Load failures render inline with the message; empty results
  explain themselves.
- **Export** (`ExportButton` → `…/attendance/export`): UTF-8 CSV with BOM
  (Excel-safe), honoring the same filters — always the full filtered list,
  never just the visible page.

## Key files

| File | Role |
|---|---|
| `components/attendance/AttendanceTable.tsx` | Paginated table + keep-previous UX |
| `components/attendance/AttendanceFilters.tsx` | Search + facet dropdowns |
| `components/attendance/RefreshButton.tsx` | Manual refresh of all reads |
| `components/attendance/ExportButton.tsx` | CSV download link builder |
| `lib/attendance.ts` | Filter, paginate, sort-newest, CSV builders |
| `app/api/events/[eventId]/attendance/route.ts` | Filter → sort → paginate endpoint |
| `app/api/events/[eventId]/attendance/export/route.ts` | Full-list CSV endpoint |

## Related docs

- [check-in.md](check-in.md) — how rows get recorded
- [reports.md](reports.md) — the same data as charts and print
