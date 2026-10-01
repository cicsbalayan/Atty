# Organizations UI Implementation Plan

> **For agentic workers:** implement this plan task-by-task, marking each step
> with `- [ ]` as you go. A fresh reviewer per task is recommended over one
> reviewer at the end, because Task 7 rewrites print output where a styling
> regression is invisible to any test.

> **Amendment 2026-10-02:** the org model is now `{ id, name, email }` only,
> deletes are permanent, and there is no restore path. Tasks below are updated
> to match; anything still mentioning address/phone/website, soft delete, or
> restore is stale.

**Goal:** Give organizations and event time ranges a real interface — a management page, an org picker on the create form, an edit dialog, and a print report that renders the organization's letterhead instead of hardcoded text.

**Architecture:** The backend already exists and is uncommitted. This plan adds only the client. A new `/organizations` route group holds a list page and a per-org detail page reached by clicking the org name; the detail page lists that org's events. `EventFormDialog` gains a required org picker and a time input. A new `EventEditDialog` patches an existing event's org and time. The print page resolves its letterhead through a new pure module, `lib/report-letterhead.ts`, falling back to the pre-existing hardcoded letterhead when an event has no org — so every report printed before this change comes out byte-identical.

**Tech Stack:** Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind 4, `@base-ui/react` primitives, `jose` sessions, Vitest. No new dependencies.

**Spec:** `docs/specs/2026-10-01-organizations-backend-design.md`

## Global Constraints

- Every file under 400 lines. The repo enforces this by convention (`README.md`).
- No new npm dependencies. `@base-ui/react`, `lucide-react`, and `cn` are already present.
- Styling is by design-token utility class only: `clay`, `clay-btn`, `clay-btn-primary`, `clay-input`, `clay-pressed`, `clay-tile-*`, `display`, `overline`, `tabular-nums`, `font-mono`. Do not introduce raw hex colours outside `app/globals.css`.
- Every `page.tsx` outside `app/login/` must call `await requireAdminPage()` or `lib/auth/cache-isolation.test.ts` fails the build.
- Every exported handler in a new `route.ts` must have its own `await requireAdmin()` for the same reason.
- `integration/cached.ts` must not import from `lib/auth/*`.
- Styling and copy follow the existing tone: plain, no exclamation marks, sentence-case button labels ("Create event", not "Create Event!").
- Prettier config is `semi: false`, double quotes, 2-space, `printWidth: 80`, `trailingComma: "es5"`. Run `npm run format` before committing.

## Decisions This Plan Fixes

These were settled with the requester and are not reopenable during execution:

1. **The org name links to that org's event list**, at `/organizations/[orgId]`. Not a combined org-wide report — that would need a new aggregate endpoint and a new print layout, and the per-event report already exists.
2. **`orgId` is required when creating an event.** The form now collects it, so the dropdown has no "None" option. The backend still accepts a blank `orgId` (existing events and the kiosk path depend on it), so this is a UI-side requirement only — do not tighten the backend.
3. **Only the org name and email ever change on the letterhead.** An event with no org prints the original hardcoded letterhead. An event with an org prints the org's name on the council line and its email on the contact line; a blank name or email falls back to that line's default. Every other line is fixed university identity.
4. **`time` stays free text.** No `<input type="time">`, no parsing, no 12-hour formatting. A plain text input with a `12:00 pm - 5:00 pm` placeholder.
5. **Deleting an organization is permanent, so the UI must read as data loss.** There is no restore path: the delete control uses destructive styling and a confirm step warning that events attached to the org stop resolving it. Only delete organizations with no events.

---

## File Structure

**New files**

| Path | Responsibility |
|---|---|
| `lib/report-letterhead.ts` | Pure resolver: `Organization \| null` → the letterhead lines the print page renders. No React, no I/O. |
| `lib/report-letterhead.test.ts` | Its unit tests. |
| `app/(app)/organizations/page.tsx` | Lists every organization; the name links to its detail page. |
| `app/(app)/organizations/[orgId]/page.tsx` | One organization: its contact details and its events. |
| `components/organizations/OrganizationFormDialog.tsx` | Create or edit one organization. |
| `components/organizations/OrganizationFormDialogLazy.tsx` | `next/dynamic` wrapper, matching `EventFormDialogLazy`. |
| `components/organizations/OrganizationCard.tsx` | One organization in the list grid. |
| `components/organizations/EventOrgFilter.tsx` | The `?org=` status/search bar on `/events`. |
| `components/organizations/OrganizationDeleteButton.tsx` | Hard delete with a confirm step. No restore. |
| `components/events/EventEditDialog.tsx` | Patches an existing event's org and time. |
| `app/api/organizations/[orgId]/route.ts` | Already exists uncommitted. No change needed. |

**Modified files**

| Path | Change |
|---|---|
| `lib/api-client.ts` | Add `listOrganizations`, `createOrganization`, `updateOrganization`, `deleteOrganization`. |
| `hooks/useQueries.ts` | Add `useOrganizations`. |
| `components/layout/SideNav.tsx` | Add an Organizations link. |
| `components/events/EventFormDialog.tsx` | Add required org picker and time input. |
| `app/(app)/events/[eventId]/page.tsx` | Show org name and time; mount `EventEditDialog`. |
| `app/(app)/events/page.tsx` | Mount `EventOrgFilter`, filter by `?org=`. |
| `app/(app)/events/[eventId]/report/print/page.tsx` | Render the resolved letterhead and `event.time`. |
| `app/(app)/events/[eventId]/report/print/page.tsx` | Resolve the org via `getOrganizationCachedFor`, degrade to `null`. |

