# Loading Skeletons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single generic 3-card loading fallback with per-route skeletons that mirror each page's real layout, plus reshape the attendance table fallback into a table shape.

**Architecture:** Seven new colocated `loading.tsx` server components (Next.js renders the nearest one during navigation), two new shared skeleton components extracted from duplicated-or-new markup (`EventCardSkeleton`, `FilterSkeleton`, `AttendanceTableSkeleton`), and two surgical edits swapping existing fallbacks to the shared pieces. Everything composes the existing `Skeleton` primitive; no new dependencies, primitives, colors, or CSS.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Vitest with `@testing-library/react` in jsdom. No new dependencies.

**Spec:** `docs/specs/2026-10-03-loading-skeletons-design.md`

## Global Constraints

- Every file under 400 lines. The repo enforces this by convention (`README.md`).
- No new npm dependencies. `@testing-library/react` and `jsdom` are already dev dependencies.
- Styling is by design-token utility class only: existing `clay`, `clay-pressed`, `clay-topglow`, `clay-gradient` classes plus `Skeleton`. Do not introduce raw hex colours outside `app/globals.css`. No new rules in `app/globals.css`.
- Skeleton roots that replace meaningful content carry an `aria-label` matching the existing convention (`"Loading"`, `"Loading attendance"`, `"Loading filters"`).
- Loading files and skeleton components are server components: no `"use client"`, no data reads, no interactive elements (no buttons, links, inputs; nothing focusable).
- Copy tone: plain, no exclamation marks, sentence-case button labels. (Skeletons carry almost no copy; the one fallback sentence is copied verbatim.)
- Prettier config is `semi: false`, double quotes, 2-space, `printWidth: 80`, `trailingComma: "es5"`. Format only the files you touch (`npx prettier --write <files>`). Never run repo-wide `npm run format`: the repo is not prettier-clean and it rewrites dozens of untouched files.
- `@testing-library/jest-dom` is not installed and `vitest.config.ts` has no `setupFiles`, so jest-dom matchers (`toHaveAttribute`, `toBeDisabled`, `toHaveTextContent`, `toBeInTheDocument`) do not exist. All test assertions go through the DOM directly (`getAttribute`, `.disabled`, `textContent`, `querySelector`) or plain vitest matchers (`toBe`, `toBeNull`, `toBeTruthy`), matching `hooks/useCached.test.tsx`.
- There is no in-repo precedent for mocking `next/navigation` beyond `vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))`. Component tests that render dialogs must use exactly that shape.

---

## File Structure

| Path | Responsibility |
|---|---|
| `components/events/EventCardSkeleton.tsx` (create) | Loading stand-in for `EventCard`. |
| `components/events/EventCardSkeleton.test.tsx` (create) | Renders cleanly; exposes nothing interactive. |
| `components/attendance/FilterSkeleton.tsx` (create) | The filter-block shape, shared by page fallback and detail loading. |
| `components/attendance/AttendanceTableSkeleton.tsx` (create) | Table-shaped fallback: header bar + 5 row bars. |
| `components/attendance/AttendanceTable.tsx` (modify) | Render `AttendanceTableSkeleton` instead of 3 bars. |
| `app/(app)/events/[eventId]/page.tsx` (modify) | Render `FilterSkeleton` in the existing Suspense fallback. |
| `app/(app)/loading.tsx` (create) | Dashboard skeleton. |
| `app/(app)/events/loading.tsx` (create) | Events-list skeleton. |
| `app/(app)/organizations/loading.tsx` (create) | Organizations-list skeleton. |
| `app/(app)/events/[eventId]/loading.tsx` (create) | Event-detail skeleton. |
| `app/(app)/events/[eventId]/check-in/loading.tsx` (create) | Kiosk skeleton. |
| `app/(app)/events/[eventId]/report/print/loading.tsx` (create) | Print-report skeleton. |
| `app/loading.tsx` (modify) | Rewrite as the login skeleton. |

---

### Task 1: Shared EventCardSkeleton

