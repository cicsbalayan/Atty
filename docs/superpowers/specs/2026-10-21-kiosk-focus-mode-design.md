# Kiosk focus mode instead of monitor fullscreen

**Date:** 2026-10-21
**Status:** Approved for planning

## Problem

The check-in kiosk's expand button calls the Fullscreen API on
`document.documentElement`. On an operating system with the browser snapped to
half of the monitor, that promotes the window to true monitor fullscreen and
covers the other half. Staff run the kiosk in one half and keep other work in
the other, so a control meant to remove app chrome must not resize the window.

## Decision

Replace native fullscreen with an **in-window focus mode**. The button hides
the app chrome and lets the kiosk use the current window; it never asks the
browser or OS to change the window's bounds. True monitor fullscreen remains
available through the browser's own fullscreen (F11), and the existing
`:fullscreen` styles stay in place for that path.

## Behavior

- Clicking the toggle sets `data-kiosk-focus="true"` on
  `document.documentElement`; clicking again removes it.
- The choice is stored in `sessionStorage` under `atty:kiosk-focus`. It
  survives reloads and navigation within the tab and resets when the tab
  closes.
- The button appears on the check-in page at all times; support detection for
  the Fullscreen API is no longer needed, so it also works in embedded
  previews where fullscreen is denied.
- Pressing <kbd>Escape</kbd> while focus mode is active exits it.
- Labels and tooltips read "Enter focus mode" / "Exit focus mode"; the
  Maximize/Minimize icons stay.
- The kiosk keeps its `max-w-xl` width and stays centered; only the space
  occupied by the sidebar and header is reclaimed.
- Server and first client render both show focus mode off, so hydration is
  unchanged. A reload with focus mode already on may briefly paint the app
  chrome before the stored state is applied.

## Implementation outline

- `components/attendance/FullscreenToggle.tsx`: rename the concept to focus
  mode; toggle the root attribute and `sessionStorage`; subscribe to a local
  change event plus `keydown` for Escape; never call `requestFullscreen` or
  `exitFullscreen`.
- `app/globals.css`: add `[data-kiosk-focus="true"]` counterparts to the
  existing `:fullscreen` rules for `.app-chrome`, `.app-shell-grid`, `main`,
  and `.kiosk`. Keep the `:fullscreen` rules.
- `components/attendance/FullscreenToggle.test.tsx` (new, jsdom): covers
  toggling the attribute and storage, restoring from storage, Escape to exit,
  and asserts the Fullscreen API is never called.
- Docs: `docs/modules/check-in.md`, `docs/getting-started.md`,
  `docs/architecture.md`, and `docs/authentication.md` describe focus mode
  rather than kiosk fullscreen.

## Out of scope

- Preventing the brief chrome flash on a reload while focus mode is on (would
  need a blocking script before hydration).
- Changing the report print preview or any other route.
- Detecting whether the window already spans the monitor.