**Unchanged, deliberately**

- `apps-script/**` — the backend is done. No task here edits it.
- `app/api/events/**` — already accepts `orgId` and `time`.
- `components/attendance/**`, `components/reports/**` — untouched.

---

## Review Focus

Five failure modes the spec implies but that no unit test in this plan would otherwise catch. Each has a test added to the task that owns the code, in that task's own step style.

1. **A legacy event with `orgId: ""` still prints.** The most likely visible regression: a report that comes out with an empty letterhead because the resolver returned blanks. Covered by `lib/report-letterhead.test.ts` → "falls back to the legacy letterhead when an event has no organization".
2. **A new organization with only a name prints that name and the default email line.** Only name and email are org-driven; a blank email keeps the default contact line rather than printing a half-empty one. Covered by "keeps the default contact line when the org has no email".
3. **Zero organizations exist.** The create-event form's required picker then has nothing to choose, and the user is stuck — the form is useless until they create an org. Task 3 handles this with an empty-state prompt and a link, not a disabled dropdown.
4. **An organization is renamed or its contact details edited.** The print page must show the change on the next print without a redeploy, and a cached read must not serve the old letterhead. Covered by Task 6 wiring `expireOrganization` on the write path, and by the existing `integration/cached.test.ts` tag tests.
5. **Time containing characters that look like markup or an em dash.** It is rendered as a React text child, never `dangerouslySetInnerHTML`, so it is escaped by construction. Assert it renders literally.

---

## Task 1: Letterhead resolver

The only piece of this plan with real logic. Everything else is wiring, so this goes first and unblocks Task 6.

**Files:**
- Create: `lib/report-letterhead.ts`
- Test: `lib/report-letterhead.test.ts`

**Interfaces:**
- Consumes: `import type { Organization } from "@/models/organization"` — already exists uncommitted. Shape: `{ id, name, email }`, all three strings.
- Produces:
  ```ts
  export interface Letterhead {
    country: string
    name: string
    campus: string
    branch: string
    address: string
    phone: string
    contact: string
    email: string
    website: string
    council: string
    motto: string
  }
  export const DEFAULT_LETTERHEAD: Letterhead
  export function letterheadFor(org: Organization | null): Letterhead
  ```

- [ ] **Step 1: Write the failing test**

Create `lib/report-letterhead.test.ts`. Use this fixture and these cases verbatim:

```ts
import { describe, expect, it } from "vitest"
import { DEFAULT_LETTERHEAD, letterheadFor } from "./report-letterhead"
import type { Organization } from "@/models/organization"

const org: Organization = {
  id: "ORG-002",
  name: "Nueva Eatry",
  email: "nueva@example.edu",
}
```

Cases, one `it` each:

- `letterheadFor(null)` deep-equals `DEFAULT_LETTERHEAD`
- `letterheadFor(org).name` is `"Nueva Eatry"`
- the contact line uses the org email: `"E-mail Address: nueva@example.edu | Website Address: https://nueva.example.edu"`
- `{ ...org, email: "" }` keeps the default contact line — a blank email never prints a half-empty line
- `country`, `campus`, `branch`, `address`, `phone`, `website`, `council`, `motto` equal `DEFAULT_LETTERHEAD`'s, since no org supplies them
- `letterheadFor({ ...org, name: "" })` falls back to `DEFAULT_LETTERHEAD.name` — an unnamed org is the one per-field fallback allowed, because a report with no school name at all is useless
- `letterheadFor({ ...org, email: "   " })` keeps the default contact line — whitespace-only is blank

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/report-letterhead.test.ts`
Expected: FAIL — `Cannot find module './report-letterhead'`

- [ ] **Step 3: Implement the module**

Create `lib/report-letterhead.ts` exporting the three symbols above.

`DEFAULT_LETTERHEAD` is transcribed exactly from the current hardcoded print page at `app/(app)/events/[eventId]/report/print/page.tsx:74-96` and `:102` and `:204`:

```ts
export const DEFAULT_LETTERHEAD: Letterhead = {
  country: "Republic of the Philippines",
  name: "BATANGAS STATE UNIVERSITY",
  campus: "The National Engineering University",
  branch: "Balayan Campus",
  address: "Caloocan, Balayan, Batangas, Philippines 4213",
  phone: "(+63 43) 980-0385 local 6101",
  contact:
    "E-mail Address: sscbalayan@g.batstate-u.edu.ph | Website Address: http://www.batstate-u.edu.ph",
  email: "sscbalayan@g.batstate-u.edu.ph",
  website: "http://www.batstate-u.edu.ph",
  council: "Supreme Student Council Alangilan – Balayan",
  motto: "Leading Innovations, Transforming Lives, Building the Nation",
}
```

Note the en dash in `council` and the typographic apostrophe-free `motto`. Copy the strings, do not retype them from memory.

`letterheadFor` returns `DEFAULT_LETTERHEAD` itself (not a copy) when `org` is null. Otherwise start from `DEFAULT_LETTERHEAD` and override `name` (falling back to the default when blank) and the email half of `contact` (keeping the default contact line when the org email is blank). The website half of `contact` is always the default. Use a local `blank(v: string | undefined)` helper returning `(v ?? "").trim()`.

Add a module-level comment recording why only name and email are org-driven: the rest is fixed university identity, not per-customer data.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/report-letterhead.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/report-letterhead.ts lib/report-letterhead.test.ts
git commit -m "feat(reports): resolve the print letterhead from an organization"
```