**Files:**
- Create: `components/events/EventCardSkeleton.tsx`
- Test: `components/events/EventCardSkeleton.test.tsx`

**Interfaces:**
- Consumes: `Card`, `CardContent`, `CardHeader` from `@/components/ui/card`; `Skeleton` from `@/components/ui/skeleton`.
- Produces: `export function EventCardSkeleton(): React.JSX.Element` — no props. Tasks 3 and 4 consume it.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it } from "vitest"
import { EventCardSkeleton } from "./EventCardSkeleton"

afterEach(cleanup)

describe("EventCardSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<EventCardSkeleton />)
    expect(container.firstChild).toBeTruthy()
  })

  it("exposes no interactive elements", () => {
    const { container } = render(<EventCardSkeleton />)
    expect(container.querySelector("button,a,input,select,textarea,[tabindex]")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/events/EventCardSkeleton.test.tsx`
Expected: FAIL — `Cannot find module './EventCardSkeleton'`.

- [ ] **Step 3: Write the component**

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Loading stand-in for EventCard: title, id line, badge-side pill, three
 * meta rows, two action pills. Entirely presentational — no links, buttons,
 * or focusable content, so it can never be operated or tabbed into.
 */
export function EventCardSkeleton() {
  return (
    <Card className="clay-topglow" aria-hidden>
      <CardHeader>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold tracking-tight">
            <Skeleton className="h-5 w-2/3" />
          </div>
          <Skeleton className="mt-1 h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}
```

The wrapping `div` inside the title slot keeps heading semantics out of the skeleton: a `div` (from `Skeleton`) inside an `h3` (from `CardTitle`) would be invalid nesting, so the title styling is applied to a plain `div` instead of reusing `CardTitle`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/events/EventCardSkeleton.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
npx prettier --write components/events/EventCardSkeleton.tsx components/events/EventCardSkeleton.test.tsx
git add components/events/EventCardSkeleton.tsx components/events/EventCardSkeleton.test.tsx
git commit -m "feat(skeleton): add shared event card skeleton"
```

---

### Task 2: Shared filter and table skeletons, rewire existing fallbacks

**Files:**
- Create: `components/attendance/FilterSkeleton.tsx`
- Create: `components/attendance/AttendanceTableSkeleton.tsx`
- Modify: `app/(app)/events/[eventId]/page.tsx` (Suspense fallback only)
- Modify: `components/attendance/AttendanceTable.tsx` (loading branch only)

**Interfaces:**
- Consumes: `Skeleton` from `@/components/ui/skeleton`.
- Produces: `export function FilterSkeleton()`, `export function AttendanceTableSkeleton()` — no props. Tasks 4 consumes both.

- [ ] **Step 1: Create `FilterSkeleton.tsx`**

Byte-identical markup to the current Suspense fallback in `app/(app)/events/[eventId]/page.tsx:140-150`, lifted verbatim:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export function FilterSkeleton() {
  return (
    <div className="clay flex flex-col gap-3 p-4" aria-label="Loading filters">
      <Skeleton className="h-11" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `AttendanceTableSkeleton.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export function AttendanceTableSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading attendance">
      <Skeleton className="h-10" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  )
}
```

One header-height bar plus five row bars: the header reads shorter than data rows, and five rows approximate a first screen of the 50-row client pagination without overstating. The container keeps the exact classes and `aria-label` of the block it replaces, so assistive technology hears no change.

- [ ] **Step 3: Rewire the two existing fallbacks**

In `app/(app)/events/[eventId]/page.tsx`, replace the inline fallback div (lines 140-150) with `<FilterSkeleton />`, add `import { FilterSkeleton } from "@/components/attendance/FilterSkeleton"`, and remove the now-unused `import { Skeleton } from "@/components/ui/skeleton"` (verify with grep that no other `Skeleton` reference remains in that file before removing).

In `components/attendance/AttendanceTable.tsx`, replace the loading branch (lines 26-34) with `return <AttendanceTableSkeleton />`, add the import, and remove the now-unused `Skeleton` import (verify with grep first — same rule).

- [ ] **Step 4: Verify behavior is unchanged**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green. The rendered output of both fallbacks must be identical to before this task — only the code address changed, so confirm by diffing that no class string was altered in either move.

- [ ] **Step 5: Commit**

```bash
npx prettier --write components/attendance/FilterSkeleton.tsx components/attendance/AttendanceTableSkeleton.tsx "app/(app)/events/[eventId]/page.tsx" components/attendance/AttendanceTable.tsx
git add components/attendance/FilterSkeleton.tsx components/attendance/AttendanceTableSkeleton.tsx "app/(app)/events/[eventId]/page.tsx" components/attendance/AttendanceTable.tsx
git commit -m "feat(skeleton): share filter and table skeletons, reshape table fallback"
```

---

### Task 3: List-style route loadings (dashboard, events, organizations)

**Files:**
- Create: `app/(app)/loading.tsx`
- Create: `app/(app)/events/loading.tsx`
- Create: `app/(app)/organizations/loading.tsx`

**Interfaces:**
- Consumes: `EventCardSkeleton` (Task 1); `Skeleton`.
- Produces: three default-exported loading components. No new exports beyond those.

- [ ] **Step 1: Write `app/(app)/loading.tsx`**

The dashboard renders a display title, 3 stat tiles in `grid sm:grid-cols-3`, and 3 event sections (title + card grid each):

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import { EventCardSkeleton } from "@/components/events/EventCardSkeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading">
      <Skeleton className="mt-1 h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        {["a", "b", "c"].map((k) => (
          <div key={k} className="clay flex flex-row items-center gap-3 p-5">
            <Skeleton className="size-11 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((s) => (
        <section key={`section-${s}`} className="flex flex-col gap-3" aria-hidden>
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write `app/(app)/events/loading.tsx`**

The events page renders a header row (title + sub left, New Event button right) plus the `sm:2/xl:3` card grid. The trigger button uses the default button height (`h-8`):

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import { EventCardSkeleton } from "@/components/events/EventCardSkeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `app/(app)/organizations/loading.tsx`**

The organizations page renders the same header-row shape plus the same card grid, where each card holds name, mono id, and email rows:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-40 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {["a", "b", "c"].map((k) => (
          <div key={`org-${k}`} className="clay flex flex-col gap-2 p-5">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: clean. (Full suite runs in Task 5; these files add no logic.)

```bash
npx prettier --write "app/(app)/loading.tsx" "app/(app)/events/loading.tsx" "app/(app)/organizations/loading.tsx"
git add "app/(app)/loading.tsx" "app/(app)/events/loading.tsx" "app/(app)/organizations/loading.tsx"
git commit -m "feat(skeleton): per-route loading screens for list pages"
```

---

### Task 4: Detail, kiosk, print, and login loadings

**Files:**
- Create: `app/(app)/events/[eventId]/loading.tsx`
- Create: `app/(app)/events/[eventId]/check-in/loading.tsx`
- Create: `app/(app)/events/[eventId]/report/print/loading.tsx`
- Modify: `app/loading.tsx` (rewrite as the login skeleton)

**Interfaces:**
- Consumes: `FilterSkeleton`, `AttendanceTableSkeleton` (Task 2); `Skeleton`.
- Produces: four default-exported loading components.

- [ ] **Step 1: Write the event-detail loading file**

The detail page renders a header card (badge row, title, 3-cell meta panel, action row), the report summary (title + 3 stat boxes), the filter block, and the table:

```tsx
import { Skeleton } from "@/components/ui/skeleton"
import { AttendanceTableSkeleton } from "@/components/attendance/AttendanceTableSkeleton"
import { FilterSkeleton } from "@/components/attendance/FilterSkeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading">
      <div className="clay clay-topglow flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-1 h-4 w-1/2" />
        </div>
        <div className="clay-pressed grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>
      <div className="clay flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
      <FilterSkeleton />
      <AttendanceTableSkeleton />
    </div>
  )
}
```

- [ ] **Step 2: Write the check-in loading file**

The kiosk renders a centered `max-w-xl` column: right-aligned icon toggle, centered info card, form card with label, tall input, and button:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4" aria-label="Loading">
      <div className="flex justify-end">
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div className="clay p-5 text-center">
        <Skeleton className="mx-auto h-3 w-24" />
        <Skeleton className="mx-auto mt-1 h-6 w-2/3" />
        <Skeleton className="mx-auto mt-1 h-4 w-1/2" />
      </div>
      <div className="clay flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-14" />
        <Skeleton className="h-12" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the print-report loading file**

The report renders centered letterhead lines, a rule, event lines, and the records table. Eight data rows approximate one full legal page:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <article className="flex flex-col items-center gap-2" aria-label="Loading">
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="my-2 h-1 w-full" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-80" />
      <div className="mt-2 flex w-full flex-col gap-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Rewrite the root loading file as the login skeleton**

The login page renders the brand row, then the `max-w-lg` card holding the PIN label, the 8-cell grid, and the submit button. Mirror that structure exactly, including the real 8-column grid (empty cells read as empty PIN slots):

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div
      className="relative flex min-h-svh flex-col items-center justify-center gap-5 px-4 py-10"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Skeleton className="size-14 rounded-2xl" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="clay clay-topglow w-full max-w-lg p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <div className="grid grid-cols-8 gap-2" aria-hidden>
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </div>
          <Skeleton className="h-12" />
        </div>
      </div>
    </div>
  )
}
```

