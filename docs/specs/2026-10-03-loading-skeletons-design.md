# Per-Route Loading Skeletons Design Spec

Date: 2026-10-03
Status: approved in conversation 2026-10-03
Scope: route-level `loading.tsx` files for all 7 routes, one shared
`EventCardSkeleton`, and a table-shaped `AttendanceTable` fallback. No
backend, auth, API, or styling-system changes.

## Problem

One root `app/loading.tsx` renders 3 generic `CardSkeleton`s for every route
in the app. Navigating to the dashboard, the events list, an event detail
page, the kiosk, the print report, the organizations list, or login all show
the same three cards, none of which resemble the page that is actually
loading. Separately, `AttendanceTable`'s loading state is 3 identical bars
for a 7-column table with a header row.

## Goals

- Every route shows a skeleton that mirrors its real layout, built from the
  existing `Skeleton` primitive only.
- One shared `EventCardSkeleton` serves every surface that renders
  `EventCard`s, so the three never drift.
- The attendance table fallback reads as a table (header + rows), not bars.
- No new dependencies, primitives, colors, or CSS.

## Non-goals

Explicitly out of scope:

- `ReportSummary`'s `h-48` block and the event-detail filters fallback
  already match their content; they stay as they are.
- No changes to loading behavior itself (when fallbacks appear, streaming,
  caching). This is purely what the fallbacks look like.
- No backend, auth, API, or `globals.css` changes.

## Decisions

Settled with the requester on 2026-10-03; not reopenable during implementation.

1. **Per-route `loading.tsx` files**, not one smart component. Next.js renders
   the nearest `loading.tsx` during navigation, so colocation gives each
   route its own skeleton with no route-matching logic.
2. **One shared `EventCardSkeleton`** in `components/events/`, used by the
   dashboard, events-list, and event-detail fallbacks. All three surfaces
   render real `EventCard`s.
3. **The table fallback stays presentational.** It must not reuse the real
   `Table` primitive, which would expose an empty data table to assistive
   technology. Bars keep it decorative (`aria-hidden` comes from `Skeleton`
   itself).
4. **`CardSkeleton` stays exported** from `components/ui/skeleton.tsx` even
   though no loading file uses it after this change. It is a sensible generic
   primitive and removing it is unrelated churn.

## Design

All loading files are server components (no `"use client"`, no data reads).
Every fallback root that replaces meaningful content carries an `aria-label`
matching the existing convention (`"Loading"`, `"Loading attendance"`,
`"Loading filters"`).

### `app/loading.tsx` (login only, after this change)

The login page is brand row, heading, and a card holding the PIN field,
submit button, and error slot. Mirror that:

- Centered `max-w-sm` column: row with `size-14 rounded-2xl` tile plus two
  text lines; `display`-scale title line; `clay` card with `p-5` holding a
  tall `h-14` bar, an `h-12` button bar, and no error slot (errors never
  show while loading).

### `app/(app)/loading.tsx` (dashboard)

The dashboard renders a display title, 3 stat tiles in `grid sm:grid-cols-3`,
and 3 event sections (title + card grid each):

- Title line (`h-8 w-48`, matching `.display` scale).
- 3 stat tiles in `grid gap-4 sm:grid-cols-3`: each a `clay` card with a row
  of `size-11 rounded-2xl` tile, big-number line, label line.
- 3 sections: each a title line (`h-6 w-40`) plus a `grid gap-4
  sm:grid-cols-2 xl:grid-cols-3` of 2 `EventCardSkeleton`s.

### `app/(app)/events/loading.tsx`

The events page renders a header row (title + sub left, New Event button
right) plus the same `sm:2/xl:3` card grid:

- Header row: title + sub lines left, `h-10 w-32 rounded-full` button pill
  right.
- Grid of 3 `EventCardSkeleton`s.

### `app/(app)/events/[eventId]/loading.tsx`

The detail page renders a header card, the report summary, the filter block,
and the table:

- Header `clay-topglow` card: badge row (pill + mono line), title line,
  3 meta rows in the same `grid-cols-2 sm:grid-cols-3` pressed panel, action
  row with 2 button pills.
- Summary block: card with title line and 3 stat boxes in `grid-cols-3`.
- Filter block: the existing shape (search bar + 4 facet boxes), matching
  the current Suspense fallback.
- Table block: header-height bar plus 5 row bars, matching the reshaped
  `AttendanceTable` fallback below.

### `app/(app)/events/[eventId]/check-in/loading.tsx`

The kiosk renders a centered `max-w-xl` column: right-aligned fullscreen
pill, event info card, form card:

- `mx-auto w-full max-w-xl flex flex-col gap-4`: right-aligned `h-9 w-9
  rounded-full` pill; centered info card (id line, title, date line);
  form card (tall input bar + full-width button bar).

### `app/(app)/events/[eventId]/report/print/loading.tsx`

The report renders the letterhead block, event lines, and the records
table, all of which depend on fetched data (event, organization, rows), so
the fallback covers the whole article:

- Centered lines block (logo-adjacent title lines, rule, org line, event
  line, date line), then a table block: header-height bar plus 8 data-row
  bars. Eight rows approximates a full legal page without overstating.

### `app/(app)/organizations/loading.tsx`

The organizations page renders a header row plus the same `sm:2/xl:3` card
grid, where each card holds name, mono id, and email rows:

- Header row: title + sub lines left, `h-10 w-40 rounded-full` button pill
  right (matching "New organization").
- Grid of 3 org-card skeletons: title line, mono id line, email row.

### Shared `EventCardSkeleton`

New `components/events/EventCardSkeleton.tsx`, mirroring `EventCard`'s
anatomy (header with title + id line + badge-side pill, 3 meta rows, 2
button pills) inside the same `clay-topglow` card:

- `CardHeader`: title line + mono id line left, small pill right.
- `CardContent`: 3 meta rows, then a row with two small button pills.

Used by the dashboard, events-list, and event-detail fallbacks.

### AttendanceTable fallback reshape

`components/attendance/AttendanceTable.tsx` lines 26-34: the 3 identical
`h-12` bars become one `h-10` header bar plus 5 `h-12` row bars in the same
`flex flex-col gap-2` container with the same `aria-label="Loading
attendance"`. Row count (5) approximates a first screen of the 50-row
client pagination without overstating.

## Tests

- New `components/events/EventCardSkeleton.test.tsx` (jsdom docblock):
  renders without crashing and exposes no interactive elements (no buttons,
  links, or inputs — it must never be operable or focusable).
- No route `loading.tsx` gets a test: they are static JSX with no logic,
  and the repo has no page-test harness.
- The `AttendanceTable` change is covered by its existing suite if one
  asserts the fallback; otherwise no new test (structure-only change).

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.
- Manual pass with network throttling (devtools "Slow 3G"): navigate to
  each of the 7 routes and confirm the skeleton matches the loaded layout;
  confirm the attendance table shows header + rows shape on first load.