---

## Task 2: Organization client functions

**Files:**
- Modify: `lib/api-client.ts`
- Modify: `hooks/useQueries.ts`

**Interfaces:**
- Consumes: `import type { OrganizationResponse, OrganizationsResponse } from "@/models/api"` — already exists uncommitted.
- Produces, in `lib/api-client.ts`:
  ```ts
  export function listOrganizations(): Promise<OrganizationsResponse>
  export function createOrganization(
    input: CreateOrganizationInput
  ): Promise<OrganizationResponse>
  export function updateOrganization(
    orgId: string,
    input: UpdateOrganizationInput
  ): Promise<OrganizationResponse>
  ```
  In `hooks/useQueries.ts`:
  ```ts
  export function useOrganizations(): {
    data: Organization[] | null
    error: Error | null
    loading: boolean
    refresh: () => void
  }
  ```

- [ ] **Step 1: Write the failing test**

Extend `integration/events.test.ts`? No — this is the browser fetcher, which has no suite. Instead assert the wiring in `hooks/useCached`-style by adding a test file `hooks/useQueries.test.tsx` with a `@vitest-environment jsdom` docblock:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api-client", () => ({
  listOrganizations: vi.fn(),
  listEvents: vi.fn(),
  getEvent: vi.fn(),
  listAttendance: vi.fn(),
  getReport: vi.fn(),
}))
```

Assert that rendering `useOrganizations()` inside a `renderHook` from `@testing-library/react` with `listOrganizations` resolving `{ success: true, organizations: [] }` eventually yields `data.organizations` of length 0, and that `loading` is true before the promise settles. This is the smallest assertion that the hook is actually wired to the client function — the behaviour the page depends on.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run hooks/useQueries.test.tsx`
Expected: FAIL — `useOrganizations` is not exported.

- [ ] **Step 3: Implement the client functions**

In `lib/api-client.ts`, mirror `listEvents` (line 47) and `createEvent` (line 84) exactly:

```ts
export function listOrganizations(): Promise<OrganizationsResponse> {
  return request<OrganizationsResponse>("/api/organizations", {
    cache: "no-store",
  })
}
```

`createOrganization` and `updateOrganization` take the input objects and `JSON.stringify` them as the POST / PATCH body against the same paths, matching `createEvent` and `updateEvent`. Add the three type imports to the existing import block at the top.

One more, for Task 4b:

```ts
export function deleteOrganization(orgId: string): Promise<OrganizationResponse> {
  return request<OrganizationResponse>(
    `/api/organizations/${encodeURIComponent(orgId)}`,
    { method: "DELETE" }
  )
}
```

Delete is permanent — there is no restore endpoint — so the call site stays a plain `DELETE` on the item.

In `hooks/useQueries.ts`, mirror `useEvents`:

```ts
export function useOrganizations() {
  const result = useCached("organizations:all", listOrganizations, 30_000)
  const refresh = React.useCallback(() => {
    invalidatePrefix("organizations:")
    result.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.refresh])
  return { ...result, refresh }
}
```

