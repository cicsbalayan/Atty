# DESIGN.md — School Event Attendance System (Frontend MVP)

> Scope: frontend only. Backend (`/api/*` → Apps Script → Sheets) is done. This doc drives UI build.
> Requirements source: `requirements.md` (FR-01..FR-10, §9 Dashboard/Event/Attendance, §13 NFRs).

## 1. Approaches considered

### A. Server-first thin pages (Recommended)
RSC pages fetch via `lib/api-client` with `next:{revalidate}`; interactivity isolated in small `'use client'` islands (`CheckInForm`, `EventFormDialog`, `AttendanceTable`). `dynamic()` lazy-loads reports/dialogs.
- Pros: fastest FCP, matches existing BFF cache (`private, max-age`), smallest client JS, easy `<400 lines/file`.
- Cons: needs careful client/server boundary discipline.
- Use for: all MVP routes.

### B. Full client SPA with query hooks
Everything client-fetches with useEffect + local cache.
- Pros: snappy transitions after load.
- Cons: larger bundle, worse SEO/FCP, duplicates server cache logic, kiosk on slow devices suffers.
- Rejected for MVP.

### C. PWA kiosk + admin split
Separate offline-first kiosk bundle + admin bundle.
- Pros: best for gym-door offline check-in.
- Cons: overkill for MVP (no service-worker infra, doubles routes). Defer to post-MVP.

**Decision: A.** Balanced MVP per user choice: Dashboard, Events, Check-in kiosk, Attendance list, Reports all functional with shared Claymorphism system.

## 2. Information architecture / routes

| Route | Server / Client | Purpose (req ref) |
|---|---|---|
| `/` Dashboard | RSC + client islands | Active / Upcoming / Closed sections (§9.1), stat cards (counts, total present today), CTA Take Attendance |
| `/events` | RSC list + client dialog | View Events, Create Event (FR-02), search + status filter |
| `/events/[eventId]` | RSC detail + tabs | Open/Close (FR-08), View Attendance, filters `?q=&college=&program=&yearLevel=&gender=`, CSV export link, report summary (FR-10) |
| `/events/[eventId]/check-in` | Client kiosk | Event info + SRCODE input + CHECK IN (FR-05, §9.3), success/duplicate/invalid states (FR-06, FR-01) |
| `loading.tsx`, `error.tsx`, `not-found.tsx` | conventions | Skeletons, retry, 404 per route segment |

Deep-linking: `?status=` on `/events`, all attendance filters in URL for shareability. CSV export is plain anchor to existing `GET .../attendance/export` (no JS needed).

Auth placeholder: no login in MVP. `AppShell` reserves `UserSlot`; `middleware.ts` note documents where 3rd-party auth (e.g. Clerk/Auth.js) will gate `/events/*` later. No secrets in client — all calls go to same-origin `/api/*`.

## 3. File & component structure (MVP standard, <400 lines/file)

```
app/
  layout.tsx            # fonts, ThemeProvider, AppShell
  globals.css           # tokens + clay utilities (appended)
  page.tsx              # / dashboard (RSC)
  loading.tsx error.tsx not-found.tsx
  events/page.tsx
  events/[eventId]/page.tsx
  events/[eventId]/check-in/page.tsx
components/
  layout/AppShell.tsx / SiteHeader.tsx / SideNav.tsx / ThemeToggle.tsx
  dashboard/StatCards.tsx StatCard.tsx EventSection.tsx
  events/EventCard.tsx EventStatusBadge.tsx EventFormDialog.tsx EventActions.tsx
  attendance/CheckInForm.tsx CheckInResult.tsx AttendanceTable.tsx AttendanceFilters.tsx ExportButton.tsx
  reports/ReportSummary.tsx BreakdownBar.tsx
  ui/ card.tsx input.tsx badge.tsx dialog.tsx table.tsx skeleton.tsx sonner.tsx (shadcn-style, cva + @base-ui + cn)
  theme-provider.tsx (exists)
hooks/ useEvents.ts useEvent.ts useAttendance.ts useReport.ts useStudentLookup.ts
lib/ api-client.ts (typed fetch to /api/*) format.ts query.ts
models/ (exists: event.ts student.ts attendance.ts report.ts api.ts) — single source of truth
```

ShadcnUI: `components.json` (`base-nova`, `neutral`) respected. Existing `ui/button.tsx` untouched; new `ui/*` follow same `cva + cn` pattern so they remain shadcn swappable. Reusability rule: no route imports another route's component — shared UI lives in `components/*`.

SOLID: each component one job; data-fetch only in `lib/api-client` + `hooks/*`; presentation never calls `fetch` directly (except via hook).

## 4. Type safety / integration contract

Frontend talks only to Next BFF (`/api/events`, `/api/events/[id]/attendance`, `/report`, `/students/lookup`, `/export`). Reuse `models/*` + `ApiResult<T>` discriminated unions:

```ts
import type { SchoolEvent, Student, AttendanceRecord, AttendanceReport } from "@/models/*";
const res: EventsResponse | ApiFailure = await listEvents();
if (!res.success) // code: EVENT_NOT_ACTIVE | DUPLICATE_ATTENDANCE | SRCODE_NOT_FOUND ...
```

- `lib/api-client.ts`: typed wrappers (`listEvents`, `createEvent`, `getEvent`, `recordAttendance`, `checkAttendance`, `listAttendance(filters)`, `getReport`, `lookupStudent`), throws `ApiError(code,message,status)` on `success:false`.
- Validation mirrors `lib/api.ts`: `requireString` semantics client-side for instant feedback, server remains source of truth.
- No Apps Script URL/secret in client. No student PII duplicated — attendance rows join on render only.

## 5. Claymorphic UI system (production grade)

Single source of truth: `app/globals.css` (`:root` / `.dark` tokens + `@layer components`).
Named by purpose, never appearance. Strict WCAG AA: body text `4.5:1`, large text & UI components `3:1`.

### 5.1 Typography — Plus Jakarta Sans + mono for IDs

- Pairing: **Plus Jakarta Sans** (400/500/600/700/800 via `next/font`) for headings + body / **Geist Mono** (SR Code, Event IDs, timestamps only). No third family.
- Headers Bold 700 / ExtraBold 800, tracking `-0.02em`; body Medium 500 / Regular 400 for legibility.
- Modular scale (1.125 ratio): `--font-size-xs 12px` (badges/overlines) → `sm 14px` (labels/tables) → `base 16px` (body) → `lg 18px` (card titles) → `2xl 24px` → `3xl 30px`. Line heights: headings `1.2`, body `1.6`, labels `1.4`. Body max width `65ch`.
- Fluid page titles via `.display`: `clamp(24px, 4vw + 1rem, 30px)`; section overlines via `.overline` (12px, 0.08em tracking, uppercase). Vertical rhythm via `.stack`.

### 5.2 Spacing — 8pt grid

Tokens `--space-1..16` (4/8/12/16/20/24/32/48/64px) map 1:1 onto Tailwind (`gap-2` = 8px, `p-5` = 20px). No magic numbers, no sharp right angles anywhere.
Component rules: card padding `20–24px`, section gaps `24–32px`, form field gaps `16px`, icon–text gap `8px`.

### 5.3 Color — mesh canvas, milk surfaces, energy accents

- Canvas: pastel mesh — sky lavender `#EEF2FF` blending into `#FDF4FF` (`--clay-canvas` → `--clay-canvas-end`; dark: `#0F172A` → `#1E1B4B`), with soft indigo/pink/mint radial blooms.
- Surfaces: milk-white `#FFFFFF` (`--card`; dark: slate `#1E293B`) with volumetric highlights.
- Brand accents: primary CTA electric indigo `#6366F1` (white text ≈ 4.8:1 ✓), secondary bubblegum coral `#FB7185` (decorative fills pair with dark ink `#9F1239`), success mint `#34D399` (ink `#065F46`), warning tangerine `#F97316` (ink `#9A3412`), alert crimson `#F43F5E` (text-carrying destructive is darker `#E11D48` ≈ 4.7:1 ✓).
- Text: headings solid slate `#0F172A` (`--clay-heading`), body charcoal `#475569` (`--clay-body`, ≈ 7:1 on white ✓). Never gray-on-gray. Status is **always icon + text**, never color-only.

### 5.4 Surface architecture — the shadow-stack recipe

```css
.clay {
  border-radius: 28px;              /* cards 24–32px */
  border: 0;                        /* rim highlight instead of 1px borders */
  background: var(--card);
  box-shadow:
    inset 0 0 0 2px rgb(255 255 255 / 0.4),   /* rim */
    0 8px 16px rgb(15 23 42 / 0.04),          /* ambient */
    0 20px 40px rgb(99 102 241 / 0.08),       /* tinted directional drop */
    inset 3px 3px 6px rgb(255 255 255 / 0.85),/* top-left reflection */
    inset -4px -4px 8px rgb(15 23 42 / 0.06); /* bottom-right shade */
}
```

Tokens: `--clay-ambient / --clay-drop / --clay-inner-light / --clay-inner-shade / --clay-rim`, radii `--clay-radius-card 28px / --clay-radius-pressed 20px / --clay-radius-control 18px / --clay-radius-pill 9999px`. Dark mode inverts the stack (deep ambient/directional, faint reflection). Theming is a token swap, never a rule rewrite.
Buttons are puffy pills (`9999px`): hover lifts `1px`; `:active` translates down `2px` and flattens the directional drop. Inputs/selects/search are sunken wells (`inset 2px 2px 4px rgb(0 0 0/0.08)`, `inset -2px -2px 4px rgb(255 255 255/0.9)`); search bars go full-pill via `.clay-search`. Full five-state matrix + `prefers-reduced-motion` guard throughout.

