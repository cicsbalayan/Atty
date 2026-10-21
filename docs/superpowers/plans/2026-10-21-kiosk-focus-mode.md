# Kiosk Focus Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the check-in kiosk's monitor fullscreen toggle with an in-window focus mode that hides app chrome without resizing a snapped half-screen window.

**Architecture:** The toggle writes a `data-kiosk-focus="true"` attribute on `<html>` and a `sessionStorage` preference. CSS mirrors the existing `:fullscreen` rules under that attribute. The attribute is removed when the toggle unmounts, so only the kiosk route can hide chrome; the preference survives for the next visit within the tab.

**Tech Stack:** React 19 client component, `useSyncExternalStore`, `sessionStorage`, unlayered CSS in `app/globals.css`, Vitest + Testing Library (jsdom).

## Global Constraints

- Do not call `requestFullscreen` or `exitFullscreen` anywhere in the new component.
- Storage key is exactly `atty:kiosk-focus`; the root attribute is exactly `data-kiosk-focus="true"`.
- `sessionStorage` failures must not break focus mode (private mode can throw).
- Keep the existing `:fullscreen` CSS rules so browser F11 still hides chrome.
- No new dependencies.
- Prettier: no semicolons, double quotes, 2-space indent, 80-column width.
- Do not rename `components/attendance/FullscreenToggle.tsx`; its exported name stays `FullscreenToggle`.
- Only commit the files listed in each task.

---

### Task 1: In-window focus toggle and CSS

**Files:**
- Modify: `components/attendance/FullscreenToggle.tsx` (replace the file body)
- Modify: `app/globals.css:552-573` (replace the kiosk block)
- Test: `components/attendance/FullscreenToggle.test.tsx` (create)

**Interfaces:**
- Consumes: existing `Button` component and `Maximize`/`Minimize` icons.
- Produces: `FullscreenToggle` still takes no props. It publishes the root attribute `data-kiosk-focus` and the `sessionStorage` key `atty:kiosk-focus`; Task 2 documents that behavior.

- [ ] **Step 1: Write the failing test**

Create `components/attendance/FullscreenToggle.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FullscreenToggle } from "./FullscreenToggle"

const KEY = "atty:kiosk-focus"

function stubFullscreenApi() {
  const request = vi.fn()
  const exit = vi.fn()
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: request,
  })
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: exit,
  })
  return { request, exit }
}

function clearFullscreenApi() {
  delete (document.documentElement as { requestFullscreen?: unknown })
    .requestFullscreen
  delete (document as { exitFullscreen?: unknown }).exitFullscreen
}

function focused() {
  return document.documentElement.getAttribute("data-kiosk-focus") === "true"
}

describe("FullscreenToggle", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    document.documentElement.removeAttribute("data-kiosk-focus")
  })

  afterEach(() => {
    cleanup()
    clearFullscreenApi()
    window.sessionStorage.clear()
    document.documentElement.removeAttribute("data-kiosk-focus")
    vi.restoreAllMocks()
  })

  it("toggles the focus attribute and remembers it for the tab", () => {
    render(<FullscreenToggle />)

    fireEvent.click(screen.getByRole("button", { name: "Enter focus mode" }))
    expect(focused()).toBe(true)
    expect(window.sessionStorage.getItem(KEY)).toBe("true")

    const exit = screen.getByRole("button", { name: "Exit focus mode" })
    expect(exit.getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(exit)
    expect(focused()).toBe(false)
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it("restores focus mode from sessionStorage", () => {
    window.sessionStorage.setItem(KEY, "true")
    render(<FullscreenToggle />)

    expect(focused()).toBe(true)
    expect(
      screen.getByRole("button", { name: "Exit focus mode" })
    ).toBeTruthy()
  })

  it("exits focus mode on Escape", () => {
    render(<FullscreenToggle />)
    fireEvent.click(screen.getByRole("button", { name: "Enter focus mode" }))

    fireEvent.keyDown(window, { key: "Escape" })

    expect(focused()).toBe(false)
    expect(
      screen.getByRole("button", { name: "Enter focus mode" })
    ).toBeTruthy()
  })

  it("restores chrome on unmount but keeps the preference", () => {
    window.sessionStorage.setItem(KEY, "true")
    const { unmount } = render(<FullscreenToggle />)
    expect(focused()).toBe(true)

    unmount()

    expect(focused()).toBe(false)
    expect(window.sessionStorage.getItem(KEY)).toBe("true")
  })

  it("never asks the browser for monitor fullscreen", () => {
    const { request, exit } = stubFullscreenApi()
    render(<FullscreenToggle />)

    fireEvent.click(screen.getByRole("button", { name: "Enter focus mode" }))
    fireEvent.click(screen.getByRole("button", { name: "Exit focus mode" }))

    expect(request).not.toHaveBeenCalled()
    expect(exit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run components/attendance/FullscreenToggle.test.tsx`