Note the cache key prefix is `organizations:`, so `invalidatePrefix("organizations:")` is what every organization mutation must call. Add `listOrganizations` to the existing import from `@/lib/api-client`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run hooks/useQueries.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/api-client.ts hooks/useQueries.ts hooks/useQueries.test.tsx
git commit -m "feat(org): add browser client and query hook for organizations"
```

---

## Task 3: Organization form dialog

**Files:**
- Create: `components/organizations/OrganizationFormDialog.tsx`
- Create: `components/organizations/OrganizationFormDialogLazy.tsx`
- Test: `components/organizations/OrganizationFormDialog.test.tsx`

**Interfaces:**
- Consumes: `createOrganization`, `updateOrganization` from `@/lib/api-client` (Task 2); `Organization` from `@/models/organization`; `invalidatePrefix` from `@/hooks/useCached`; `Dialog`, `DialogContent`, `DialogDescription`, `DialogTitle`, `DialogTrigger` from `@/components/ui/dialog`; `Input`, `Label` from `@/components/ui/input`; `Button` from `@/components/ui/button`.
- Produces:
  ```ts
  export function OrganizationFormDialog({
    organization,
  }: {
    organization?: Organization
  }): React.JSX.Element
  export const OrganizationFormDialogLazy: React.ComponentType
  ```
  Omitting `organization` creates; passing one edits. The lazy wrapper is create-only, matching `EventFormDialogLazy`.

- [ ] **Step 1: Write the failing test**

Create `components/organizations/OrganizationFormDialog.test.tsx` with a `@vitest-environment jsdom` docblock. Mock `@/lib/api-client` so `createOrganization` and `updateOrganization` are `vi.fn()` resolving `{ success: true, organization: {...} }`, and mock `next/navigation`'s `useRouter` to return `{ refresh: vi.fn() }`.

Two cases:

- **create mode:** render `<OrganizationFormDialog />`, fill the `name` input with `"Nueva Eatry"`, submit the form, then assert `createOrganization` was called once with an object whose `name` is `"Nueva Eatry"` and whose `email` is `""` — the blank field is sent explicitly rather than omitted, matching what `integration/organizations.ts` sends.
- **edit mode:** render `<OrganizationFormDialog organization={org} />` where `org` is a full fixture, assert every input carries the org's current value, change the `email` input, submit, and assert `updateOrganization` was called once with `(org.id, { email: "new@example.edu" })` — **only** the changed field, not the whole object. This is the partial-update contract from the backend `PATCH`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/organizations/OrganizationFormDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the dialog**

`"use client"` on line 1. Copy the structure of `EventFormDialog` (77 lines) exactly: `useRouter`, `open` / `error` / `saving` state, an `onSubmit(form: FormData)` that awaits the call, calls `invalidatePrefix`, closes, and `router.refresh()`, with `error` in a `<p role="alert">` and the submit button disabled while `saving`.

Two fields, in this order, using `Label` + `Input` with these exact `name`, `maxLength`, and `placeholder` values:

| `name` | `maxLength` | `placeholder` | required |
|---|---|---|---|
| `name` | 150 | `Batangas State University` | yes |
| `email` | 150 | `sscbalayan@g.batstate-u.edu.ph` | no |

Two fields — `id` is assigned by the backend and is not editable.

`DialogTitle` is `"Create organization"` or `"Edit organization"`. `DialogDescription` is `"The name and email appear on printed attendance reports."` in create mode and the org's id in edit mode. Submit button label is `"Create organization"` / `"Save changes"`.

In edit mode send only the fields that differ from the loaded org. Build the patch by comparing each form value to `organization[field]` and including it when different. This mirrors `parsePatchBody` in `app/api/organizations/[orgId]/route.ts`, which rejects an empty body — so always send at least `name` on edit.

Call `invalidatePrefix("organizations:")` after either mutation, and `invalidatePrefix("events:")` as well, because an org rename changes how events display.

- [ ] **Step 4: Implement the lazy wrapper**

Create `OrganizationFormDialogLazy.tsx` as a byte-for-byte structural copy of `EventFormDialogLazy.tsx`, swapping the import to `./OrganizationFormDialog`, the icon to `Building2` from `lucide-react`, and the labels to `New Organization`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run components/organizations/OrganizationFormDialog.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add components/organizations/
git commit -m "feat(org): add the organization create and edit dialog"
```

---

## Task 4: Organization pages and navigation

**Files:**
- Create: `app/(app)/organizations/page.tsx`
- Create: `app/(app)/organizations/[orgId]/page.tsx`
- Create: `components/organizations/OrganizationCard.tsx`
- Modify: `components/layout/SideNav.tsx`

**Interfaces:**
- Consumes: `getOrganizationsCached`, `getOrganizationCachedFor` from `@/integration/cached` (exist uncommitted); `getEventsCached`; `letterheadFor` is **not** used here; `Organization` from `@/models/organization`; `EventCard` from `@/components/events/EventCard`; `OrganizationFormDialogLazy` from Task 3.
- Produces: two routes, `/organizations` and `/organizations/[orgId]`. No new exported symbols beyond the two page components and `OrganizationCard`.

- [ ] **Step 1: Write the failing test**

There is no page-test harness in this repo, and the structural guard is the test. Run it and watch it fail:

Run: `npx vitest run lib/auth/cache-isolation.test.ts`
Expected: FAIL — `app/(app)/organizations/page.tsx: every page under the (app) group calls the auth gate`. The guard walks `app/**` for `page.tsx` and requires `await requireAdminPage()`.

- [ ] **Step 2: Create the list page**

`app/(app)/organizations/page.tsx`. `export const dynamic = "force-dynamic"` with a comment matching `app/(app)/events/page.tsx:7-11`. `await requireAdminPage()` first. Then `getOrganizationsCached()` in a `try`/`catch` that sets a `error` string, exactly as the events page does, so a failed read degrades to an empty list plus a `role="alert"` message rather than a 500.

Header block mirrors `app/(app)/events/page.tsx:39-46`: `<h1 className="text-2xl font-bold tracking-tight">Organizations</h1>`, a `<p className="text-sm text-muted-foreground">` reading `"The offices and schools using this tracker."`, and `<OrganizationFormDialogLazy />` on the right.

Grid is `grid gap-4 sm:grid-cols-2 xl:grid-cols-3`, mapping `OrganizationCard`.

Empty state is `<p className="clay p-4 text-sm text-muted-foreground">No organizations yet. Add the first one.</p>` — this is Review Focus item 3 and the create-event form depends on it being reachable.

- [ ] **Step 3: Create the card**

