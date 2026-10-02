# Organizations Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators record an event's time range and owning organization at creation, and list plus create organizations from a new sidebar page -- frontend only, against endpoints that already exist.

**Architecture:** Four sequential tasks mirroring established repo patterns. Task 1 adds the browser client functions and query hook. Task 2 adds the organization create dialog. Task 3 adds the server-rendered organizations page, card, and sidebar link. Task 4 adds the org picker and time field to the event form. Each task is independently testable and commits on its own.

**Tech Stack:** Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind 4, `@base-ui/react` primitives, Vitest with `@testing-library/react` in jsdom. No new dependencies.

**Spec:** `docs/specs/2026-10-02-organizations-frontend-design.md`

## Global Constraints

- Every file under 400 lines. The repo enforces this by convention (`README.md`).
- No new npm dependencies. `@base-ui/react`, `lucide-react`, and `cn` are already present.
- Styling is by design-token utility class only: `clay`, `clay-btn`, `clay-btn-primary`, `clay-input`, `clay-pressed`, `clay-tile-*`, `display`, `overline`, `tabular-nums`, `font-mono`. Do not introduce raw hex colours outside `app/globals.css`. No new rules in `app/globals.css`.
- Every `page.tsx` outside `app/login/` must call `await requireAdminPage()` or `lib/auth/cache-isolation.test.ts` fails the build.
- `integration/cached.ts` must not import from `lib/auth/*`. No task here touches it.
- No backend changes. No edits to `app/api/**`, `integration/**`, `models/**`, or `apps-script/**`. The three contracts the frontend relies on (`POST /api/events` takes `orgId` max 20 and `time` max 100; `POST /api/organizations` takes `name` required max 150 and `email` optional max 150, returns 201) already hold.
- Copy tone: plain, no exclamation marks, sentence-case button labels ("Create organization", not "Create Organization!").
- Prettier config is `semi: false`, double quotes, 2-space, `printWidth: 80`, `trailingComma: "es5"`. Format only the files you touch (`npx prettier --write <files>`). Never run repo-wide `npm run format`: the repo is not prettier-clean and it rewrites dozens of untouched files.
- `@testing-library/jest-dom` is not installed and `vitest.config.ts` has no `setupFiles`, so jest-dom matchers (`toHaveAttribute`, `toBeDisabled`, `toHaveTextContent`) do not exist. All test assertions go through the DOM directly (`getAttribute`, `.disabled`, `textContent`), matching `hooks/useCached.test.tsx`. Every jsdom test file opens with the `@vitest-environment jsdom` docblock.
- There is no in-repo precedent for mocking `next/navigation`. Every test that renders a component calling `useRouter` must include `vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/api-client.ts` (modify) | Add `listOrganizations`, `createOrganization`. |
| `hooks/useQueries.ts` (modify) | Add `useOrganizations`. |
| `hooks/useQueries.test.tsx` (create) | Hook wiring test. |
| `components/organizations/OrganizationFormDialog.tsx` (create) | Create-one-organization dialog. |
| `components/organizations/OrganizationFormDialogLazy.tsx` (create) | `next/dynamic` wrapper, matching `EventFormDialogLazy`. |
| `components/organizations/OrganizationFormDialog.test.tsx` (create) | Dialog submit + refusal tests. |
| `components/organizations/OrganizationCard.tsx` (create) | One organization in the list grid. Server component. |
| `app/(app)/organizations/page.tsx` (create) | List page. Server component. |
| `components/layout/SideNav.tsx` (modify) | Add the Organizations link. |
| `components/events/EventFormDialog.tsx` (modify) | Org picker + time field + required-org guard. |
| `components/events/EventFormDialog.test.tsx` (create) | Picker, verbatim time, refusal, empty-state tests. |

---

### Task 1: Organization client functions and query hook

**Files:**
- Modify: `lib/api-client.ts`
- Modify: `hooks/useQueries.ts`
- Test: `hooks/useQueries.test.tsx`

**Interfaces:**
- Consumes: `OrganizationsResponse`, `OrganizationResponse` from `@/models/api`; `CreateOrganizationInput` from `@/models/organization`; `useCached`, `invalidatePrefix` from `@/hooks/useCached` — all already exist.
- Produces: `listOrganizations(): Promise<OrganizationsResponse>`, `createOrganization(input: CreateOrganizationInput): Promise<OrganizationResponse>`, and `useOrganizations()` returning `{ data, error, loading, refresh }` where `data` is the full `OrganizationsResponse` (consumers read `data?.organizations`). Tasks 2 and 4 consume all three.