The grid carries `aria-hidden` (not `aria-hidden={true}` — plain static JSX takes the bare attribute): eight empty wells convey nothing to assistive technology, and the labelled parent already announces the loading state.

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: clean.

```bash
npx prettier --write "app/(app)/events/[eventId]/loading.tsx" "app/(app)/events/[eventId]/check-in/loading.tsx" "app/(app)/events/[eventId]/report/print/loading.tsx" app/loading.tsx
git add "app/(app)/events/[eventId]/loading.tsx" "app/(app)/events/[eventId]/check-in/loading.tsx" "app/(app)/events/[eventId]/report/print/loading.tsx" app/loading.tsx
git commit -m "feat(skeleton): per-route loading screens for detail, kiosk, print, login"
```

---

### Task 5: Verification gate and manual pass

**Files:** none. Verification only; no commit.

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green with no Suspense-boundary warnings. `npm run build` is not optional: route-level `loading.tsx` files change what each route prerenders, and it is the only check that proves no Client Component boundary was crossed (all new files must stay server components).

- [ ] **Step 2: Manual pass with throttled network**

In devtools set Network to "Slow 3G", then navigate to each route and confirm the skeleton matches the loaded layout before content swaps in:

1. `/` — title, 3 stat tiles, 3 titled sections with 2 cards each.
2. `/events` — header row with button pill, 3 event cards.
3. `/events/<id>` — header card, summary block, filter block, table block.
4. `/events/<id>/check-in` — toggle pill, info card, form card.
5. `/events/<id>/report/print` — centered lines plus table block.
6. `/organizations` — header row with button pill, 3 org cards.
7. `/login` — brand row plus PIN card with 8 empty cells.
8. Type a filter on the event detail page and confirm the table area keeps its table shape while refetching.

Record the outcome of each step in the task report. A structural mismatch (wrong block order, missing labelled region) is a defect in the owning task's file; route it back there rather than fixing it here.

---

## Out of Scope

- **`ReportSummary`'s block and the filters fallback content.** Already representative; untouched.
- **`CardSkeleton` removal.** It becomes unused by loading files but stays exported as a generic primitive; removing it is unrelated churn.
- **Loading behavior changes** (when fallbacks appear, streaming boundaries, caching). What the fallbacks look like is the whole of this plan.
- **Docs updates.** The spec is the record for this cycle.