`components/organizations/OrganizationCard.tsx`, a server component. `Card` with `clay-topglow`, `CardHeader` holding the org name as `CardTitle` and the id as `<p className="mt-1 font-mono text-xs text-muted-foreground">{org.id}</p>`, plus `CardContent` listing the email when non-empty, as `<p className="flex items-center gap-1.5 text-sm text-muted-foreground">` with the `Mail` lucide icon (`size-3.5`, `aria-hidden`). Skip the line entirely when blank rather than rendering an empty row.

**The org name is the link to its events.** Render it as `<Link href={`/organizations/${org.id}`}>` wrapping the `CardTitle`, with `className="hover:underline underline-offset-4"` added, matching the link treatment in `app/(app)/events/[eventId]/report/print/page.tsx:132-135`. Keep an `Edit` affordance out of the card — the detail page owns editing.

- [ ] **Step 4: Create the detail page**

`app/(app)/organizations/[orgId]/page.tsx`. Signature:

```tsx
export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
})
```

`await requireAdminPage()`, then `const { orgId } = await params`. Read the org with `getOrganizationCachedFor(orgId)` and call `notFound()` on failure — same as `app/(app)/events/[eventId]/page.tsx:69-75`. Read `getEventsCached()` in a `try`/`catch` defaulting to `[]`, because a failed event read must not blank the org's contact card.

Filter in memory: `events.filter((e) => e.orgId === org.id)`. Do **not** add a server-side org filter yet; the sheet read is already bulk and the client filter in Task 5 covers the `/events` page.

Layout: a back link to `/organizations`, then a `Card` with the org's name, id, and email, then a heading `Events` and a grid of `EventCard` for its events, or `<p className="clay p-4 text-sm text-muted-foreground">This organization has no events yet.</p>`.

Show the count: `{events.length} event{events.length === 1 ? "" : "s"}`.

Mount the edit dialog from Task 3 in this page's header — this is the only place an organization is edited, and leaving it unmounted would make the edit mode of `OrganizationFormDialog` dead code:

```tsx
<OrganizationFormDialog organization={org} />
```

`OrganizationFormDialog` is a client component, so import it directly rather than through the lazy wrapper; the lazy wrapper is create-only. Render it beside the org's name in the `CardHeader`, whose existing `justify-between` puts it opposite the title.

- [ ] **Step 5: Add the nav link**

In `components/layout/SideNav.tsx`, add `{ href: "/organizations", label: "Organizations", icon: Building2 }` to the `links` array after the Events entry, importing `Building2` from `lucide-react`. Nothing else changes — the active-state logic is generic.

- [ ] **Step 6: Run the guard to verify it passes**

Run: `npx vitest run lib/auth/cache-isolation.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/organizations components/organizations/OrganizationCard.tsx components/layout/SideNav.tsx
git commit -m "feat(org): add organization list and detail pages"
```

---

## Task 4b: Hard delete

Delete removes the row permanently: no Deleted stamp, no restore path. The control must read as data loss, because it is — destructive styling and a confirm step warning that events attached to the org stop resolving it. That is the data-loss wording from Decision 5.

**Files:**
- Create: `components/organizations/OrganizationDeleteButton.tsx`

**Interfaces:**
- Consumes: `deleteOrganization` from `@/lib/api-client` (Task 2); `Organization` from `@/models/organization`; `Button`, `Dialog*` from `@/components/ui/*`; `invalidatePrefix` from `@/hooks/useCached`.
- Produces:
  ```ts
  export function OrganizationDeleteButton({
    organization,
  }: {
    organization: Organization
  }): React.JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `components/organizations/OrganizationDeleteButton.test.tsx` with a `@vitest-environment jsdom` docblock, mocking `deleteOrganization` to resolve `{ success: true, organization: {...} }`, and `next/navigation`'s `useRouter`.

Two cases:

- **delete is confirmed before it fires.** Click `Delete`, assert `deleteOrganization` has **not** been called yet, then click the confirm button inside the dialog and assert it was called once with the org's id. A destructive action that fires on the first click is a mis-click waiting to happen.
- **the confirm copy warns about attached events.** Assert the dialog text mentions that the delete is permanent.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/organizations/OrganizationDeleteButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

`"use client"`. A trigger `Button` labelled **Delete** in the `destructive` variant opens a `Dialog`. `DialogTitle` is `"Delete organization"`. `DialogDescription` says, in these words or close to them: **"This permanently removes the organization. Events attached to it stop resolving it, so only delete organizations with no events."** That sentence is the whole point of the copy — it is what stops an operator from orphaning live events.

One confirm `Button` **Delete organization**, also `destructive`, calling `deleteOrganization(organization.id)`.

On success: `invalidatePrefix("organizations:")`, `invalidatePrefix("events:")`, close, `router.refresh()`.

Errors go in a `<p role="alert">`, matching the other dialogs.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/organizations/OrganizationDeleteButton.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Mount it on the detail page**

In `app/(app)/organizations/[orgId]/page.tsx`, render `<OrganizationDeleteButton organization={org} />` in the `CardHeader` beside `OrganizationFormDialog`.

- [ ] **Step 6: Commit**

```bash
git add components/organizations/OrganizationDeleteButton.tsx components/organizations/OrganizationDeleteButton.test.tsx "app/(app)/organizations/[orgId]/page.tsx"
git commit -m "feat(org): hard-delete an organization"
```

---

## Task 5: Event create form and list filter

**Files:**
- Modify: `components/events/EventFormDialog.tsx`
- Create: `components/organizations/EventOrgFilter.tsx`
- Modify: `app/(app)/events/page.tsx`

**Interfaces:**
- Consumes: `useOrganizations` from `@/hooks/useQueries` (Task 2); `ClaySelect` from `@/components/ui/select`; `SchoolEvent`, `CreateEventInput` from `@/models/event`.
- Produces:
  ```ts
  export function EventOrgFilter({
    orgs,
  }: {
    orgs: { id: string; name: string }[]
  }): React.JSX.Element
  ```
  and `app/(app)/events/page.tsx` reads an extra `org?: string` search param.

- [ ] **Step 1: Write the failing test**

Create `components/events/EventFormDialog.test.tsx` with a `@vitest-environment jsdom` docblock. Mock `@/lib/api-client` (`createEvent`) and `@/hooks/useQueries` (`useOrganizations` returning `{ data: [{ id: "ORG-001", name: "Batangas State University" }], loading: false, error: null, refresh: vi.fn() }`).

Three cases:

- **org is submitted:** fill `name`, `date`, select `ORG-001`, submit. Assert `createEvent` received `orgId: "ORG-001"`.
- **time is submitted verbatim:** fill `time` with `"12:00 pm - 5:00 pm"`, submit. Assert the call received exactly that string — no trimming of the inner spaces, no case change. This is Review Focus item 5.
- **submit is blocked with no org chosen:** submit with `name` and `date` filled but no org selected. Assert `createEvent` was **not** called and a `role="alert"` element is present whose text mentions the organization. The picker is required, so the form must refuse rather than send a blank `orgId`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/events/EventFormDialog.test.tsx`
Expected: FAIL — the form has no `orgId` or `time` field.