### 5.5 Core component specs

```tsx
// Primary volumetric CTA (indigo gradient pill)
<Button className="clay-btn clay-btn-primary h-12 text-base">Confirm Attendance</Button>
// Secondary / neutral puffy pill
<Button variant="outline" className="clay-btn">Back</Button>
// Inset input + pill search bar
<Input className="h-14 text-center font-mono text-xl" placeholder="23-19300" />
<Input className="clay-search" placeholder="SR Code, name, department…" />
// Metric card: gradient icon tile + tabular numeral + pill tag
<Card className="clay-topglow"><CardContent className="flex-row items-center gap-3">
  <span className="clay-tile-mint flex size-11 rounded-2xl …"><Icon /></span>
  <span className="text-2xl font-extrabold tabular-nums">{value}</span>
  <Badge variant="active">Live</Badge>
</CardContent></Card>
// Modal: clay surface + pop entrance (Base UI focus trap built in)
<DialogContent className="animate-clay-pop">…</DialogContent>
```

### 5.6 Iconography + touch targets

- Lucide only, decorative icons `aria-hidden`. Scale `--icon-xs 12` / `sm 16` / `md 20` / `lg 24` / `xl 32` with `.icon-*` helpers.
- Minimum touch target `44px`: enforced via `nav .clay-btn, form .clay-btn { min-height: 44px }`. Compact buttons stay out of kiosk/primary flows.

### 5.7 Accessibility checklist (per route)

Labels on all inputs · `aria-live="polite"` on check-in results · `role="alert"` on errors · focus trap in dialog (Base UI) · visible 3px focus rings · keyboard: Enter submits, autofocus on kiosk SR Code · `aria-current="page"` on active nav · `aria-label` on icon-only ThemeToggle.

## 6. Performance: lazy loading, batching, caching

- Lazy: `next/dynamic(ssr:false)` for `EventFormDialog`, `ReportSummary`, `BreakdownBar`; `React.lazy+Suspense` skeletons per segment. No chart lib — CSS bars keep bundle ~0.
- Batch: attendance table paginates client-side (50/page); report breakdowns memoized.
- Cache: server TTL read cache in `integration/http.ts` (`getEvents`/`getEvent` 30s, `getAttendance` 10s, `getAttendanceReport` 15s) with in-flight dedupe and shared warm-up; mutations invalidate affected prefixes immediately (opt out via `APPS_SCRIPT_CACHE=off`). RSC `revalidate` 30/10 on top; client `hooks/*` implement SWR map (dedupe in-flight). Mutations call `router.refresh()` + cache invalidate by key prefix.
- Kiosk polling: `checkAttendance` pre-check only on submit (no hot poll) to respect Apps Script quotas (NFR-02).

## 7. Key interactions (states)

Check-in (`/events/[id]/check-in`, per Event-Based Attendance doc §§4/7): validate SR Code → display Department / Full Name / Course → student confirms → record → "Attendance Confirmed." with name/department/course/event/datetime/Present. Invalid → "Invalid SR Code. Please check your SR Code and try again." Duplicate → "Attendance already recorded for this event." Auto-uppercase SRCODE, autofocus, last-5 check-ins list. Records table columns: Date | Time | SR Code | Full Name | Department | Course | Status.

Events: create dialog validates name/date (date ≥ today warning, not block), optimistic card insert → `router.refresh()`. Open/Close are confirm dialogs mapping to `POST .../open` / `PATCH ...` (empty body = close).

Reports: `ReportSummary` shows totalStudents/totalPresent/absent/rate + `BreakdownBar` per college/program/yearLevel/gender. Empty state when 0 present. Export button opens the official PDF report view (`/events/[id]/report/print`, letterhead + records table, legal landscape) carrying the active filters.

## 8. Testing / verification

- `vitest` for `lib/*` (filters, CSV, api-client error mapping) + hook cache keys.
- Manual E2E per `README.md` PowerShell block against dev server + test sheet.
- `npm run typecheck && npm run lint && npm test && npm run build` must pass. Verify 400-line limit: `Get-ChildItem -Recurse *.tsx,*.ts | % { $_ .LineCount }`.

## 9. Backend notes (no action now, flag for later)

- BFF already supports open/update/close/filter/export/report — frontend needs no new endpoints for MVP.
- Later: `GET /api/dashboard/summary` aggregation to avoid N+1 event fetches; rate-limit note for kiosk bursts; Apps Script quota retry with `Retry-After`.
- 3rd-party auth: add `middleware.ts` + `UserSlot`, move open/close/create to `role:staff` scope; secret stays server-only.

## 10. Build order

1. Tokens + `ui/*` clay primitives 2. Layout shell + nav 3. Dashboard 4. Events list + dialog 5. Check-in kiosk 6. Attendance table + filters + export 7. Reports 8. Loading/error states 9. Verify + polish.