- [ ] **Step 1: Write the failing test**

Create `hooks/useQueries.test.tsx` with the `@vitest-environment jsdom` docblock:

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { refreshAllReads } from "./useCached"
import { useOrganizations } from "./useQueries"
import { listOrganizations } from "@/lib/api-client"

vi.mock("@/lib/api-client", () => ({
  getEvent: vi.fn(),
  listAttendance: vi.fn(),
  listEvents: vi.fn(),
  getReport: vi.fn(),
  listOrganizations: vi.fn(),
}))

beforeEach(() => {
  refreshAllReads()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function OrgProbe() {
  const { data, loading } = useOrganizations()
  if (loading) return <p>loading</p>
  return <p>{`count:${data?.organizations.length ?? "none"}`}</p>
}

describe("useOrganizations", () => {
  it("starts loading, then yields the organization list", async () => {
    vi.mocked(listOrganizations).mockResolvedValue({ success: true, organizations: [] })
    render(<OrgProbe />)
    expect(screen.getByText("loading")).toBeTruthy()
    await waitFor(() => expect(screen.getByText("count:0")).toBeTruthy())
  })
})
```

`refreshAllReads()` in `beforeEach` matters: the `useCached` module cache persists across tests in one worker, and without the reset a previous test's entry would serve stale data.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run hooks/useQueries.test.tsx`
Expected: FAIL — `useOrganizations` is not exported from `./useQueries`.

- [ ] **Step 3: Add the client functions**

In `lib/api-client.ts`, extend the `@/models/api` type import with `OrganizationResponse` and `OrganizationsResponse` (alphabetical placement, matching the existing block), and add a new import line for the input type:

```ts
import type { CreateOrganizationInput } from "@/models/organization"
```

After `createEvent` (line 84-89), add:

```ts
export function listOrganizations(): Promise<OrganizationsResponse> {
  return request<OrganizationsResponse>("/api/organizations", { cache: "no-store" })
}

export function createOrganization(
  input: CreateOrganizationInput
): Promise<OrganizationResponse> {
  return request<OrganizationResponse>("/api/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
```

- [ ] **Step 4: Add the hook**

In `hooks/useQueries.ts`, add `listOrganizations` to the existing `@/lib/api-client` import, then append after `useEvents`:

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

Only the `organizations:` client prefix is invalidated. The dashboard and the
events pages do read organization names, but they do it server-side through
`getOrganizationsCached()`, which the POST route already expires via
`expireOrganizations()` -- and the dialogs call `router.refresh()`, which picks
that up. No client hook outside `useOrganizations` reads organizations, so there
is nothing else to clear.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run hooks/useQueries.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 6: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

```bash
npx prettier --write lib/api-client.ts hooks/useQueries.ts hooks/useQueries.test.tsx
git add lib/api-client.ts hooks/useQueries.ts hooks/useQueries.test.tsx
git commit -m "feat(org): add browser client and query hook for organizations"
```

---

### Task 2: Organization create dialog

**Files:**
- Create: `components/organizations/OrganizationFormDialog.tsx`
- Create: `components/organizations/OrganizationFormDialogLazy.tsx`
- Test: `components/organizations/OrganizationFormDialog.test.tsx`

**Interfaces:**
- Consumes: `createOrganization`, `ApiError` from `@/lib/api-client` (Task 1); `invalidatePrefix` from `@/hooks/useCached`; Dialog/Input/Label/Button primitives; `CreateOrganizationInput` from `@/models/organization`.
- Produces: `OrganizationFormDialog()` (create-only, no props) and `OrganizationFormDialogLazy`. Task 3 mounts the lazy wrapper.

- [ ] **Step 1: Write the failing test**

Create `components/organizations/OrganizationFormDialog.test.tsx` with the `@vitest-environment jsdom` docblock:

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OrganizationFormDialog } from "./OrganizationFormDialog"
import { createOrganization } from "@/lib/api-client"

vi.mock("@/lib/api-client", () => ({ createOrganization: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

function open() {
  render(<OrganizationFormDialog />)
  fireEvent.click(screen.getByRole("button", { name: /new organization/i }))
}

describe("OrganizationFormDialog", () => {
  it("submits the name and email", async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      success: true,
      organization: { id: "ORG-001", name: "Batangas State University", email: "sscbalayan@g.batstate-u.edu.ph" },
    })
    open()
    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Batangas State University" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sscbalayan@g.batstate-u.edu.ph" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create organization$/i }))
    await waitFor(() => {
      expect(createOrganization).toHaveBeenCalledTimes(1)
    })
    expect(createOrganization).toHaveBeenCalledWith({
      name: "Batangas State University",
      email: "sscbalayan@g.batstate-u.edu.ph",
    })
  })

  it("refuses a blank name without calling", async () => {
    open()
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sscbalayan@g.batstate-u.edu.ph" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create organization$/i }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy()
    })
    expect(createOrganization).not.toHaveBeenCalled()
  })
})
```

The blank-name case is deterministic because the handler trims and refuses before calling: jsdom's `fireEvent` does not run native constraint validation, so the `required` attribute alone would not stop the submit in the test.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/organizations/OrganizationFormDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the dialog**

Create `components/organizations/OrganizationFormDialog.tsx`, mirroring `components/events/EventFormDialog.tsx` field for field:

```tsx
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input, Label } from "@/components/ui/input"
import { ApiError, createOrganization } from "@/lib/api-client"
import { invalidatePrefix } from "@/hooks/useCached"
import type { CreateOrganizationInput } from "@/models/organization"