- [ ] **Step 3: Add the two fields**

In `EventFormDialog`, call `useOrganizations()` and render the two new controls inside the existing `<form>`, before the description field.

The org picker is a `ClaySelect` with `value` / `onChange` held in a `const [orgId, setOrgId] = React.useState("")`, `placeholder` `"Select an organization"`, and `options` mapped from `orgs` to their names. `ClaySelect` takes `string[]` options and its first item is the `allLabel` value `""`, so pass `allLabel` as `"Select an organization"`.

`ClaySelect` has no native "required" behaviour, so enforce it in `onSubmit`: if `!orgId`, set the error to `"Select an organization."` and return before calling `createEvent`. Keep the existing `try`/`catch` and the `role="alert"` paragraph.

When `orgs` is empty, render instead of the picker: a `<p role="alert">` reading `"No organizations yet. Add one on the Organizations page first."` containing a `<Link href="/organizations">`, and disable the submit button. This is Review Focus item 3 — a required picker with nothing to choose from is a dead end.

The time field is a plain `Input` with `name="time"`, `maxLength={100}`, and `placeholder="12:00 pm - 5:00 pm"`. **Not** `type="time"` — the value is a display range, not a time the browser can parse.

Add `orgId: orgId, time: String(form.get("time") ?? "")` to the `createEvent` call.

The org picker sits on its own row directly after the date/location grid, and the time field on the row below it. Neither shares a grid cell: a name and a date are short, and a value like `12:00 pm - 5:00 pm` needs the full width to stay legible and to avoid the browser resizing the text field mid-typing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/events/EventFormDialog.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Create the list filter**

`EventOrgFilter.tsx`, `"use client"`, mirroring `components/attendance/AttendanceFilters.tsx`. It reads the current `?org=` from `useSearchParams` and pushes `router.replace` on change, preserving the existing `status` and `q` params. Render a `ClaySelect` whose `options` are org names and whose value is the selected org **name**, mapping back to an id before writing the query param. Include a clear affordance that drops `org` from the query string.

Keep the component dumb: it takes `orgs` as a prop so the page owns the data and the component owns only the URL.

- [ ] **Step 6: Wire the filter into the events page**

In `app/(app)/events/page.tsx`, widen the `searchParams` type to include `org?: string`. Load `getOrganizationsCached()` alongside `getEventsCached()` in the existing `try`/`catch` that already degrades to `[]`, then extend the filter predicate:

```ts
if (orgId && e.orgId !== orgId) return false
```

matching `orgId` against the `?org=` value by looking it up in the org list by name. Render `<EventOrgFilter orgs={organizations} />` in the filter row beside the existing status and search controls.

- [ ] **Step 7: Commit**

```bash
git add components/events/EventFormDialog.tsx components/events/EventFormDialog.test.tsx components/organizations/EventOrgFilter.tsx "app/(app)/events/page.tsx"
git commit -m "feat(events): require an organization and collect a time range"
```

---

## Task 6: Event detail editing

**Files:**
- Create: `components/events/EventEditDialog.tsx`
- Modify: `app/(app)/events/[eventId]/page.tsx`