Expected: FAIL. In jsdom the old component's `getFullscreenSupported()` returns false, so it renders nothing and `getByRole("button", { name: "Enter focus mode" })` throws.

- [ ] **Step 3: Replace the component**

Replace all of `components/attendance/FullscreenToggle.tsx` with:

```tsx
"use client"

import * as React from "react"
import { Maximize, Minimize } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "atty:kiosk-focus"
const CHANGE_EVENT = "atty:kiosk-focus-change"

/**
 * Kiosk focus mode: hides the app chrome inside the current window without
 * the Fullscreen API, so a browser snapped to half the monitor stays there
 * while staff work in the other half.
 */
function readFocus(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function applyFocus(active: boolean) {
  const root = document.documentElement
  if (active) root.setAttribute("data-kiosk-focus", "true")
  else root.removeAttribute("data-kiosk-focus")
}

function writeFocus(active: boolean) {
  try {
    if (active) window.sessionStorage.setItem(STORAGE_KEY, "true")
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can throw in private mode; focus mode still works for this page.
  }
  applyFocus(active)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribeFocus(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CHANGE_EVENT, onChange)
}

export function FullscreenToggle() {
  const active = React.useSyncExternalStore(
    subscribeFocus,
    readFocus,
    () => false
  )

  React.useEffect(() => {
    applyFocus(active)
  }, [active])

  // Other routes must never lose their chrome. The preference stays in
  // sessionStorage, so the next check-in visit restores focus mode.
  React.useEffect(() => () => applyFocus(false), [])

  React.useEffect(() => {
    if (!active) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") writeFocus(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [active])

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={active ? "Exit focus mode" : "Enter focus mode"}
      aria-pressed={active}
      title={active ? "Exit focus mode" : "Enter focus mode"}
      className="clay-btn rounded-full"
      onClick={() => writeFocus(!active)}
    >
      {active ? (
        <Minimize className="size-4" aria-hidden />
      ) : (
        <Maximize className="size-4" aria-hidden />
      )}
    </Button>
  )
}
```

- [ ] **Step 4: Mirror the kiosk CSS under the focus attribute**

In `app/globals.css`, replace lines 552-573 (the block beginning with
`/* ---- Kiosk focus mode (UNLAYERED ... */` and ending at the `.kiosk` rule)
with:

```css
/* ---- Kiosk focus mode / fullscreen (UNLAYERED — must beat utilities) ----
   `[data-kiosk-focus]` is the in-window mode used by the check-in toggle:
   it keeps the browser window's bounds, so a snapped half-screen window
   stays half-screen. `:fullscreen` is kept for browser-level F11. */
:fullscreen .app-chrome,
[data-kiosk-focus="true"] .app-chrome {
  display: none;
}
:fullscreen .app-shell-grid,
[data-kiosk-focus="true"] .app-shell-grid {
  grid-template-columns: minmax(0, 1fr);
}
:fullscreen main,
[data-kiosk-focus="true"] main {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding-top: 6dvh;
  padding-bottom: var(--space-8);
}
:fullscreen .kiosk,
[data-kiosk-focus="true"] .kiosk {
  width: 100%;
  margin-inline: auto;
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npx vitest run components/attendance/FullscreenToggle.test.tsx`

Expected: PASS, 5 tests.

- [ ] **Step 6: Format, typecheck, and lint**

Run: `npx prettier --write components/attendance/FullscreenToggle.tsx components/attendance/FullscreenToggle.test.tsx`

