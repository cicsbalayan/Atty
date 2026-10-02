# Organizations Frontend Design Spec

Date: 2026-10-02
Status: approved in conversation 2026-10-02
Scope: event create form (time + organization picker), organizations list page,
organization create dialog, sidebar link, client wiring. Frontend only.

## Problem

Events have nowhere to record when they happen or who owns them. `SchoolEvent`
already carries `orgId` and `time`, and the report prints both, but the create
form collects neither: `components/events/EventFormDialog.tsx` submits only
name, date, location, and description. Every new event therefore lands with a
blank `orgId` and a blank time, and the organization records the backend
already stores (`{ id, name, email }`) are unreachable from the UI -- there is
no page that lists them and no control that creates them.

## Goals

- Collect a time range and an owning organization when creating an event.
- Provide a sidebar-backed organizations page that lists every organization
  and creates new ones (name + email).
- Do it with existing primitives and patterns only: `ClaySelect`, Dialog,
  Input, Card, `useCached`-backed hooks, server pages with `requireAdminPage`.
- Record the backend contracts this relies on, so "backend needs" is answered
  explicitly rather than left open.

## Non-goals

Explicitly out of scope. Each was considered and deferred:

- **Organization detail, edit, and delete pages.** The user asked for display
  plus create only. The pre-existing `docs/plans/2026-10-01-organizations-ui.md`
  already covers detail/edit/delete, the events-page org filter, and letterhead
  printing for a later cycle.
- **Editing an event's org or time.** Same plan, same later cycle.
- **Lockout countdown, forgot-PIN, signed-out messaging.** Separate concerns.
- **Any change to auth, rate limiting, sessions, or `components/auth/**`.**
- **A lockout countdown for the login form.** Unrelated; recorded elsewhere.

## Decisions

Settled with the requester on 2026-10-02; not reopenable during implementation.

1. **The organization is required when creating an event.** UI-side only: the
   backend still accepts a blank `orgId`, which legacy events depend on. An
   optional picker would leave new events printing the fallback letterhead,
   defeating the feature.
2. **Time is free text, not a time picker.** The model stores a display range
   verbatim (`"8:00 am - 5:00 pm"`, max 100 chars); a `<input type="time">`
   cannot express a range and would need parsing the backend never does.
3. **Scope is the requested subset only.** List + create organizations; time +
   org picker on the event form. Everything else stays in the 2026-10-01 plan.

## Design

### Event form

`components/events/EventFormDialog.tsx` gains two controls.

**Organization picker.** A `ClaySelect` on its own row after the date/location
grid. Options are organization *names*; the component keeps the selected
organization *id* in a `const [orgId, setOrgId] = React.useState("")` and maps
name to id on change (and id to name for the displayed value). This works
around `ClaySelect`'s string-only API, which renders each option string as
both value and label.

Stated plainly: two organizations with identical names are ambiguous, and the
first match wins. The backend does not enforce unique names, so this is a real
edge. It is accepted because renaming that constraint belongs to the backend,
and the picker degrades gracefully rather than breaking.

Required, enforced in `onSubmit`: when `orgId` is empty, set the error to
`"Select an organization."` in the existing `role="alert"` slot and return
before calling `createEvent`. `ClaySelect` has no native required behavior, so
the form owns the check.

Zero organizations is a dead end for a required picker. In that case the form
renders, instead of the picker, a `<p role="alert">` reading `"No
organizations yet. Add one on the Organizations page first."` containing a
`<Link href="/organizations">`, and the submit button is disabled. The operator
is never stuck on a form that cannot succeed.

**Time field.** A plain `Input` with `name="time"`, `maxLength={100}`, and
`placeholder="12:00 pm - 5:00 pm"`, on its own full-width row below the picker.
Full width because a range needs the room and because a growing field must not
resize mid-typing. Never `type="time"`.

Submit sends `orgId` and `time: String(form.get("time") ?? "")` alongside the
existing fields through `createEvent`. The organization list comes from the new
`useOrganizations()` hook (see Wiring).

### Organizations page

`app/(app)/organizations/page.tsx`, linked from `SideNav` after Events with a
`Building2` icon from `lucide-react`.

- Server component, `export const dynamic = "force-dynamic"`, `await
  requireAdminPage()` first. The `lib/auth/cache-isolation.test.ts` suite fails
  the build when any page outside `app/login/` skips the gate.
- Reads `getOrganizationsCached()` inside try/catch. A failed read degrades to
  an empty list plus a `role="alert"` message, never a 500. Same pattern as the
  events page.