**Interfaces:**
- Consumes: `updateEvent` from `@/lib/api-client`; `useOrganizations` from `@/hooks/useQueries`; `SchoolEvent` from `@/models/event`; `ClaySelect`, `Input`, `Label`, `Dialog*`, `Button` from `@/components/ui/*`.
- Produces:
  ```ts
  export function EventEditDialog({
    event,
  }: {
    event: SchoolEvent
  }): React.JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `components/events/EventEditDialog.test.tsx` with a `@vitest-environment jsdom` docblock, mocking `updateEvent` and `useOrganizations`. A `SchoolEvent` fixture with `orgId: "ORG-001"` and `time: "12:00 pm - 5:00 pm"`.

- **prefill:** assert the select shows the org whose id is `ORG-001` and the time input holds `"12:00 pm - 5:00 pm"`.
- **partial patch:** change only the time to `"5:30 pm - 8:00 pm"`, submit, assert `updateEvent` was called with `(event.id, { time: "5:30 pm - 8:00 pm" })` — the unchanged `orgId` is **omitted**, not sent as a no-op. `app/api/events/[eventId]/route.ts` rejects a body with no recognisable fields, and a redundant `orgId` would needlessly re-run org validation.
- **reassign org:** change the select to `ORG-002` and submit with the time untouched. Assert the call was `(event.id, { orgId: "ORG-002" })`. This is the path that lets an operator fix a legacy event's blank `orgId`, which is the whole reason this dialog exists.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/events/EventEditDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the dialog**

`"use client"`. Copy `OrganizationFormDialog`'s state and submit structure. Two controls only: a `ClaySelect` for the org, initialised to `event.orgId` — and note that a legacy event's `orgId` is `""`, which is `ClaySelect`'s `allLabel` item, so it renders as "not selected" and the operator must pick one; and a text `Input` for `time`, `maxLength={100}`, `placeholder="12:00 pm - 5:00 pm"`, initialised to `event.time`.

On submit, build the patch by comparing each control to the event's current value and including only what changed. If the patch is empty, set the error to `"Nothing to save."` rather than firing a request the route would reject with `INVALID_FIELD`.

`DialogTitle` is `"Edit event"`, description `"Set the owning organization and the time shown on the report."`. Trigger is an outline `Button` labelled `"Edit"` with a `Pencil` icon, matching the button treatment in `EventActions`.

On success: `invalidatePrefix("events:")`, `invalidatePrefix("organizations:")`, close, `router.refresh()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/events/EventEditDialog.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Mount it and show the current values**

In `app/(app)/events/[eventId]/page.tsx`, add `<EventEditDialog event={event} />` to the button row inside `CardContent`, next to `EventActions` and `ExportButton`.

In the `CardHeader` subtitle line, which currently reads `{event.id} · {formatEventDate(event.date)}{event.location ? ... : ""}`, append the org name and the time. The org name needs a lookup: `getOrganizationsCached()` and find by `event.orgId`. When `event.orgId` is `""`, show nothing rather than the word "None" — an empty slot is honest, and the Edit dialog is right there. Follow the existing `{cond ? \` · ${value}\` : ""}` pattern.

- [ ] **Step 6: Commit**

```bash
git add components/events/EventEditDialog.tsx components/events/EventEditDialog.test.tsx "app/(app)/events/[eventId]/page.tsx"
git commit -m "feat(events): edit an event's organization and time"
```

---

## Task 7: Print report renders the organization

The payoff. This is why the backend was built.

**Files:**
- Modify: `app/(app)/events/[eventId]/report/print/page.tsx`

**Interfaces:**
- Consumes: `letterheadFor`, `Letterhead` from `@/lib/report-letterhead` (Task 1); `getOrganizationCachedFor` from `@/integration/cached`; `Organization` from `@/models/organization`.
- Produces: no new exports. The page's `letterhead` JSX local becomes data-driven.

- [ ] **Step 1: Write the failing test**

The resolver is already unit-tested in Task 1, so there is no new pure logic here. The failure this task prevents is a runtime crash on a missing org, which is Review Focus item 1. Assert it with a page smoke check rather than a unit test:

Run: `npx vitest run lib/report-letterhead.test.ts lib/auth/cache-isolation.test.ts`
Expected: PASS — the guard confirms the page still calls `await requireAdminPage()` after the edit, which is the one structural invariant this file must keep.

- [ ] **Step 2: Resolve the organization**

In the existing `Promise.all` at `app/(app)/events/[eventId]/report/print/page.tsx:38-41`, add a third read:

```ts
const [event, attendance, org] = await Promise.all([
  getEventCachedFor(eventId).catch(() => null),
  getAttendanceCachedFor(eventId).catch(() => []),
  getOrganizationsFor(eventId).catch(() => null),
])
```

where `getOrganizationsFor` is a small local async helper defined in this file that returns `null` unless the event names one:

```ts
async function getOrganizationsFor(eventId: string): Promise<Organization | null> {
  const event = await getEventCachedFor(eventId)
  if (!event.orgId) return null
  return getOrganizationCachedFor(event.orgId).catch(() => null)
}
```

The `.catch(() => null)` is load-bearing: an event pointing at a deleted organization resolves to null and prints the default letterhead, rather than 500 on the one page someone needs to file paperwork from. This also reuses the cached event read, so it costs no extra round trip.

- [ ] **Step 3: Drive the letterhead from the resolver**