export function OrganizationFormDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function onSubmit(form: FormData) {
    const name = String(form.get("name") ?? "").trim()
    if (!name) {
      setError("Enter an organization name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input: CreateOrganizationInput = {
        name,
        email: String(form.get("email") ?? "").trim(),
      }
      await createOrganization(input)
      invalidatePrefix("organizations:")
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create organization.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="clay-btn clay-btn-primary"><Plus className="size-4" aria-hidden /> New organization</Button>}
      />
      <DialogContent>
        <DialogTitle>Create organization</DialogTitle>
        <DialogDescription>The name and email appear on printed attendance reports.</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          action={(form) => void onSubmit(form)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Organization name</Label>
            <Input id="org-name" name="name" required maxLength={150} placeholder="Batangas State University" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-email">Email</Label>
            <Input id="org-email" name="email" type="email" maxLength={150} placeholder="sscbalayan@g.batstate-u.edu.ph" />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={saving} className="clay-btn mt-1">
            {saving ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

The email is always sent, even as `""`. The backend treats a missing field as `""` (`integration/organizations.ts:32-35`), so sending the explicit default keeps the request body and the stored row in agreement. `type="email"` gives mobile keyboards the `@` key at zero cost: the backend performs no format check, so an empty value passes untouched.

The busy label above uses three ASCII dots. The sibling `EventFormDialog` uses a real ellipsis character there. Copy that line's exact characters from `EventFormDialog.tsx:71` rather than retyping them, so the two dialogs do not diverge.

- [ ] **Step 4: Implement the lazy wrapper**

Create `components/organizations/OrganizationFormDialogLazy.tsx` as a structural copy of `EventFormDialogLazy.tsx`, swapping the import to `./OrganizationFormDialog` and the labels to `New organization`:

```tsx
"use client"

import dynamic from "next/dynamic"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

// Deferred until first interaction: pulls the dialog primitive subtree
// out of the initial /organizations bundle. Must live in a Client Component -
// `ssr: false` is not allowed in Server Components.
export const OrganizationFormDialogLazy = dynamic(
  () => import("./OrganizationFormDialog").then((m) => m.OrganizationFormDialog),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="clay-btn clay-btn-primary">
        <Plus className="size-4" aria-hidden /> New organization
      </Button>
    ),
  }
)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run components/organizations/OrganizationFormDialog.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

```bash
npx prettier --write components/organizations/OrganizationFormDialog.tsx components/organizations/OrganizationFormDialogLazy.tsx components/organizations/OrganizationFormDialog.test.tsx
git add components/organizations/
git commit -m "feat(org): add the organization create dialog"
```

---

### Task 3: Organizations page, card, and sidebar link

**Files:**
- Create: `app/(app)/organizations/page.tsx`
- Create: `components/organizations/OrganizationCard.tsx`
- Modify: `components/layout/SideNav.tsx`

**Interfaces:**
- Consumes: `getOrganizationsCached` from `@/integration/cached`; `requireAdminPage` from `@/lib/auth/dal`; `OrganizationFormDialogLazy` (Task 2); Card primitives; `Organization` from `@/models/organization`.
- Produces: routes `/organizations`. No new exported symbols beyond the page component and `OrganizationCard`. Task 4 needs nothing from this task.

- [ ] **Step 1: Write the failing test**

There is no page-test harness in this repo, and the structural guard is the test. Run it and watch it fail:

Run: `npx vitest run lib/auth/cache-isolation.test.ts`
Expected: FAIL — the guard walks `app/**` for `page.tsx` files and requires `await requireAdminPage()` in each one outside `app/login/`. The new page does not exist yet, so create the file first with the full implementation below minus the gate line, run the guard to see it fail, then add the gate line and re-run to see it pass. The FAIL-then-PASS must both be observed and recorded in the task report.

- [ ] **Step 2: Create the card**

Create `components/organizations/OrganizationCard.tsx`, a server component mirroring `EventCard`'s card language (`clay-topglow`, `CardHeader` with `justify-between`, mono id line, icon-prefixed rows):

```tsx
import { Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Organization } from "@/models/organization"

export function OrganizationCard({ organization: org }: { organization: Organization }) {
  return (
    <Card className="clay-topglow flex h-full flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{org.name}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{org.id}</p>
        </div>
      </CardHeader>
      {org.email ? (
        <CardContent className="flex-1">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden /> {org.email}
          </p>
        </CardContent>
      ) : null}
    </Card>
  )
}
```

The name is plain text, not a link: there is no detail page in this cycle, and a link must never point at a route that does not exist.

- [ ] **Step 3: Create the page**

Create `app/(app)/organizations/page.tsx`, mirroring `app/(app)/events/page.tsx` lines 1-11 (imports, `force-dynamic` with its comment) and lines 24-30 (the try/catch degrading to an empty list plus an error string):

```tsx
import { getOrganizationsCached } from "@/integration/cached"
import { OrganizationCard } from "@/components/organizations/OrganizationCard"
import { OrganizationFormDialogLazy } from "@/components/organizations/OrganizationFormDialogLazy"
import { requireAdminPage } from "@/lib/auth/dal"

/**
 * Request-time rendered: the list must reflect creates without a redeploy,
 * and the cached read keeps repeat views off the Apps Script roundtrip.
 */
export const dynamic = "force-dynamic"

export default async function OrganizationsPage() {
  await requireAdminPage()

  let organizations: Awaited<ReturnType<typeof getOrganizationsCached>> = []
  let error: string | null = null
  try {
    organizations = await getOrganizationsCached()
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load organizations."
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">The offices and schools using this tracker.</p>
        </div>
        <OrganizationFormDialogLazy />
      </div>
      {error ? (
        <p role="alert" className="clay p-4 text-sm text-destructive">{error}</p>
      ) : organizations.length === 0 ? (
        <p className="clay p-4 text-sm text-muted-foreground">No organizations yet. Add the first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {organizations.map((org) => (
            <OrganizationCard key={org.id} organization={org} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the sidebar link**

In `components/layout/SideNav.tsx`, extend the lucide import and the links array. Old:

```tsx
import { CalendarDays, Home } from "lucide-react"
```

New:

```tsx
import { Building2, CalendarDays, Home } from "lucide-react"
```

Old:

```tsx
const links = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/events", label: "Events", icon: CalendarDays },
]
```

New:

```tsx
const links = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/organizations", label: "Organizations", icon: Building2 },
]
```

Nothing else changes: the active-state logic (`pathname.startsWith(href)`) is generic, and `/organizations` collides with no existing prefix.

- [ ] **Step 5: Run the guard to verify it passes**

Run: `npx vitest run lib/auth/cache-isolation.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all green, and the build output lists `/organizations` among the routes. The build is required here, not just the tests: it proves the new server page compiles and that no Client Component imported a `server-only` module.

```bash
npx prettier --write "app/(app)/organizations/page.tsx" components/organizations/OrganizationCard.tsx components/layout/SideNav.tsx
git add "app/(app)/organizations" components/organizations/OrganizationCard.tsx components/layout/SideNav.tsx
git commit -m "feat(org): add organization list page and sidebar link"
```

---

### Task 4: Organization picker and time field on the event form

**Files:**
- Modify: `components/events/EventFormDialog.tsx`
- Test: `components/events/EventFormDialog.test.tsx`

**Interfaces:**
- Consumes: `useOrganizations` from `@/hooks/useQueries` (Task 1); `ClaySelect` from `@/components/ui/select`; `createEvent`, `ApiError` from `@/lib/api-client`; `Link` from `next/link` (new import).
- Produces: no new exports. The form's `createEvent` call gains `orgId` and `time`.

- [ ] **Step 1: Write the failing test**

Create `components/events/EventFormDialog.test.tsx` with the `@vitest-environment jsdom` docblock:

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EventFormDialog } from "./EventFormDialog"
import { createEvent } from "@/lib/api-client"
import { useOrganizations } from "@/hooks/useQueries"

vi.mock("@/lib/api-client", () => ({ createEvent: vi.fn() }))
vi.mock("@/hooks/useQueries", () => ({ useOrganizations: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

const orgs = [{ id: "ORG-001", name: "Batangas State University", email: "" }]

function mockOrgs(list: typeof orgs) {
  vi.mocked(useOrganizations).mockReturnValue({
    data: list.length ? { success: true as const, organizations: list } : null,
    error: null,
    loading: false,
    refresh: vi.fn(),
  })
}

function fillBasics() {
  fireEvent.change(screen.getByLabelText("Event name"), {
    target: { value: "Freshmen Orientation" },
  })
  fireEvent.change(screen.getByLabelText("Event date"), {
    target: { value: "2026-11-01" },
  })
}

async function chooseOrg(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Organization" }))
  fireEvent.click(await screen.findByRole("option", { name }))
}

describe("EventFormDialog", () => {
  it("submits the selected organization id", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" },
    })
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as Record<string, unknown>
    expect(input.orgId).toBe("ORG-001")
  })

  it("submits the time string verbatim", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" },
    })
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "12:00 pm - 5:00 pm" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as Record<string, unknown>
    expect(input.time).toBe("12:00 pm - 5:00 pm")
  })

  it("refuses to submit with no organization selected", async () => {
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("organization")
    expect(createEvent).not.toHaveBeenCalled()
  })

  it("shows the empty-state prompt and disables submit with zero organizations", async () => {
    vi.mocked(useOrganizations).mockReturnValue({
      data: null,
      error: null,
      loading: false,
      refresh: vi.fn(),
    })
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    expect(
      screen.getByText(/add one on the organizations page first/i)
    ).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: /^create event$/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })
})
```

Three notes the implementer must respect:

- The Base UI `ClaySelect` trigger carries `role="combobox"` and its popup items carry `role="option"`. The accessible name of the trigger comes from the `Label htmlFor="org"`. If the popup does not open under `fireEvent.click` in this jsdom version, `fireEvent.mouseDown` on the trigger is the documented Base UI fallback before reporting a blocker.
- `mockOrgs` returns `data: null` for the empty case rather than an empty list, because a `null` data with `loading: false` is exactly what `useCached` yields when the fetch resolved to nothing usable here; the form treats both identically (`orgs.length === 0`).
- `createEvent` is mocked to resolve `{ success: true, event: { id: "EVT-001" } }` — a partial shape. The form only reads `success`, so a full `SchoolEvent` fixture would be noise.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/events/EventFormDialog.test.tsx`
Expected: FAIL — the form has no `orgId` or `time` field, so `chooseOrg` finds no combobox and the submit call carries neither key.

- [ ] **Step 3: Add the two fields**

In `components/events/EventFormDialog.tsx`, make exactly these edits. Nothing else in the file moves.

Edit 1 — imports. Old:

```tsx
import { ApiError, createEvent } from "@/lib/api-client"
```

New:

```tsx
import Link from "next/link"
import { ApiError, createEvent } from "@/lib/api-client"
import { useOrganizations } from "@/hooks/useQueries"
import { ClaySelect } from "@/components/ui/select"
```

Keep import order as shown: `next/link` first (matching the file's existing `next/navigation` line above it), then the `@/` imports in their existing relative order. `Link` is used by the empty-state prompt; `ClaySelect` and `useOrganizations` by the picker.

Edit 2 — state and data, inside the component before `onSubmit`:

```tsx
const { data: orgData, loading: orgsLoading } = useOrganizations()
const orgs = orgData?.organizations ?? []
const [orgId, setOrgId] = React.useState("")
```

Edit 3 — the two controls, inserted between the date/location grid and the description field:

```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="org">Organization</Label>
  {orgs.length === 0 && !orgsLoading ? (
    <p role="alert" className="text-sm text-destructive">
      No organizations yet. Add one on the{" "}
      <Link href="/organizations" className="underline underline-offset-4">
        Organizations page
      </Link>{" "}
      first.
    </p>
  ) : (
    <ClaySelect
      id="org"
      value={orgs.find((o) => o.id === orgId)?.name ?? ""}
      onChange={(name) => setOrgId(orgs.find((o) => o.name === name)?.id ?? "")}
      placeholder="Select an organization"
      options={orgs.map((o) => o.name)}
      allLabel="Select an organization"
    />
  )}
</div>
<div className="flex flex-col gap-1.5">
  <Label htmlFor="time">Time</Label>
  <Input id="time" name="time" maxLength={100} placeholder="12:00 pm - 5:00 pm" />
</div>
```

The value/onChange pair maps between the ids the API wants and the names `ClaySelect` renders: it takes `string[]` options and its first item is the `allLabel` value `""`, so the component holds the id and translates both directions through `find`. Stated plainly: two organizations sharing a name are ambiguous and the first match wins. The backend does not enforce unique names; renaming that constraint is backend work and out of scope.

The picker sits on its own row directly after the date/location grid, and the time field on the row below it. Neither shares a grid cell: a value like `12:00 pm - 5:00 pm` needs the full width to stay legible.

While `orgsLoading` is true the picker renders with whatever has arrived (possibly no options). It is not disabled and the empty-state prompt is not shown: `ClaySelect` exposes no `disabled` prop, and flashing the dead-end message during a fetch would be wrong. A submit with nothing selected is refused by the guard below.

Edit 4 — the guard and the submit body. Old `onSubmit` head:

```ts
async function onSubmit(form: FormData) {
  setSaving(true)
  setError(null)
```

New:

```ts
async function onSubmit(form: FormData) {
  if (!orgId) {
    setError("Select an organization.")
    return
  }
  setSaving(true)
  setError(null)
```

The guard runs before `setSaving` because a client-side refusal is not work in progress. Old call:

```ts
await createEvent({
  name: String(form.get("name") ?? ""),
  date: String(form.get("date") ?? ""),
  location: String(form.get("location") ?? ""),
  description: String(form.get("description") ?? ""),
})
```

New:

```ts
await createEvent({
  name: String(form.get("name") ?? ""),
  date: String(form.get("date") ?? ""),
  location: String(form.get("location") ?? ""),
  description: String(form.get("description") ?? ""),
  orgId,
  time: String(form.get("time") ?? ""),
})
```

The time is sent exactly as typed: no trim of inner spaces, no case change. The report prints it verbatim, so any normalization here would corrupt display data.

Edit 5 — gate the submit while the picker is a dead end. Old:

```tsx
<Button type="submit" disabled={saving} className="clay-btn mt-1">
```

New:

```tsx
<Button type="submit" disabled={saving || (!orgsLoading && orgs.length === 0)} className="clay-btn mt-1">
```

The `!orgsLoading` clause matters: without it the button would start disabled on every open while the list is still fetching.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/events/EventFormDialog.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the gate and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

```bash
npx prettier --write components/events/EventFormDialog.tsx components/events/EventFormDialog.test.tsx
git add components/events/EventFormDialog.tsx components/events/EventFormDialog.test.tsx
git commit -m "feat(events): require an organization and collect a time range"
```

---

### Task 5: Verification gate and manual pass

**Files:** none. Verification only; no commit.

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green, and the build output lists `/organizations` among the routes. `npm run build` is not optional: it is the only check that proves the new server page compiles and that no Client Component imported a `server-only` module.

- [ ] **Step 2: Manual pass, following the spec**

1. `npm run dev`, sign in, open Organizations from the sidebar, create an organization with name + email. It appears in the grid.
2. Open Events, start a new event. The organization picker lists the new org; time accepts `"8:00 am - 5:00 pm"`.
3. Submit with no organization selected: refused with a visible message, no request fires (confirm in the network tab).
4. Create the event: confirm the POST body carries both values and that a subsequent `GET /api/events` shows them on the event.
5. With zero organizations (temporarily empty sheet or fresh test backend), the event form shows the prompt linking to Organizations and its submit is disabled.

Record the outcome of each step in the task report. A failure in step 3 or 4 is a defect in Task 4; a failure in step 1 or 5 is a defect in Task 2 or 3. Route it back to the owning task rather than fixing it here.

---

## Out of Scope

- **Organization detail, edit, and delete.** The 2026-10-01 plan specifies them for a later cycle. The org name on the card is therefore plain text, not a link: a link must never point at a route that does not exist.
- **Events-page org filter.** Same plan, same later cycle.
- **Letterhead printing.** The report already prints `event.time` and resolves orgs; nothing here changes it.
- **Unique organization names.** The picker maps name to id with first-match-wins. Enforcing uniqueness is a backend constraint change.
- **Docs updates.** The spec is the record for this cycle; `docs/architecture.md` route tables are updated when the deferred pages land alongside it.
