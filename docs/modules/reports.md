# Reports

On-page summaries and the official print view for an event.

## Pages and routes

| Route | Purpose |
|---|---|
| (embedded in `/events/[eventId]`) | `ReportSummary` with charts |
| `/events/[eventId]/report/print` | Official paginated report, print-optimized (Legal landscape) |
| `GET /api/events/[eventId]/report` | Report data (cached 15s) |

## How it works

- `ReportSummary` fetches via `useReport` and renders chart breakdowns
  (donut, category bars) with skeleton fallbacks while loading.
- The **print view** chunks rows into strict Legal-landscape sheets
  (`PaginatedReport` measure/chunk): repeated header/footer on every page,
  centered event details with Date/Time/Venue on one line, and a footer
  pinned to each page bottom. A single explicit Print button opens the
  dialog; the Download button beside it routes through the same dialog
  (browsers expose no direct file-download API — true server PDFs are
  deferred).
- The letterhead shows the owning organizer's name and email, falling back
  to the default council name/address when the event has none.
- Time and date print verbatim as stored; the tab reads
  `<name> · Attendance Report · Atty`.

## Key files

| File | Role |
|---|---|
| `components/reports/ReportSummary.tsx` | On-page charts (donut, bars) |
| `components/reports/PaginatedReport.tsx` | Sheet chunking for print |
| `components/reports/PrintButton.tsx`, `DownloadPdfButton.tsx` | Toolbar actions |
| `app/(app)/events/[eventId]/report/print/page.tsx` | Print page (server data, letterhead) |

## Related docs

- [organizers.md](organizers.md) — where the letterhead comes from
- [attendance-records.md](attendance-records.md) — the underlying rows