Replace the hardcoded `letterhead` JSX at lines 57-126. Compute `const head = letterheadFor(org)` above the JSX, then:

- Only `name` and `contact` are data-driven (`head.name`, `head.contact`); every other line renders its `DEFAULT_LETTERHEAD` value in the same `<p>` tags with the same inline styles and the same 12pt/16pt/10pt sizing already in the file. **Preserve the styles exactly** — this is print output, and the current layout is what these reports have always looked like.
- `{head.contact}` is never empty — a blank org email keeps the default contact line — so render the `<p>` unconditionally.
- Keep the `4pt` black `<hr>`, the `council` line, and the `ACCENT`-coloured campus line unchanged.
- The logo `<img src="/bsu-tneu-logo.png">` stays as-is. Logos are per-organization and out of scope; note this in a comment so the next person does not assume it was forgotten.
- Time: at line 118, replace the blank `<span style={{ borderBottom: "1pt solid #000", padding: "0 24pt" }}>&nbsp;</span>` with `{event.time || "\u00a0"}`, so an event with no time still reserves the underline instead of collapsing the line. That preserves the current appearance for every event that has not set a time.

The footer slogan at line 204 becomes `{head.motto}`.

- [ ] **Step 4: Run the guard and the suite**

Run: `npm test`
Expected: PASS — recount the file and test totals from the run output, do not hardcode them.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/events/[eventId]/report/print/page.tsx"
git commit -m "feat(reports): print the event's organization on the report"
```

---

## Task 8: Docs

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/getting-started.md`
- Modify: `README.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Consumes: nothing. Documentation only.

- [ ] **Step 1: Update the route tables**

`docs/architecture.md` — add to the Pages table:

| Route | File | Notes |
|---|---|---|
| `/organizations` | `app/(app)/organizations/page.tsx` | List. Org names link to their events. |
| `/organizations/[orgId]` | `app/(app)/organizations/[orgId]/page.tsx` | One org: contact details and its events. |

`README.md` — extend the repository-layout note for `models/` if it lists them, and add the two page routes to whatever route list it carries.

- [ ] **Step 2: Document the spreadsheet relationship**

`docs/getting-started.md` — in the `Events` section, note that the org picker on the create form is required, and that an event created before the Organizations feature has a blank `Org ID` which the Edit dialog on the event page will let you fill in.

- [ ] **Step 3: Replace the manual procedure's frontend caveats**

`docs/testing.md` — the procedure added for the backend says of step 14 that the letterhead is hardcoded and the Time line blank, and marks that "expected, not a bug". That is now false. Rewrite step 14 to assert the opposite: the printed report shows the event's organization name and email, and the time appears in the Time field.

Add steps for what only a human can check:

- Creating an event with no organization selected is refused with a visible message, and `createEvent` is never called.
- With zero organizations in the sheet, the create form shows the prompt linking to `/organizations` and its submit button is disabled.
- An event with a blank `orgId` shows no org in its detail header, and the Edit dialog lets one be assigned.
- Editing an organization's name and then printing an event's report shows the new name without a redeploy.
- A time containing `12:00 pm - 5:00 pm` appears on the report exactly as typed, including the inner spaces.
- Deleting an organization removes it from `/organizations` and from the create-event picker. Its former events keep their stored `orgId` but print the default letterhead — verify this with an event whose org you then delete, before anything else on this list, because it is the one irreversible consequence here.

- [ ] **Step 4: Correct the suite counts**

`docs/testing.md` states the file and test totals near the top. Recount from `npx vitest run` output and update. Add rows for `lib/report-letterhead.test.ts` and the four component test files to the "What each suite proves" tables.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/architecture.md docs/getting-started.md docs/testing.md
git commit -m "docs: cover the organization UI"
```

---

## Verification

Run after every task, and once more at the end:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm run build` is not optional — it is the only check that proves no Client
Component imported a `server-only` module, which is a live risk in Task 3 and
Task 6 where dialogs call the client fetcher.

Then, by hand, following `docs/testing.md`:

1. `npm run dev`, sign in, open `/organizations`, create an organization.
2. Open `/events`, create an event. Confirm the org picker is required.
3. Open the event, print the report. Confirm the org name, org email, and the
   time are on it.
4. Open a pre-existing event with a blank `orgId`. Print its report and
   confirm the **original** letterhead is intact — this is the regression that
   matters most.
5. Assign that event an organization via Edit. Print again; the new letterhead
   appears.

## Out of Scope

- **Hard delete and permanent purge.** Soft delete only. A purge would need a
  rule for what happens to that organization's events, and a retention window.
- **Per-organization logos.** `public/bsu-tneu-logo.png` stays hardcoded in the
  print page. Considered and rejected: a base64 column hits the 50,000-char
  sheet cell limit and needs browser-side downscaling to stay under it; a Drive
  file needs permissions and a proxy route; a URL field hotlinks an external
  image that breaks if it moves. All three are viable, none is small, and the
  letterhead works without one.
- **Multi-tenant authorization.** Every admin still sees every organization.
  `docs/authentication.md` already states this explicitly; this plan does not
  change it.
- **An org-wide combined report.** The org name links to that org's event
  list, and each event keeps its own report.