- Header row mirrors the events page: `<h1 className="text-2xl font-bold
  tracking-tight">Organizations</h1>`, a `<p className="text-sm
  text-muted-foreground">` reading `"The offices and schools using this
  tracker."`, and the create control on the right.
- Body is `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` of organization cards.
  Each card shows the org name as title, the id in mono, and the email with a
  `Mail` icon only when non-empty (a blank email renders no row, not an empty
  one).
- Empty state: `<p className="clay p-4 text-sm text-muted-foreground">No
  organizations yet. Add the first one.</p>`

### Organization create dialog

`components/organizations/OrganizationFormDialog.tsx`, opened from the page
header. Mirrors `EventFormDialog`'s structure field for field: `open` /
`error` / `saving` state, `role="alert"` error slot, submit disabled while
saving, `invalidatePrefix("organizations:")` plus `router.refresh()` and close
on success.

Two fields, in this order:

| name | required | maxLength | placeholder | type |
|---|---|---|---|---|
| `name` | yes | 150 | `Batangas State University` | text |
| `email` | no | 150 | `sscbalayan@g.batstate-u.edu.ph` | email |

`type="email"` costs nothing -- the backend performs no format check, so an
empty value passes untouched -- and it gives mobile keyboards the `@` key. No
id field: the backend assigns it.

Dialog title `"Create organization"`, description `"The name and email appear
on printed attendance reports."`, submit label `"Create organization"`.

A blank name is refused in the submit handler, not left to native validation:
trim the name on submit and, when empty, set the `role="alert"` error and
return without calling. Native `required` stays on the input as well, but the
handler check is what makes the refusal deterministic and testable.

Create-only in this cycle. Edit mode is specified in the 2026-10-01 plan and
stays there.

## Wiring

`lib/api-client.ts` gains two functions mirroring `listEvents` /
`createEvent`:

```ts
export function listOrganizations(): Promise<OrganizationsResponse>
export function createOrganization(
  input: CreateOrganizationInput
): Promise<OrganizationResponse>
```

Both response types and `CreateOrganizationInput` already exist in
`models/api.ts` and `models/organization.ts`; only the functions are new.

`hooks/useQueries.ts` gains `useOrganizations()`, mirroring `useEvents`:

```ts
const result = useCached("organizations:all", listOrganizations, 30_000)
```

with a `refresh` that calls `invalidatePrefix("organizations:")` before
`result.refresh()`. The create dialog calls the same invalidation after a
successful POST, so the event form's picker and any other consumer see the new
organization without a reload.

## Backend needs

None. Every endpoint this design touches already exists, with exactly the
contract the frontend needs:

- `GET /api/organizations` returns `{ success: true, organizations }`.
- `POST /api/organizations` takes `name` (required, max 150) and `email`
  (optional, max 150), returns 201 with the created organization.
- `POST /api/events` takes `orgId` (optional, max 20) and `time` (optional,
  max 100) alongside the existing fields.

"Write the backend needs" is therefore satisfied by recording these three
contracts. If a later cycle wants unique organization names, that is a backend
constraint change and is out of scope here.

## Tests

- `components/organizations/OrganizationFormDialog.test.tsx` (jsdom
  docblock, `@/lib/api-client` mocked): submitting name + email calls
  `createOrganization` once with both values; submitting with a blank name
  refuses without calling.
- `components/events/EventFormDialog.test.tsx` (jsdom, `@/lib/api-client`
  and `@/hooks/useQueries` mocked): selecting an org submits its id; the time
  string is submitted verbatim; submitting with no org selected never calls
  `createEvent` and shows a `role="alert"` message mentioning the
  organization.
- Structural: `lib/auth/cache-isolation.test.ts` already walks `app/**` and
  fails if the new page skips `requireAdminPage()`. No new test needed for the
  gate itself.

`@testing-library/jest-dom` is not installed and `vitest.config.ts` has no
`setupFiles`, so all assertions go through the DOM directly
(`getAttribute`, `.disabled`, `textContent`), matching
`hooks/useCached.test.tsx`.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.
- Manual pass, following the spec:
  1. Sign in, open Organizations from the sidebar, create an organization with
     name + email. It appears in the grid.
  2. Open Events, start a new event. The organization picker lists the new
     org; time accepts `"8:00 am - 5:00 pm"`.
  3. Submit with no organization selected: refused with a visible message, no
     request fires.
  4. Create the event: confirm the POST body carries both values and that a
     subsequent `GET /api/events` shows them on the event. (No screen renders
     them yet -- that belongs to the deferred detail-page work, so verify at
     the contract level, not visually.)
  5. With zero organizations, the event form shows the prompt linking to
     Organizations and its submit is disabled.