Run: `npm run typecheck`

Expected: no errors.

Run: `npm run lint`

Expected: no new warnings (3 pre-existing warnings are acceptable).

- [ ] **Step 7: Commit**

Run:

```powershell
git add components/attendance/FullscreenToggle.tsx components/attendance/FullscreenToggle.test.tsx app/globals.css
git commit -m "feat(check-in): use in-window focus mode instead of fullscreen"
```

---

### Task 2: Update kiosk documentation

**Files:**
- Modify: `docs/modules/check-in.md`
- Modify: `docs/getting-started.md:176`
- Modify: `docs/authentication.md:152-154`
- Modify: `docs/architecture.md:100`
- Modify: `docs/architecture.md:129-131`

**Interfaces:**
- Consumes: the `data-kiosk-focus` / `atty:kiosk-focus` behavior from Task 1.
- Produces: docs only; no code interface.

- [ ] **Step 1: Update the check-in module doc**

In `docs/modules/check-in.md`, replace:

```markdown
- `FullscreenToggle` hides the app chrome for distraction-free door operation.
```

with:

```markdown
- `FullscreenToggle` toggles an in-window focus mode that hides the app chrome
  for distraction-free door operation. It never uses the Fullscreen API, so a
  browser snapped to half the monitor stays half-screen; <kbd>Escape</kbd> or
  the same button exits. The preference lasts for the tab.
```

In the key-files table, replace the role `Kiosk fullscreen control` with
`Kiosk focus-mode control`.

- [ ] **Step 2: Update getting started**

In `docs/getting-started.md` around line 176, replace:

```markdown
Built for a tablet at a gym door. Large SR Code field, autofocus, and a
fullscreen toggle that hides the app chrome.
```

with:

```markdown
Built for a tablet at a gym door. Large SR Code field, autofocus, and a
focus-mode toggle that hides the app chrome without resizing the window.
```

- [ ] **Step 3: Update authentication**

In `docs/authentication.md` around line 152, replace:

```markdown
The kiosk also supports fullscreen, which hides the app chrome. That relies on
`.app-shell` and `.app-chrome` class names, which is why the print report stays
inside the `(app)` route group.
```

with:

```markdown
The kiosk also has an in-window focus mode that hides the app chrome without
entering browser fullscreen. That relies on the shell class names plus the
`data-kiosk-focus` attribute, which is why the print report stays inside the
`(app)` route group.
```

- [ ] **Step 4: Update architecture**

In `docs/architecture.md` around line 100, replace the route description
`Kiosk. Fullscreen support.` with `Kiosk. In-window focus mode.`

Around lines 129-131, replace:

```markdown
The print report stays **inside** the group: `@media print` and `:fullscreen`
both target `.app-shell` and `.app-chrome` in `app/globals.css`, so removing
the shell would break printing and kiosk fullscreen.
```

with:

```markdown
The print report stays **inside** the group: `@media print` and the kiosk
focus-mode selectors (`[data-kiosk-focus="true"]`) both target `.app-chrome`,
`main`, and the shell grid in `app/globals.css`, so removing the shell would
break printing and kiosk focus mode.
```

- [ ] **Step 5: Check for stale wording**

Run: `rg -n "fullscreen toggle|Fullscreen support|supports fullscreen" docs`

Expected: no matches. (`docs/api-security.md` may still mention fullscreen in
the CSP note; that is unrelated and should stay.)

- [ ] **Step 6: Commit**

Run:

```powershell
git add docs/modules/check-in.md docs/getting-started.md docs/authentication.md docs/architecture.md
git commit -m "docs(check-in): describe in-window focus mode"
```

---

## Self-Review

- Spec coverage: focus toggle, persistence key, Escape exit, scoped attribute,
  CSS mirror, tests, and all four docs are covered by Tasks 1-2.
- Placeholders: none; every step contains the exact code or text.
- Type consistency: `FullscreenToggle` props are unchanged; the same
  `data-kiosk-focus` string and `atty:kiosk-focus` key are used in component,
  CSS, tests, and docs.
- Out-of-scope items from the spec (pre-hydration flash, other routes, window
  detection) are intentionally not implemented.
